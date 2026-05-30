-- Campaign Gating System: ValueSkin-based access control + monetization hooks
-- Brands specify required ValueSkins; matching engine enforces visibility
-- 3 visibility modes allow platforms to choose monetization strategy

-- Extend opportunities table with gating configuration
ALTER TABLE opportunities
ADD COLUMN IF NOT EXISTS gating_type VARCHAR(50) NOT NULL DEFAULT 'any'
  CHECK (gating_type IN ('any', 'specific', 'professional')),
ADD COLUMN IF NOT EXISTS required_professions BIGINT[] DEFAULT '{}',
ADD COLUMN IF NOT EXISTS required_professions_logic VARCHAR(50) NOT NULL DEFAULT 'OR'
  CHECK (required_professions_logic IN ('AND', 'OR')),
ADD COLUMN IF NOT EXISTS required_min_level INT NOT NULL DEFAULT 1
  CHECK (required_min_level BETWEEN 1 AND 5),
ADD COLUMN IF NOT EXISTS visibility_for_non_matching VARCHAR(50) NOT NULL DEFAULT 'visible_with_prompt'
  CHECK (visibility_for_non_matching IN ('hidden', 'visible_with_block', 'visible_with_prompt')),
ADD COLUMN IF NOT EXISTS access_message_for_blocked TEXT DEFAULT 'This campaign requires specific ValueSkins to access.';

-- Campaign gating audit log (who could view, who couldn't, why)
CREATE TABLE IF NOT EXISTS campaign_gating_decisions (
  id BIGSERIAL PRIMARY KEY,
  opportunity_id BIGINT NOT NULL REFERENCES opportunities(id) ON DELETE CASCADE,
  persona_id BIGINT NOT NULL REFERENCES personas(id) ON DELETE CASCADE,
  decision VARCHAR(50) NOT NULL
    CHECK (decision IN ('visible', 'blocked_no_profession', 'blocked_low_level', 'blocked_hidden')),
  reason TEXT,
  evaluated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_gating_decisions_opportunity ON campaign_gating_decisions(opportunity_id, evaluated_at DESC);
CREATE INDEX idx_gating_decisions_persona ON campaign_gating_decisions(persona_id, evaluated_at DESC);
CREATE INDEX idx_gating_decisions_decision ON campaign_gating_decisions(decision, evaluated_at DESC);

-- Helper function: check if persona can view opportunity (used by API layer)
CREATE OR REPLACE FUNCTION can_view_opportunity(
  p_persona_id BIGINT,
  p_opportunity_id BIGINT
) RETURNS JSONB AS $$
DECLARE
  v_gating_type TEXT;
  v_required_professions BIGINT[];
  v_required_logic TEXT;
  v_required_min_level INT;
  v_visibility TEXT;
  v_persona_professions TEXT[];
  v_persona_level INT;
  v_can_view BOOLEAN;
  v_reason TEXT;
BEGIN
  -- Fetch opportunity gating config
  SELECT gating_type, required_professions, required_professions_logic, required_min_level, visibility_for_non_matching
  INTO v_gating_type, v_required_professions, v_required_logic, v_required_min_level, v_visibility
  FROM opportunities WHERE id = p_opportunity_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('can_view', FALSE, 'reason', 'Opportunity not found');
  END IF;

  -- Fetch persona ValueSkins
  SELECT ARRAY_AGG(prof.id::text),
         (SELECT COALESCE(MAX(pp.level), 1) FROM persona_professions pp WHERE pp.persona_id = p_persona_id)
  INTO v_persona_professions, v_persona_level
  FROM persona_professions pp
  JOIN professions prof ON pp.profession_id = prof.id
  WHERE pp.persona_id = p_persona_id
    AND pp.is_active = TRUE;

  -- Default: no professions
  IF v_persona_professions IS NULL THEN
    v_persona_professions := ARRAY[]::TEXT[];
  END IF;

  -- Gating logic
  v_can_view := FALSE;
  v_reason := 'Default block';

  CASE v_gating_type
    WHEN 'any' THEN
      -- Creator must have at least 1 ValueSkin + meet level requirement
      IF ARRAY_LENGTH(v_persona_professions, 1) > 0 AND v_persona_level >= v_required_min_level THEN
        v_can_view := TRUE;
        v_reason := 'Has ValueSkin at required level';
      ELSE
        v_can_view := FALSE;
        v_reason := CASE
          WHEN ARRAY_LENGTH(v_persona_professions, 1) IS NULL OR ARRAY_LENGTH(v_persona_professions, 1) = 0
            THEN 'No ValueSkins (need at least one)'
          ELSE 'Level too low (need ' || v_required_min_level || '+)'
        END;
      END IF;

    WHEN 'specific' THEN
      -- Creator must have required professions
      -- AND logic: all required professions must be present
      -- OR logic: at least one required profession must be present
      IF v_required_logic = 'AND' THEN
        IF ARRAY_LENGTH(v_required_professions, 1) > 0
           AND v_required_professions <@ (
             SELECT ARRAY_AGG(profession_id::text) FROM persona_professions
             WHERE persona_id = p_persona_id AND is_active = TRUE
           )
           AND v_persona_level >= v_required_min_level
        THEN
          v_can_view := TRUE;
          v_reason := 'Has all required professions at required level';
        ELSE
          v_can_view := FALSE;
          v_reason := 'Missing required professions (AND logic)';
        END IF;
      ELSE -- OR logic
        IF ARRAY_LENGTH(v_required_professions, 1) > 0
           AND ARRAY_LENGTH(v_required_professions, 1) > 0
           AND (v_required_professions && (
             SELECT ARRAY_AGG(profession_id::text) FROM persona_professions
             WHERE persona_id = p_persona_id AND is_active = TRUE
           ))
           AND v_persona_level >= v_required_min_level
        THEN
          v_can_view := TRUE;
          v_reason := 'Has at least one required profession at required level';
        ELSE
          v_can_view := FALSE;
          v_reason := 'Missing required professions (OR logic)';
        END IF;
      END IF;

    WHEN 'professional' THEN
      -- Creator must meet professional underwriting tier (A-D)
      -- For MVP: assume A/B tiers can view, C/D cannot
      SELECT CASE
        WHEN risk_tier IN ('A', 'B') THEN TRUE
        ELSE FALSE
      END
      INTO v_can_view
      FROM creator_underwriting WHERE creator_user_id = (
        SELECT owner_user_id FROM personas WHERE id = p_persona_id
      );

      IF v_can_view IS NULL THEN
        v_can_view := FALSE;
      END IF;
      v_reason := CASE WHEN v_can_view THEN 'Professional tier eligible' ELSE 'Professional tier not eligible' END;
  END CASE;

  RETURN jsonb_build_object(
    'can_view', v_can_view,
    'reason', v_reason,
    'visibility_mode', v_visibility,
    'gating_type', v_gating_type
  );
END;
$$ LANGUAGE plpgsql STABLE;

-- Comment for documentation
COMMENT ON FUNCTION can_view_opportunity(BIGINT, BIGINT) IS
'Determines if a persona can view an opportunity based on gating rules. Returns JSONB with: can_view (bool), reason (text), visibility_mode (text), gating_type (text).';
