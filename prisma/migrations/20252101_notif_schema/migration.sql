ALTER TABLE users 
ADD COLUMN fcm_token VARCHAR(500);

CREATE TABLE notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Who needs to see this? (Links to your existing users table)
  recipient_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  
  -- The Content
  title VARCHAR(255) NOT NULL,
  body TEXT NOT NULL,
  
  -- The Logic (Used for Deep Linking & Auto-Deletion)
  type VARCHAR(50) NOT NULL,         -- e.g., 'BAG_LIFT', 'KYC', 'SCHEME'
  reference_id VARCHAR(255),         -- The ID of the BagLift or Mason
  
  -- Status
  is_read BOOLEAN DEFAULT FALSE NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Index for instant loading of the "Bell Icon" list
CREATE INDEX idx_notifications_recipient ON notifications(recipient_user_id);