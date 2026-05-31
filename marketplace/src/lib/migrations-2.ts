import { query } from './db-pool';

export async function runMigrations2() {
  const migrations = [
    {
      name: 'add_email_verification_table',
      sql: `
        CREATE TABLE IF NOT EXISTS email_verifications (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          token TEXT UNIQUE NOT NULL,
          expires_at TIMESTAMPTZ NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    },
    {
      name: 'add_email_verified_column',
      sql: `
        ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT FALSE;
      `,
    },
    {
      name: 'add_user_email_preferences',
      sql: `
        CREATE TABLE IF NOT EXISTS user_email_preferences (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          marketing BOOLEAN DEFAULT FALSE,
          notifications BOOLEAN DEFAULT TRUE,
          product_updates BOOLEAN DEFAULT TRUE,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    },
    {
      name: 'add_deletion_queue_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deletion_queue (
          user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          requested_at TIMESTAMPTZ DEFAULT NOW(),
          deletion_deadline TIMESTAMPTZ NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          completed_at TIMESTAMPTZ
        );
      `,
    },
    {
      name: 'add_audit_logs_table',
      sql: `
        CREATE TABLE IF NOT EXISTS audit_logs (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          operation VARCHAR(50) NOT NULL,
          table_name VARCHAR(255) NOT NULL,
          user_id UUID,
          resource_id TEXT,
          old_values JSONB,
          new_values JSONB,
          ip_address INET,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE SET NULL
        );
        CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
        CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);
      `,
    },
  ];

  for (const migration of migrations) {
    try {
      await query(migration.sql);
      console.log(`Migration: ${migration.name}`);
    } catch (error) {
      console.log(`Migration ${migration.name} already applied or skipped`);
    }
  }
}
