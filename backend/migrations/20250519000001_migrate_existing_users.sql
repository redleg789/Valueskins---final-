-- Migration: Existing Users → Unified Accounts
-- =============================================
-- This one-time migration creates Account records for every existing user
-- and links them appropriately. Run AFTER the 20250519000000 migration.

-- Step 1: Create accounts for all existing users
-- Uses email from user_settings if available, otherwise generates placeholder
DO $$
DECLARE
    user_rec RECORD;
    new_account_id BIGINT;
    account_email TEXT;
BEGIN
    FOR user_rec IN SELECT * FROM users WHERE account_id IS NULL LOOP
        -- Try to find an email (users may not have one in the current schema)
        -- In production, you'd join with an email table or auth_providers table
        account_email := 'legacy_' || user_rec.id || '@valueskins.app';

        INSERT INTO accounts (
            legacy_user_id,
            email,
            email_verified,
            display_name,
            avatar_url,
            is_active,
            onboarding_stage,
            created_at,
            last_login_at,
            login_count,
            updated_at
        ) VALUES (
            user_rec.id,
            account_email,
            TRUE,  -- Legacy users are considered verified
            user_rec.display_name,
            user_rec.avatar_url,
            user_rec.is_active,
            'complete',  -- Legacy users skip onboarding
            user_rec.created_at,
            user_rec.last_login_at,
            0,
            NOW()
        )
        RETURNING id INTO new_account_id;

        -- Link back to users table
        UPDATE users SET account_id = new_account_id WHERE id = user_rec.id;

        -- Step 2: Activate modules based on current role
        IF user_rec.role = 'creator' THEN
            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'valueskin', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;

            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'explorer', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;
        END IF;

        IF user_rec.role = 'brand' THEN
            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'brand', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;

            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'explorer', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;
        END IF;

        IF user_rec.role = 'explorer' THEN
            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'explorer', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;
        END IF;

        IF user_rec.role = 'host' THEN
            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'host', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;

            INSERT INTO user_modules (account_id, module_code, is_active)
            VALUES (new_account_id, 'explorer', TRUE)
            ON CONFLICT (account_id, module_code) DO NOTHING;
        END IF;
    END LOOP;
END $$;

-- Verify migration
DO $$
DECLARE
    user_count INT;
    account_count INT;
    orphan_count INT;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO account_count FROM accounts;
    SELECT COUNT(*) INTO orphan_count FROM users WHERE account_id IS NULL;

    RAISE NOTICE 'Users: %, Accounts: %, Orphans: %', user_count, account_count, orphan_count;

    IF orphan_count > 0 THEN
        RAISE WARNING 'There are % users without accounts — manual migration may be needed', orphan_count;
    END IF;
END $$;
