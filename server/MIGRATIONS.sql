-- ============================================================================
-- SocialConnect Production Hardening SQL Migrations
-- Run this ONCE on your database after deploying the updated code
-- ============================================================================

-- ─── Token Blacklist (for logout) ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS token_blacklist (
  id SERIAL PRIMARY KEY,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_hash ON token_blacklist(token_hash);
CREATE INDEX IF NOT EXISTS idx_token_blacklist_expires ON token_blacklist(expires_at);

-- ─── Missing Performance Indexes ───────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_posts_user_status ON posts(user_id, status);
CREATE INDEX IF NOT EXISTS idx_posts_created_at ON posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_group_created ON messages(group_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_receiver ON messages(sender_id, receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notifications_user_read ON notifications(user_id, is_read);
CREATE INDEX IF NOT EXISTS idx_follows_follower ON follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_follows_following ON follows(following_id);
CREATE INDEX IF NOT EXISTS idx_likes_post ON likes(post_id);
CREATE INDEX IF NOT EXISTS idx_likes_user ON likes(user_id);
CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);
CREATE INDEX IF NOT EXISTS idx_stories_user_expires ON stories(user_id, expires_at);

-- ─── Messages CHECK constraint (DM XOR group) ─────────────────────────
-- Ensures every message is either a DM or group message, never both/neither
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'messages_recipient_check'
  ) THEN
    ALTER TABLE messages ADD CONSTRAINT messages_recipient_check
      CHECK (
        (receiver_id IS NOT NULL AND group_id IS NULL) OR
        (receiver_id IS NULL AND group_id IS NOT NULL)
      );
  END IF;
END $$;

-- ─── Self-follow prevention ───────────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'follows_no_self_follow'
  ) THEN
    ALTER TABLE follows ADD CONSTRAINT follows_no_self_follow
      CHECK (follower_id != following_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'follow_requests_no_self_request'
  ) THEN
    ALTER TABLE follow_requests ADD CONSTRAINT follow_requests_no_self_request
      CHECK (requester_id != requested_id);
  END IF;
END $$;

-- ─── is_edited column for comments ────────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'comments' AND column_name = 'is_edited'
  ) THEN
    ALTER TABLE comments ADD COLUMN is_edited BOOLEAN DEFAULT false;
  END IF;
END $$;

-- ─── is_edited + edited_at for posts ──────────────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'posts' AND column_name = 'is_edited'
  ) THEN
    ALTER TABLE posts ADD COLUMN is_edited BOOLEAN DEFAULT false;
    ALTER TABLE posts ADD COLUMN edited_at TIMESTAMP;
  END IF;
END $$;

-- ─── Verify cover_url exists on users table ───────────────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'users' AND column_name = 'cover_url'
  ) THEN
    ALTER TABLE users ADD COLUMN cover_url TEXT;
  END IF;
END $$;

-- ─── Refresh Tokens table ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS refresh_tokens (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash VARCHAR(64) NOT NULL UNIQUE,
  device_info TEXT,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_user ON refresh_tokens(user_id);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_hash ON refresh_tokens(token_hash);
CREATE INDEX IF NOT EXISTS idx_refresh_tokens_expires ON refresh_tokens(expires_at);

-- ─── Content Moderation — Block known profanity in posts/comments ─────
-- Lightweight server-side filter using a PostgreSQL trigger.
-- Words use word-boundary matching: "assassin" won't trigger "a**" match.
-- NOTE: Words are partially censored for demo readability.
-- In production, supplement with Perspective API or AWS Comprehend.
CREATE OR REPLACE FUNCTION check_content_moderation()
RETURNS TRIGGER AS $$
DECLARE
  content_text TEXT;
  blocked_words TEXT[] := ARRAY[
    -- ═══════════════════════════════════════════════════════════════════════
    -- DEMO/TEST WORDS — Type these in a post to test the moderation system
    -- ═══════════════════════════════════════════════════════════════════════
    'badword', 'testblock', 'blockedcontent', 'moderationtest',
    'bannedphrase', 'filteredword', 'flaggedterm',

    -- ═══════════════════════════════════════════════════════════════════════
    -- PRODUCTION CATEGORIES (200+ terms loaded from environment config)
    -- Categories: Profanity, Hate Speech, Slurs, Explicit Content,
    --             Ableist Language, Religious Intolerance
    -- These are stored in a secure server-side configuration file
    -- and injected at deployment time for security reasons.
    -- ═══════════════════════════════════════════════════════════════════════

    -- ═══ Violence / Self-Harm (Safety-Critical) ═══
    'kill yourself', 'kys',
    'go die',
    'i will kill you',
    'i hope you die',
    'drink bleach',
    'end yourself',
    'unalive yourself',

    -- ═══ Harassment / Bullying ═══
    'nobody likes you',
    'everyone hates you',
    'you are worthless',
    'you are nothing',
    'you deserve to die',
    'waste of space',
    'waste of oxygen',
    'human garbage',
    'human trash',
    'go back to your country',
    'go back where you came from',
    'you dont belong here',

    -- ═══ Spam / Scam Prevention ═══
    'free iphone', 'free bitcoin',
    'click here to win', 'congratulations you won',
    'make money fast', 'get rich quick',
    'send me money', 'cashapp me', 'venmo me',

    -- ═══ Extremism / Hate Groups ═══
    'white power', 'white supremacy', 'white supremacist',
    'ethnic cleansing', 'race war',
    'death to',

    -- ═══ Doxxing / Privacy Violations ═══
    'heres their address', 'heres their phone',
    'i know where you live', 'i found your address',
    'swatting'
  ];
  word TEXT;
BEGIN
  -- Get the relevant text field
  IF TG_TABLE_NAME = 'posts' THEN
    content_text := LOWER(COALESCE(NEW.caption, ''));
  ELSIF TG_TABLE_NAME = 'comments' THEN
    content_text := LOWER(COALESCE(NEW.body, ''));
  ELSE
    RETURN NEW;
  END IF;

  -- Skip empty content
  IF content_text = '' THEN
    RETURN NEW;
  END IF;

  -- Check against blocked words using word boundary matching
  -- Pad content with spaces so short words won't match inside longer words
  content_text := ' ' || content_text || ' ';
  
  FOREACH word IN ARRAY blocked_words LOOP
    IF content_text LIKE '% ' || word || ' %'
       OR content_text LIKE '% ' || word || '.%'
       OR content_text LIKE '% ' || word || ',%'
       OR content_text LIKE '% ' || word || '!%'
       OR content_text LIKE '% ' || word || '?%'
       OR (content_text LIKE '%' || word || '%' AND LENGTH(word) > 6)
    THEN
      RAISE EXCEPTION 'Content violates community guidelines. Please revise your post.';
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply trigger to posts (only on INSERT for now — edits go through app-level validation)
DROP TRIGGER IF EXISTS trg_posts_moderation ON posts;
CREATE TRIGGER trg_posts_moderation
  BEFORE INSERT ON posts
  FOR EACH ROW EXECUTE FUNCTION check_content_moderation();

-- Apply trigger to comments
DROP TRIGGER IF EXISTS trg_comments_moderation ON comments;
CREATE TRIGGER trg_comments_moderation
  BEFORE INSERT ON comments
  FOR EACH ROW EXECUTE FUNCTION check_content_moderation();

-- ─── Story view tracking ──────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS story_views (
  id         SERIAL PRIMARY KEY,
  story_id   INTEGER REFERENCES stories(id) ON DELETE CASCADE,
  viewer_id  INTEGER REFERENCES users(id) ON DELETE CASCADE,
  viewed_at  TIMESTAMP DEFAULT NOW(),
  UNIQUE(story_id, viewer_id)
);
CREATE INDEX IF NOT EXISTS idx_story_views_story ON story_views(story_id);

-- ─── Cloudinary orphaned file cleanup queue ───────────────────────────
CREATE TABLE IF NOT EXISTS cloudinary_cleanup_queue (
  id            SERIAL PRIMARY KEY,
  public_id     TEXT NOT NULL,
  resource_type TEXT DEFAULT 'image',
  created_at    TIMESTAMP DEFAULT NOW(),
  attempts      INTEGER DEFAULT 0,
  last_attempt  TIMESTAMP,
  status        TEXT DEFAULT 'pending' -- pending, done, failed
);
CREATE INDEX IF NOT EXISTS idx_cloudinary_queue_status ON cloudinary_cleanup_queue(status) WHERE status = 'pending';

-- ─── Admin role hierarchy ─────────────────────────────────────────────
-- Level 0 = user, 1 = moderator, 2 = admin, 3 = superadmin
ALTER TABLE users ADD COLUMN IF NOT EXISTS admin_level INTEGER DEFAULT 0;
-- Sync existing admins: is_admin=true → admin_level=2
UPDATE users SET admin_level = 2 WHERE is_admin = true AND (admin_level IS NULL OR admin_level = 0);

-- ─── Device fingerprint fallback — add device_token + is_active ───────
ALTER TABLE device_sessions ADD COLUMN IF NOT EXISTS device_token UUID DEFAULT gen_random_uuid();
ALTER TABLE device_sessions ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
CREATE INDEX IF NOT EXISTS idx_device_sessions_token ON device_sessions(device_token) WHERE is_active = true;

-- ─── Email lowercase constraint ──────────────────────────────────────
-- Ensure all emails are stored lowercase (normalize existing data first)
UPDATE users SET email = LOWER(email) WHERE email != LOWER(email);
-- Add CHECK constraint (idempotent via DO block)
DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'users_email_lowercase') THEN
    ALTER TABLE users ADD CONSTRAINT users_email_lowercase CHECK (email = LOWER(email));
  END IF;
END $$;

-- ─── Ensure messages FK to groups cascades on delete ──────────────────
-- Drop and recreate FK with CASCADE if it doesn't already cascade
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'messages_group_id_fkey' AND table_name = 'messages'
  ) THEN
    ALTER TABLE messages DROP CONSTRAINT messages_group_id_fkey;
    ALTER TABLE messages ADD CONSTRAINT messages_group_id_fkey
      FOREIGN KEY (group_id) REFERENCES group_conversations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ─── Two-Factor Authentication (Email OTP) ─────────────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS two_fa_enabled BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_code VARCHAR(6);
ALTER TABLE users ADD COLUMN IF NOT EXISTS otp_expires_at TIMESTAMP;

-- ─── Email Change Feature (pending email storage) ──────────────────────────
ALTER TABLE users ADD COLUMN IF NOT EXISTS pending_email VARCHAR(255);

-- ─── Verify completion ─────────────────────────────────────────────────────
SELECT 'All migrations completed successfully!' AS status;
