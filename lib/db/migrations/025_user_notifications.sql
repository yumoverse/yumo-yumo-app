-- Migration: user_notifications for "ek maliyet tespit edildi" and other in-app notifications
-- Neon SQL Editor'da bu dosyanın içeriğini çalıştırın.

CREATE TABLE IF NOT EXISTS user_notifications (
  id SERIAL PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  type VARCHAR(64) NOT NULL,
  title TEXT,
  body TEXT,
  payload JSONB DEFAULT '{}',
  receipt_id TEXT REFERENCES receipts(receipt_id) ON DELETE SET NULL,
  read_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT now()
);

COMMENT ON TABLE user_notifications IS 'In-app notifications; type e.g. extra_hidden_cost';
COMMENT ON COLUMN user_notifications.type IS 'e.g. extra_hidden_cost';
COMMENT ON COLUMN user_notifications.payload IS 'e.g. { extra_hidden_cost, extra_reward, previous_reward, new_total_reward }';

CREATE INDEX IF NOT EXISTS idx_user_notifications_username ON user_notifications(username);
CREATE INDEX IF NOT EXISTS idx_user_notifications_receipt_id ON user_notifications(receipt_id);
CREATE INDEX IF NOT EXISTS idx_user_notifications_created_at ON user_notifications(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_notifications_unread ON user_notifications(username) WHERE read_at IS NULL;
