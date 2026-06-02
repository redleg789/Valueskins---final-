/**
 * VALUESKINS IDENTITY ATTESTATION PROTOCOL (VIAP) v1.0
 * ══════════════════════════════════════════════════════════════════════
 *
 * A comprehensive system and method for creating, verifying, managing,
 * displaying, monetizing, and federating portable professional identity
 * attestation artifacts across digital social presence platforms.
 *
 * PROTOCOL SCOPE:
 *   This module defines the core data structures, constraint governance,
 *   authenticity computation, serialization protocol, opportunity discovery,
 *   reputation scoring, and display configuration for the Valueskins
 *   Identity Attestation Protocol.
 *
 * TERMINOLOGY:
 *   - Identity Attestation:      A verifiable professional identity claim
 *   - Attestation Category:      A typed classification slot for attestations
 *   - Authenticity Index:        A composite trust score with temporal decay
 *   - Peer Attestation Signal:   An endorsement from another verified user
 *   - Integrity Digest:          A deterministic fingerprint of attestation data
 *   - Platform Binding:          A cross-platform identity linkage
 *   - Governance Rule:           A constraint that controls attestation assignment
 *   - Professional Narrative:    A credential-linked explanatory text
 *   - Opportunity Signal:        A matchable business/career opportunity
 *   - Reputation Profile:        A multi-factor composite reliability score
 */

// ═══════════════════════════════════════════════════════════════════════
// §1  ATTESTATION CATEGORY TAXONOMY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Attestation categories classify identity claims into purpose-driven
 * slots. Each category represents a distinct facet of a user's
 * professional or personal identity.
 *
 * The system enforces mutual exclusivity within categories while
 * permitting concurrent attestations across categories.
 */
export type AttestationCategory =
  | 'vocational'     // primary professional identity
  | 'aspirational'   // passion-driven identity
  | 'avocational';   // recreational/hobby identity

export const CATEGORY_LABELS: Record<AttestationCategory, string> = {
  vocational:   'Profession',
  aspirational: 'Passion',
  avocational:  'Hobby',
};

export const CATEGORY_DISPLAY_ORDER: AttestationCategory[] = [
  'vocational',
  'aspirational',
  'avocational',
];

// ═══════════════════════════════════════════════════════════════════════
// §2  VERIFICATION SOURCE HIERARCHY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Verification sources form a trust hierarchy. Higher-authority sources
 * produce higher base authenticity indices. The system supports
 * progressive verification — an attestation can be upgraded from
 * self-declared to employer-attested without losing provenance history.
 */
export type VerificationAuthority =
  | 'self_declared'          // user claims without external proof
  | 'peer_endorsed'          // validated by other platform users
  | 'employer_attested'      // confirmed by employing organization
  | 'institution_verified'   // validated by educational/professional body
  | 'credential_authority';  // issued by a recognized credentialing entity

export const AUTHORITY_TRUST_WEIGHTS: Record<VerificationAuthority, number> = {
  self_declared:         0.30,
  peer_endorsed:         0.50,
  employer_attested:     0.80,
  institution_verified:  0.90,
  credential_authority:  1.00,
};

// ═══════════════════════════════════════════════════════════════════════
// §3  IDENTITY ATTESTATION ARTIFACT
// ═══════════════════════════════════════════════════════════════════════

/**
 * The fundamental unit of the protocol. Each attestation represents a
 * single verifiable professional identity claim, complete with
 * provenance chain, trust scoring, endorsement graph, platform bindings,
 * accountability mechanisms, and performance telemetry.
 */
export interface IdentityAttestation {
  // ── Core Identity ──────────────────────────────────────────────────
  attestationId: string;
  category: AttestationCategory;
  professionalDomain: string;       // e.g. "Software Engineer"
  displayDesignation: string;       // e.g. "SWE"

  // ── Provenance Chain ───────────────────────────────────────────────
  integrityDigest: string;          // deterministic fingerprint
  issuedAt: number;                 // creation timestamp (ms)
  lastVerifiedAt: number;           // most recent verification (ms)
  expiresAt: number | null;         // null = no forced expiry

  // ── Authenticity Scoring ───────────────────────────────────────────
  authenticityIndex: number;        // 0.0–1.0 composite trust score
  temporalDecayCoefficient: number; // daily decay rate
  verificationAuthority: VerificationAuthority;

  // ── Peer Attestation Graph ─────────────────────────────────────────
  peerAttestations: PeerAttestationSignal[];

  // ── Multi-Platform Identity Federation ─────────────────────────────
  platformBindings: PlatformIdentityBinding[];

  // ── Reputation Collateralization ───────────────────────────────────
  stakeWeight: number;              // reputation at risk (0.0–1.0)
  disputeRecords: DisputeRecord[];

  // ── Attestation Invalidation ───────────────────────────────────────
  revoked: boolean;
  revokedAt: number | null;
  revocationReason: string | null;

  // ── Delegated Issuance ─────────────────────────────────────────────
  issuerId: string | null;          // null = self-issued
  issuerAuthority: VerificationAuthority;

  // ── Professional Narrative ─────────────────────────────────────────
  professionalNarrative: string;    // credential-linked explanatory text

  // ── Performance Telemetry ──────────────────────────────────────────
  performanceTelemetry: AttestationTelemetry;

  // ── Lineage Progression ────────────────────────────────────────────
  lineage: AttestationLineageEntry[];
}

// ═══════════════════════════════════════════════════════════════════════
// §4  PEER ATTESTATION SIGNAL
// ═══════════════════════════════════════════════════════════════════════

/**
 * A peer attestation signal is a weighted endorsement from another
 * verified user. Signals accumulate to increase the attestation's
 * authenticity index. The relationship type and endorser's own
 * authenticity influence the signal weight.
 */
export interface PeerAttestationSignal {
  endorserId: string;
  endorserPlatform: string;
  signalTimestamp: number;
  signalWeight: number;             // 0.0–1.0
  endorserAuthenticityAtTime: number;
  relationship:
    | 'professional_colleague'
    | 'direct_supervisor'
    | 'client_counterparty'
    | 'industry_peer'
    | 'institutional_representative';
}

// ═══════════════════════════════════════════════════════════════════════
// §5  MULTI-PLATFORM IDENTITY FEDERATION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Platform bindings link a single attestation to the user's presence
 * across multiple digital platforms. Each binding is independently
 * verifiable and carries its own integrity digest.
 */
export interface PlatformIdentityBinding {
  platformIdentifier: string;       // e.g. "instagram", "linkedin"
  profileUri: string;
  boundAt: number;
  verifiedAt: number | null;
  bindingDigest: string;
  bindingStatus: 'active' | 'suspended' | 'expired';
}

// ═══════════════════════════════════════════════════════════════════════
// §6  DISPUTE & ACCOUNTABILITY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Dispute records track challenges to attestation validity. Open disputes
 * reduce the authenticity index. Resolved disputes permanently affect the
 * attestation's trust history.
 */
export interface DisputeRecord {
  disputeId: string;
  raisedAt: number;
  raisedBy: string;
  category: 'accuracy' | 'fraud' | 'expired_claim' | 'misrepresentation';
  status: 'open' | 'resolved_valid' | 'resolved_invalid' | 'dismissed';
  resolutionTimestamp: number | null;
  authenticityImpact: number;       // negative number = trust reduction
}

// ═══════════════════════════════════════════════════════════════════════
// §7  PERFORMANCE TELEMETRY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Per-attestation analytics tracking how the credential performs across
 * the platform — impressions, engagement, opportunity matches, and
 * trust trend over time.
 */
export interface AttestationTelemetry {
  totalImpressions: number;
  profileInspections: number;
  narrativeEngagements: number;
  opportunityMatches: number;
  endorsementSolicitations: number;
  trustTrend: TrustTrendDataPoint[];
}

export interface TrustTrendDataPoint {
  timestamp: number;
  authenticityIndex: number;
  triggerEvent:
    | 'initial_issuance'
    | 'verification_upgrade'
    | 'peer_endorsement'
    | 'temporal_decay'
    | 'dispute_opened'
    | 'dispute_resolved'
    | 'renewal'
    | 'authority_upgrade';
}

// ═══════════════════════════════════════════════════════════════════════
// §8  ATTESTATION LINEAGE PROGRESSION
// ═══════════════════════════════════════════════════════════════════════

/**
 * Tracks the upgrade history of an attestation. When a user progresses
 * from "Junior Developer" to "Senior Developer", the lineage preserves
 * the full credential evolution without losing provenance.
 */
export interface AttestationLineageEntry {
  previousDomain: string;
  previousDesignation: string;
  transitionedAt: number;
  transitionReason: 'upgrade' | 'lateral_move' | 'specialization' | 'correction';
  previousAuthenticityIndex: number;
}

// ═══════════════════════════════════════════════════════════════════════
// §9  ATTESTATION GOVERNANCE ENGINE
// ═══════════════════════════════════════════════════════════════════════

/**
 * The governance engine enforces rules about which attestations can
 * coexist, how many are permitted, prerequisites, incompatibilities,
 * temporal locks, and minimum authenticity thresholds.
 *
 * This engine is configurable — platforms can define their own
 * governance rulesets while using the same protocol.
 */
export type GovernanceRuleType =
  | 'mutual_exclusivity'       // one attestation per category
  | 'category_capacity'        // max N attestations in a category
  | 'global_capacity'          // max N attestations total
  | 'prerequisite_dependency'  // must hold X before claiming Y
  | 'incompatibility'          // X and Y cannot coexist
  | 'temporal_lock'            // cannot change within N days
  | 'authenticity_threshold'   // minimum trust score to hold
  | 'endorsement_minimum'      // minimum peer attestations required
  | 'authority_requirement';   // minimum verification authority level

export interface GovernanceRule {
  ruleId: string;
  type: GovernanceRuleType;
  parameters: Record<string, unknown>;
  enforcement: 'blocking' | 'advisory';
  description: string;
}

export interface GovernanceViolation {
  ruleId: string;
  type: GovernanceRuleType;
  message: string;
  severity: 'blocking' | 'warning';
  suggestedResolution: string | null;
}

// ═══════════════════════════════════════════════════════════════════════
// §10  CREDENTIAL SERIALIZATION & FEDERATION PROTOCOL
// ═══════════════════════════════════════════════════════════════════════

/**
 * The serialization protocol defines how attestations are packaged
 * for cross-platform federation. A CredentialDocument is a signed,
 * self-contained bundle that any compliant platform can validate.
 */
export interface CredentialDocument {
  protocolVersion: string;
  documentId: string;
  serializedAt: number;
  issuerIdentifier: string;
  subjectIdentifier: string;
  attestations: IdentityAttestation[];
  documentDigest: string;
  federationEndpoint: string | null;
  governanceRuleset: GovernanceRule[];
}

// ═══════════════════════════════════════════════════════════════════════
// §11  CREDENTIAL-MEDIATED OPPORTUNITY DISCOVERY
// ═══════════════════════════════════════════════════════════════════════

/**
 * The opportunity discovery engine matches user attestations against
 * available opportunities (brand deals, jobs, collaborations) using
 * domain relevance, authenticity thresholds, and platform scope.
 */
export interface OpportunitySignal {
  opportunityId: string;
  requiredDomains: string[];
  minimumAuthenticityIndex: number;
  compensationRange: [number, number];
  platformScope: string[];
  categoryPreference: AttestationCategory | null;
}

export interface OpportunityMatch {
  opportunityId: string;
  relevanceScore: number;
  matchedAttestationIds: string[];
  confidenceLevel: number;
  matchFactors: {
    domainCoverage: number;
    authenticityAlignment: number;
    categoryFit: number;
  };
}

// ═══════════════════════════════════════════════════════════════════════
// §12  COMPOSITE REPUTATION SCORING
// ═══════════════════════════════════════════════════════════════════════

/**
 * The reputation engine computes a multi-factor composite reliability
 * score from weighted engagement signals, transaction history,
 * fulfillment metrics, and credential authenticity data.
 *
 * Each factor uses a configurable normalizer (linear, logarithmic,
 * sigmoid, or step) and optional temporal decay half-life.
 */
export interface ReputationSignalFactor {
  factorId: string;
  signalSource: string;
  weight: number;
  normalizer: 'linear' | 'logarithmic' | 'sigmoid' | 'step';
  decayHalfLifeDays: number | null;   // null = no decay
}

export interface ReputationProfile {
  subjectId: string;
  compositeScore: number;
  reliabilityTier: number;
  factorBreakdown: {
    factorId: string;
    rawValue: number;
    normalizedValue: number;
    weightedContribution: number;
  }[];
  computedAt: number;
  validUntil: number;
}

// ═══════════════════════════════════════════════════════════════════════
// §13  CONTEXT-AWARE CREDENTIAL DISPLAY
// ═══════════════════════════════════════════════════════════════════════

/**
 * Display configuration defines how attestation artifacts are rendered
 * in response to user interaction. The system supports multiple trigger
 * gestures, display contexts, overlay behaviors, and visibility scopes.
 */
export type InteractionTrigger =
  | 'sustained_press'        // long-press / press-and-hold
  | 'repeated_tap'           // double-tap or multi-tap
  | 'directional_swipe'      // swipe gesture on profile element
  | 'pointer_hover'          // mouse/cursor hover
  | 'proximity_detection'    // NFC / Bluetooth proximity
  | 'contextual_automatic'   // auto-display based on viewing context
  | 'voice_invocation';      // voice command trigger

export type DisplayContext =
  | 'profile_overlay'        // overlaid on profile view
  | 'content_feed_inline'    // shown inline in feed items
  | 'direct_message_header'  // shown in DM conversation header
  | 'ephemeral_story'        // shown in stories/reels
  | 'external_embed'         // embedded on external websites
  | 'credential_document'    // standalone verifiable document
  | 'search_result_preview'; // shown in search results

export type OverlayBehavior =
  | 'replace_platform_avatar'   // replaces the platform's animated avatar
  | 'augment_profile_element'   // adds to existing profile UI
  | 'inline_badge_adjacency'    // badge next to username
  | 'floating_credential_card'  // hovering card with details
  | 'fullscreen_credential';    // full-screen credential viewer

export interface CredentialDisplayConfiguration {
  triggerGesture: InteractionTrigger;
  displayContext: DisplayContext;
  overlayBehavior: OverlayBehavior;
  visibilityScope: 'public' | 'connections_only' | 'verified_only' | 'mutual_only';
  animationProfile: string;
  dismissBehavior: 'tap_outside' | 'swipe_down' | 'timeout' | 'explicit_close';
}


// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════
//   PROTOCOL IMPLEMENTATION — ALGORITHMS & UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════
// ═══════════════════════════════════════════════════════════════════════


// ─── §A  Integrity Digest Generation ─────────────────────────────────

/**
 * Generates a deterministic integrity digest for an attestation artifact.
 * The digest is computed from the attestation's core identity fields,
 * provenance data, and issuer information, producing a unique fingerprint
 * that can be independently verified.
 */
export function generateIntegrityDigest(
  attestation: Pick<IdentityAttestation, 'professionalDomain' | 'displayDesignation' | 'category' | 'issuedAt' | 'issuerId'>
): string {
  const payload = [
    attestation.professionalDomain,
    attestation.displayDesignation,
    attestation.category,
    attestation.issuedAt.toString(),
    attestation.issuerId ?? 'self',
  ].join('|');

  // Deterministic hash — production would use SHA-256 or BLAKE3
  let hash = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < payload.length; i++) {
    hash ^= payload.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193); // FNV prime
  }
  const positiveHash = (hash >>> 0);
  return `viap_${positiveHash.toString(36)}_${attestation.issuedAt.toString(36)}`;
}


// ─── §B  Authenticity Index Computation with Temporal Decay ──────────

/**
 * Computes the composite authenticity index for an attestation. The index
 * is derived from verification authority weight, peer attestation signals,
 * temporal decay, dispute penalties, and reputation collateral.
 *
 * Formula:
 *   baseScore = authorityWeight + endorsementBoost
 *   decayedScore = baseScore * e^(-decayCoefficient * ageDays)
 *   finalScore = decayedScore - disputePenalty + stakeBonus
 *   clamp(finalScore, 0.0, 1.0)
 */
export function computeAuthenticityIndex(attestation: IdentityAttestation): number {
  if (attestation.revoked) return 0;

  const now = Date.now();
  const ageInDays = (now - attestation.lastVerifiedAt) / (86_400_000);

  // Base score from verification authority hierarchy
  let score = AUTHORITY_TRUST_WEIGHTS[attestation.verificationAuthority] ?? 0.30;

  // Peer attestation signal aggregation (capped at 0.30 boost)
  const endorsementBoost = Math.min(
    attestation.peerAttestations.reduce((sum, pa) => {
      // Weight endorsement by endorser's own authenticity at time of endorsement
      return sum + (pa.signalWeight * pa.endorserAuthenticityAtTime * 0.1);
    }, 0),
    0.30
  );
  score += endorsementBoost;

  // Temporal authenticity degradation
  const decayFactor = Math.exp(-attestation.temporalDecayCoefficient * ageInDays);
  score *= decayFactor;

  // Dispute penalty — open disputes reduce trust
  const openDisputePenalty = attestation.disputeRecords
    .filter(d => d.status === 'open')
    .reduce((sum, d) => sum + Math.abs(d.authenticityImpact), 0);
  score -= openDisputePenalty;

  // Resolved-invalid disputes permanently reduce trust
  const resolvedPenalty = attestation.disputeRecords
    .filter(d => d.status === 'resolved_invalid')
    .reduce((sum, d) => sum + Math.abs(d.authenticityImpact) * 0.5, 0);
  score -= resolvedPenalty;

  // Reputation collateral bonus — staking reputation increases trust
  score += attestation.stakeWeight * 0.10;

  // Platform binding bonus — more platforms = more verifiable
  const bindingBonus = Math.min(
    attestation.platformBindings.filter(b => b.bindingStatus === 'active').length * 0.03,
    0.12
  );
  score += bindingBonus;

  return Math.max(0, Math.min(1, score));
}


// ─── §C  Governance Engine — Constraint Validation ──────────────────

/**
 * Validates a candidate attestation against the governance ruleset.
 * Returns an array of violations. If any violation has severity
 * 'blocking', the attestation cannot be assigned.
 */
export function validateGovernanceRules(
  existingAttestations: IdentityAttestation[],
  candidateAttestation: IdentityAttestation,
  rules: GovernanceRule[]
): GovernanceViolation[] {
  const violations: GovernanceViolation[] = [];

  for (const rule of rules) {
    const params = rule.parameters as Record<string, any>;

    switch (rule.type) {
      case 'mutual_exclusivity': {
        const conflict = existingAttestations.find(
          a => a.category === candidateAttestation.category &&
               a.attestationId !== candidateAttestation.attestationId
        );
        if (conflict) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Category "${candidateAttestation.category}" is occupied by "${conflict.professionalDomain}"`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: `Remove "${conflict.professionalDomain}" first, or assign to a different category`,
          });
        }
        break;
      }

      case 'global_capacity': {
        const max = params.max ?? 3;
        const currentCount = existingAttestations.filter(
          a => a.attestationId !== candidateAttestation.attestationId
        ).length;
        if (currentCount >= max) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Maximum ${max} concurrent attestations reached`,
            severity: 'blocking',
            suggestedResolution: `Remove an existing attestation before adding a new one`,
          });
        }
        break;
      }

      case 'category_capacity': {
        const maxPerCategory = params.maxPerCategory ?? 1;
        const categoryCount = existingAttestations.filter(
          a => a.category === candidateAttestation.category &&
               a.attestationId !== candidateAttestation.attestationId
        ).length;
        if (categoryCount >= maxPerCategory) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Category "${candidateAttestation.category}" already has ${categoryCount} attestation(s)`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: null,
          });
        }
        break;
      }

      case 'incompatibility': {
        const pairs: [string, string][] = params.pairs ?? [];
        for (const [a, b] of pairs) {
          const candidateDomain = candidateAttestation.professionalDomain;
          if (
            (candidateDomain === a && existingAttestations.some(x => x.professionalDomain === b)) ||
            (candidateDomain === b && existingAttestations.some(x => x.professionalDomain === a))
          ) {
            violations.push({
              ruleId: rule.ruleId,
              type: rule.type,
              message: `"${a}" and "${b}" are incompatible attestations`,
              severity: 'blocking',
              suggestedResolution: `Remove the conflicting attestation first`,
            });
          }
        }
        break;
      }

      case 'prerequisite_dependency': {
        const required: string[] = params.requiredDomains ?? [];
        const existingDomains = new Set(existingAttestations.map(a => a.professionalDomain));
        const missing = required.filter(r => !existingDomains.has(r));
        if (missing.length > 0) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Prerequisites not met: ${missing.join(', ')}`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: `Acquire the prerequisite attestation(s) first`,
          });
        }
        break;
      }

      case 'temporal_lock': {
        const lockDays = params.days ?? 30;
        const lockMs = lockDays * 86_400_000;
        const recentInCategory = existingAttestations.find(
          a => a.category === candidateAttestation.category &&
               (Date.now() - a.issuedAt) < lockMs
        );
        if (recentInCategory) {
          const remainingDays = Math.ceil(
            (lockMs - (Date.now() - recentInCategory.issuedAt)) / 86_400_000
          );
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Category locked for ${remainingDays} more day(s)`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: `Wait ${remainingDays} day(s) before changing this category`,
          });
        }
        break;
      }

      case 'authenticity_threshold': {
        const minimum = params.minimum ?? 0.5;
        const candidateScore = computeAuthenticityIndex(candidateAttestation);
        if (candidateScore < minimum) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Authenticity index ${candidateScore.toFixed(2)} below minimum ${minimum}`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: `Increase verification level or obtain peer endorsements`,
          });
        }
        break;
      }

      case 'endorsement_minimum': {
        const minEndorsements = params.minimum ?? 1;
        if (candidateAttestation.peerAttestations.length < minEndorsements) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Requires at least ${minEndorsements} peer attestation(s)`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: `Request endorsements from professional peers`,
          });
        }
        break;
      }

      case 'authority_requirement': {
        const requiredAuthorities: VerificationAuthority[] = params.accepted ?? [];
        if (requiredAuthorities.length > 0 && !requiredAuthorities.includes(candidateAttestation.verificationAuthority)) {
          violations.push({
            ruleId: rule.ruleId,
            type: rule.type,
            message: `Verification authority "${candidateAttestation.verificationAuthority}" not accepted`,
            severity: rule.enforcement === 'blocking' ? 'blocking' : 'warning',
            suggestedResolution: `Upgrade verification to one of: ${requiredAuthorities.join(', ')}`,
          });
        }
        break;
      }
    }
  }

  return violations;
}


// ─── §D  Credential Serialization & Federation ──────────────────────

/**
 * Serializes attestations into a portable, self-contained credential
 * document that can be imported and validated by any compliant platform.
 */
export function serializeCredentialDocument(
  subjectId: string,
  attestations: IdentityAttestation[],
  governanceRules: GovernanceRule[],
  federationEndpoint?: string
): CredentialDocument {
  const activeAttestations = attestations.filter(a => !a.revoked);
  const doc: CredentialDocument = {
    protocolVersion: '1.0.0',
    documentId: `vsdoc_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    serializedAt: Date.now(),
    issuerIdentifier: 'valueskins-identity-attestation-protocol',
    subjectIdentifier: subjectId,
    attestations: activeAttestations,
    documentDigest: '',
    federationEndpoint: federationEndpoint ?? null,
    governanceRuleset: governanceRules,
  };
  doc.documentDigest = generateIntegrityDigest({
    professionalDomain: doc.documentId,
    displayDesignation: 'DOC',
    category: 'vocational',
    issuedAt: doc.serializedAt,
    issuerId: doc.issuerIdentifier,
  });
  return doc;
}

/**
 * Deserializes and validates an imported credential document.
 * Checks protocol version, structural integrity, expiry, revocation,
 * and digest consistency.
 */
export function deserializeAndValidateDocument(document: CredentialDocument): {
  valid: boolean;
  errors: string[];
  warnings: string[];
  attestations: IdentityAttestation[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];

  if (!document.protocolVersion) errors.push('Missing protocol version');
  if (!document.protocolVersion?.startsWith('1.')) warnings.push('Protocol version may not be fully compatible');
  if (!document.subjectIdentifier) errors.push('Missing subject identifier');
  if (!document.documentDigest) errors.push('Missing document integrity digest');
  if (!document.attestations?.length) errors.push('Document contains no attestations');

  const now = Date.now();
  for (const att of document.attestations ?? []) {
    if (!att.attestationId) errors.push('Attestation missing ID');
    if (!att.integrityDigest) errors.push(`Attestation ${att.attestationId}: missing integrity digest`);
    if (att.revoked) warnings.push(`Attestation ${att.attestationId}: revoked`);
    if (att.expiresAt && att.expiresAt < now) errors.push(`Attestation ${att.attestationId}: expired`);
    if (att.issuedAt > now) warnings.push(`Attestation ${att.attestationId}: issued in the future`);
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    attestations: (document.attestations ?? []).filter(a => !a.revoked),
  };
}


// ─── §E  Credential-Mediated Opportunity Discovery ──────────────────

/**
 * Matches a user's attestation portfolio against available opportunity
 * signals. Produces ranked matches based on domain coverage,
 * authenticity alignment, and category fit.
 */
export function discoverOpportunities(
  attestations: IdentityAttestation[],
  opportunities: OpportunitySignal[]
): OpportunityMatch[] {
  const activeAttestations = attestations.filter(a => !a.revoked);

  return opportunities
    .map(opp => {
      const matched = activeAttestations.filter(att => {
        const domainMatch = opp.requiredDomains.includes(att.professionalDomain);
        const authenticityMet = computeAuthenticityIndex(att) >= opp.minimumAuthenticityIndex;
        const categoryMatch = !opp.categoryPreference || att.category === opp.categoryPreference;
        return domainMatch && authenticityMet && categoryMatch;
      });

      if (matched.length === 0) return null;

      const domainCoverage = matched.length / opp.requiredDomains.length;
      const avgAuthenticity = matched.reduce(
        (sum, a) => sum + computeAuthenticityIndex(a), 0
      ) / matched.length;
      const categoryFit = opp.categoryPreference
        ? (matched.some(a => a.category === opp.categoryPreference) ? 1.0 : 0.5)
        : 1.0;

      const relevanceScore = domainCoverage * 0.45 + avgAuthenticity * 0.35 + categoryFit * 0.20;

      return {
        opportunityId: opp.opportunityId,
        relevanceScore,
        matchedAttestationIds: matched.map(a => a.attestationId),
        confidenceLevel: Math.min(domainCoverage, avgAuthenticity),
        matchFactors: { domainCoverage, authenticityAlignment: avgAuthenticity, categoryFit },
      };
    })
    .filter((m): m is OpportunityMatch => m !== null)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
}


// ─── §F  Composite Reputation Scoring ───────────────────────────────

/**
 * Computes a multi-factor composite reliability profile from weighted
 * engagement signals, each processed through a configurable normalizer
 * and optional temporal decay.
 */
export function computeReputationProfile(
  subjectId: string,
  factors: ReputationSignalFactor[],
  signals: Record<string, number>
): ReputationProfile {
  const factorBreakdown = factors.map(factor => {
    const rawValue = signals[factor.signalSource] ?? 0;
    let normalizedValue: number;

    switch (factor.normalizer) {
      case 'logarithmic':
        normalizedValue = rawValue > 0 ? Math.min(1, Math.log10(rawValue + 1) / 6) : 0;
        break;
      case 'sigmoid':
        normalizedValue = 1 / (1 + Math.exp(-0.05 * (rawValue - 50)));
        break;
      case 'step':
        normalizedValue = rawValue > 0 ? 1 : 0;
        break;
      default: // linear
        normalizedValue = Math.min(1, rawValue / 100);
    }

    // Apply temporal decay if configured
    if (factor.decayHalfLifeDays !== null) {
      const decayMultiplier = Math.pow(0.5, 1 / factor.decayHalfLifeDays);
      normalizedValue *= decayMultiplier;
    }

    return {
      factorId: factor.factorId,
      rawValue,
      normalizedValue,
      weightedContribution: normalizedValue * (factor.weight / 100),
    };
  });

  const compositeScore = factorBreakdown.reduce(
    (sum, f) => sum + f.weightedContribution, 0
  );

  const tierThresholds = [0.20, 0.40, 0.60, 0.80];
  const reliabilityTier = tierThresholds.filter(t => compositeScore > t).length + 1;

  return {
    subjectId,
    compositeScore: Math.min(1, compositeScore),
    reliabilityTier,
    factorBreakdown,
    computedAt: Date.now(),
    validUntil: Date.now() + 86_400_000, // 24h validity window
  };
}


// ─── §G  Attestation Lifecycle Operations ───────────────────────────

/**
 * Creates a new attestation artifact from basic parameters.
 * Automatically generates integrity digest and initializes all
 * protocol-required fields.
 */
export function createAttestation(
  userId: string,
  category: AttestationCategory,
  professionalDomain: string,
  displayDesignation: string,
  narrative: string,
  verificationAuthority: VerificationAuthority = 'self_declared'
): IdentityAttestation {
  const now = Date.now();
  const attestation: IdentityAttestation = {
    attestationId: `att_${now.toString(36)}_${Math.random().toString(36).slice(2, 10)}`,
    category,
    professionalDomain,
    displayDesignation,
    integrityDigest: '',
    issuedAt: now,
    lastVerifiedAt: now,
    expiresAt: null,
    authenticityIndex: AUTHORITY_TRUST_WEIGHTS[verificationAuthority],
    temporalDecayCoefficient: 0.001,
    verificationAuthority,
    peerAttestations: [],
    platformBindings: [],
    stakeWeight: 0.10,
    disputeRecords: [],
    revoked: false,
    revokedAt: null,
    revocationReason: null,
    issuerId: null,
    issuerAuthority: verificationAuthority,
    professionalNarrative: narrative,
    performanceTelemetry: {
      totalImpressions: 0,
      profileInspections: 0,
      narrativeEngagements: 0,
      opportunityMatches: 0,
      endorsementSolicitations: 0,
      trustTrend: [{ timestamp: now, authenticityIndex: AUTHORITY_TRUST_WEIGHTS[verificationAuthority], triggerEvent: 'initial_issuance' }],
    },
    lineage: [],
  };
  attestation.integrityDigest = generateIntegrityDigest(attestation);
  return attestation;
}

/**
 * Revokes an attestation, zeroing its authenticity and recording
 * the invalidation reason and timestamp.
 */
export function revokeAttestation(
  attestation: IdentityAttestation,
  reason: string
): IdentityAttestation {
  return {
    ...attestation,
    revoked: true,
    revokedAt: Date.now(),
    revocationReason: reason,
    authenticityIndex: 0,
  };
}

/**
 * Records a peer attestation signal on an existing attestation,
 * adding to the endorsement graph.
 */
export function addPeerAttestationSignal(
  attestation: IdentityAttestation,
  signal: PeerAttestationSignal
): IdentityAttestation {
  return {
    ...attestation,
    peerAttestations: [...attestation.peerAttestations, signal],
  };
}

/**
 * Binds an attestation to a new platform identity, establishing
 * cross-platform federation for the credential.
 */
export function bindAttestationToPlatform(
  attestation: IdentityAttestation,
  platformIdentifier: string,
  profileUri: string
): IdentityAttestation {
  const binding: PlatformIdentityBinding = {
    platformIdentifier,
    profileUri,
    boundAt: Date.now(),
    verifiedAt: null,
    bindingDigest: generateIntegrityDigest({
      professionalDomain: `${platformIdentifier}:${profileUri}`,
      displayDesignation: 'BIND',
      category: attestation.category,
      issuedAt: Date.now(),
      issuerId: attestation.attestationId,
    }),
    bindingStatus: 'active',
  };
  return {
    ...attestation,
    platformBindings: [...attestation.platformBindings, binding],
  };
}

/**
 * Upgrades an attestation's professional domain while preserving
 * the lineage chain. Used when a user progresses in their career.
 */
export function upgradeAttestationDomain(
  attestation: IdentityAttestation,
  newDomain: string,
  newDesignation: string,
  reason: AttestationLineageEntry['transitionReason'] = 'upgrade'
): IdentityAttestation {
  const lineageEntry: AttestationLineageEntry = {
    previousDomain: attestation.professionalDomain,
    previousDesignation: attestation.displayDesignation,
    transitionedAt: Date.now(),
    transitionReason: reason,
    previousAuthenticityIndex: computeAuthenticityIndex(attestation),
  };
  const upgraded: IdentityAttestation = {
    ...attestation,
    professionalDomain: newDomain,
    displayDesignation: newDesignation,
    lineage: [...attestation.lineage, lineageEntry],
    lastVerifiedAt: Date.now(),
  };
  upgraded.integrityDigest = generateIntegrityDigest(upgraded);
  return upgraded;
}

/**
 * Files a dispute against an attestation, recording the challenge
 * and applying an immediate trust penalty.
 */
export function fileDispute(
  attestation: IdentityAttestation,
  disputeCategory: DisputeRecord['category'],
  raisedBy: string
): IdentityAttestation {
  const dispute: DisputeRecord = {
    disputeId: `dsp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`,
    raisedAt: Date.now(),
    raisedBy,
    category: disputeCategory,
    status: 'open',
    resolutionTimestamp: null,
    authenticityImpact: -0.15,
  };
  return {
    ...attestation,
    disputeRecords: [...attestation.disputeRecords, dispute],
  };
}

/**
 * Records an impression/interaction on an attestation's telemetry.
 */
export function recordTelemetryEvent(
  attestation: IdentityAttestation,
  eventType: keyof Omit<AttestationTelemetry, 'trustTrend'>
): IdentityAttestation {
  return {
    ...attestation,
    performanceTelemetry: {
      ...attestation.performanceTelemetry,
      [eventType]: attestation.performanceTelemetry[eventType] + 1,
    },
  };
}


// ═══════════════════════════════════════════════════════════════════════
// §H  DEFAULT PROTOCOL CONFIGURATION
// ═══════════════════════════════════════════════════════════════════════

export const DEFAULT_GOVERNANCE_RULES: GovernanceRule[] = [
  {
    ruleId: 'gov_mutual_exclusivity',
    type: 'mutual_exclusivity',
    parameters: {},
    enforcement: 'blocking',
    description: 'Each attestation category may hold at most one active attestation',
  },
  {
    ruleId: 'gov_global_capacity',
    type: 'global_capacity',
    parameters: { max: 3 },
    enforcement: 'blocking',
    description: 'A user may hold at most 3 concurrent attestations',
  },
  {
    ruleId: 'gov_temporal_lock',
    type: 'temporal_lock',
    parameters: { days: 7 },
    enforcement: 'advisory',
    description: 'Changing a category is discouraged within 7 days of last assignment',
  },
];

export const DEFAULT_REPUTATION_FACTORS: ReputationSignalFactor[] = [
  { factorId: 'audience_reach',         signalSource: 'followers',            weight: 20, normalizer: 'logarithmic', decayHalfLifeDays: null },
  { factorId: 'engagement_quality',     signalSource: 'engagementRate',       weight: 25, normalizer: 'sigmoid',      decayHalfLifeDays: 90 },
  { factorId: 'transaction_volume',     signalSource: 'dealsCompleted',       weight: 20, normalizer: 'logarithmic', decayHalfLifeDays: null },
  { factorId: 'fulfillment_reliability',signalSource: 'onTimeRate',           weight: 15, normalizer: 'linear',       decayHalfLifeDays: null },
  { factorId: 'counterparty_rating',    signalSource: 'brandRating',          weight: 10, normalizer: 'linear',       decayHalfLifeDays: 180 },
  { factorId: 'attestation_strength',   signalSource: 'avgAuthenticityIndex', weight: 10, normalizer: 'linear',       decayHalfLifeDays: null },
];

export const DEFAULT_DISPLAY_CONFIG: CredentialDisplayConfiguration = {
  triggerGesture: 'sustained_press',
  displayContext: 'profile_overlay',
  overlayBehavior: 'replace_platform_avatar',
  visibilityScope: 'public',
  animationProfile: 'fade_scale',
  dismissBehavior: 'tap_outside',
};


// ═══════════════════════════════════════════════════════════════════════
// §I  BRIDGE — ValueSkinEntry ↔ IdentityAttestation
// ═══════════════════════════════════════════════════════════════════════

/**
 * Converts a legacy ValueSkinEntry (used by UI components) into a
 * full IdentityAttestation artifact with protocol-compliant fields.
 *
 * This bridge allows the existing UI to remain unchanged while the
 * underlying credential system operates on the full protocol.
 */
export function entryToAttestation(
  userId: string,
  slotType: 'hobby' | 'passion' | 'profession',
  profession: string,
  designation: string,
  aboutMe: string
): IdentityAttestation {
  const categoryMap: Record<string, AttestationCategory> = {
    hobby: 'avocational',
    passion: 'aspirational',
    profession: 'vocational',
  };
  return createAttestation(
    userId,
    categoryMap[slotType],
    profession,
    designation,
    aboutMe,
    'self_declared'
  );
}

/**
 * Extracts the UI-facing fields from an IdentityAttestation for
 * rendering in ValueSkinStickers, AboutMePanel, etc.
 */
export function attestationToEntry(attestation: IdentityAttestation): {
  profession: string;
  aboutMe: string;
} {
  return {
    profession: attestation.professionalDomain,
    aboutMe: attestation.professionalNarrative,
  };
}
