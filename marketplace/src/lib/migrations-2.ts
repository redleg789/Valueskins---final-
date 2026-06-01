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

export async function addRemindersTables() {
  const migrations = [
    {
      name: 'create_deal_reminders_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deal_reminders (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          deal_id TEXT NOT NULL,
          type VARCHAR(50) NOT NULL,
          reminder_date TIMESTAMPTZ NOT NULL,
          reminded_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, deal_id, type)
        );
        CREATE INDEX IF NOT EXISTS idx_deal_reminders_user_date ON deal_reminders(user_id, reminder_date);
      `,
    },
    {
      name: 'create_deal_files_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deal_files (
          id UUID PRIMARY KEY,
          deal_id TEXT NOT NULL,
          file_name VARCHAR(255) NOT NULL,
          file_url TEXT NOT NULL,
          uploaded_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    },
    {
      name: 'add_content_calendar_column',
      sql: `
        ALTER TABLE deals ADD COLUMN IF NOT EXISTS 
        content_due_date TIMESTAMPTZ;
      `,
    },
  ];

  for (const migration of migrations) {
    try {
      await query(migration.sql);
    } catch (error) {
      console.log(`Migration ${migration.name} skipped or already applied`);
    }
  }
}

    {
      name: 'create_deal_escrow_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deal_escrow (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deal_id TEXT NOT NULL UNIQUE,
          razorpay_order_id VARCHAR(255) NOT NULL UNIQUE,
          razorpay_payment_id VARCHAR(255),
          amount DECIMAL(10, 2) NOT NULL,
          status VARCHAR(50) DEFAULT 'pending',
          created_at TIMESTAMPTZ DEFAULT NOW(),
          released_at TIMESTAMPTZ,
          refunded_at TIMESTAMPTZ
        );
        CREATE INDEX IF NOT EXISTS idx_deal_escrow_deal_id ON deal_escrow(deal_id);
      `,
    },
    {
      name: 'create_deal_payments_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deal_payments (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deal_id TEXT NOT NULL,
          amount DECIMAL(10, 2) NOT NULL,
          payment_date TIMESTAMPTZ,
          status VARCHAR(50),
          transaction_id VARCHAR(255),
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_deal_payments_deal_id ON deal_payments(deal_id);
      `,
    },

    {
      name: 'create_brand_verification_table',
      sql: `
        CREATE TABLE IF NOT EXISTS brand_verification (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          brand_id TEXT NOT NULL UNIQUE,
          email VARCHAR(255) NOT NULL,
          domain VARCHAR(255),
          status VARCHAR(50) DEFAULT 'pending',
          verified_at TIMESTAMPTZ,
          submitted_at TIMESTAMPTZ DEFAULT NOW()
        );
      `,
    },
    {
      name: 'create_brand_locations_table',
      sql: `
        CREATE TABLE IF NOT EXISTS brand_locations (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          location_id TEXT NOT NULL UNIQUE,
          parent_brand_id TEXT NOT NULL,
          name VARCHAR(255) NOT NULL,
          city VARCHAR(100),
          balance DECIMAL(10, 2) DEFAULT 0,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_brand_locations_parent ON brand_locations(parent_brand_id);
      `,
    },
    {
      name: 'create_user_value_skins_table',
      sql: `
        CREATE TABLE IF NOT EXISTS user_value_skins (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          value_skin VARCHAR(100) NOT NULL,
          purchased_at TIMESTAMPTZ DEFAULT NOW(),
          UNIQUE(user_id, value_skin)
        );
        CREATE INDEX IF NOT EXISTS idx_user_value_skins ON user_value_skins(user_id);
      `,
    },
    {
      name: 'create_deal_reviews_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deal_reviews (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deal_id TEXT NOT NULL,
          reviewer_id TEXT NOT NULL,
          rating INT DEFAULT 5,
          comment TEXT,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_deal_reviews_deal_id ON deal_reviews(deal_id);
      `,
    },
    {
      name: 'create_deal_messages_table',
      sql: `
        CREATE TABLE IF NOT EXISTS deal_messages (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          deal_id TEXT NOT NULL,
          sender_id TEXT NOT NULL,
          message TEXT NOT NULL,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_deal_messages_deal_id ON deal_messages(deal_id);
      `,
    },

    {
      name: 'create_notifications_table',
      sql: `
        CREATE TABLE IF NOT EXISTS notifications (
          id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
          user_id TEXT NOT NULL,
          title VARCHAR(255) NOT NULL,
          message TEXT,
          type VARCHAR(50),
          read_at TIMESTAMPTZ,
          created_at TIMESTAMPTZ DEFAULT NOW()
        );
        CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
        CREATE INDEX IF NOT EXISTS idx_notifications_read ON notifications(read_at);
      `,
    },
    {
      name: 'update_deals_add_value_skin_and_archived',
      sql: `
        ALTER TABLE deals 
        ADD COLUMN IF NOT EXISTS value_skin VARCHAR(100),
        ADD COLUMN IF NOT EXISTS archived BOOLEAN DEFAULT FALSE;
      `,
    },
