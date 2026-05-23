-- ─── TABLE 1: USERS ───────────────────────────────────────────
CREATE TABLE users (
  id                        SERIAL PRIMARY KEY,
  username                  VARCHAR(40)  UNIQUE NOT NULL,
  email                     VARCHAR(100) UNIQUE NOT NULL,
  password_hash             TEXT         NOT NULL,
  full_name                 VARCHAR(80),
  bio                       VARCHAR(150),
  avatar_url                TEXT,
  is_admin                  BOOLEAN DEFAULT false,
  is_verified               BOOLEAN DEFAULT false,
  is_banned                 BOOLEAN DEFAULT false,
  banned_at                 TIMESTAMP,
  must_reset_password       BOOLEAN DEFAULT false,
  is_private                BOOLEAN DEFAULT false,
  verification_token        TEXT,
  verification_token_expires TIMESTAMP,
  created_at                TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 2: POSTS ───────────────────────────────────────────
CREATE TABLE posts (
  id         SERIAL PRIMARY KEY,
  user_id    INT  REFERENCES users(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  media_type VARCHAR(10) DEFAULT 'image',
  caption    TEXT,
  status     VARCHAR(20) DEFAULT 'pending',
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 3: LIKES ───────────────────────────────────────────
CREATE TABLE likes (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  post_id    INT REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_id)
);
 
-- ─── TABLE 4: COMMENTS ────────────────────────────────────────
CREATE TABLE comments (
  id         SERIAL PRIMARY KEY,
  post_id    INT  REFERENCES posts(id) ON DELETE CASCADE,
  user_id    INT  REFERENCES users(id) ON DELETE CASCADE,
  body       TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 5: FOLLOWS ─────────────────────────────────────────
CREATE TABLE follows (
  id           SERIAL PRIMARY KEY,
  follower_id  INT REFERENCES users(id) ON DELETE CASCADE,
  following_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(follower_id, following_id),
  CHECK (follower_id != following_id)
);
 
-- ─── TABLE 6: FOLLOW_REQUESTS ─────────────────────────────────
CREATE TABLE follow_requests (
  id           SERIAL PRIMARY KEY,
  requester_id INT REFERENCES users(id) ON DELETE CASCADE,
  requested_id INT REFERENCES users(id) ON DELETE CASCADE,
  status       VARCHAR(20) DEFAULT 'pending',
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(requester_id, requested_id)
);
 
-- ─── TABLE 7: MESSAGES (encrypted) ───────────────────────────
CREATE TABLE messages (
  id                SERIAL PRIMARY KEY,
  sender_id         INT REFERENCES users(id) ON DELETE CASCADE,
  receiver_id       INT REFERENCES users(id) ON DELETE CASCADE,
  encrypted_content TEXT NOT NULL,
  read_at           TIMESTAMP,
  created_at        TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 8: STORIES (24-hour) ───────────────────────────────
CREATE TABLE stories (
  id         SERIAL PRIMARY KEY,
  user_id    INT  REFERENCES users(id) ON DELETE CASCADE,
  image_url  TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP DEFAULT (CURRENT_TIMESTAMP + INTERVAL '24 hours')
);
 
-- ─── TABLE 9: DEVICE_SESSIONS ─────────────────────────────────
CREATE TABLE device_sessions (
  id                 SERIAL PRIMARY KEY,
  user_id            INT  REFERENCES users(id) ON DELETE CASCADE,
  device_fingerprint TEXT NOT NULL,
  pin_hash           TEXT,
  is_trusted         BOOLEAN DEFAULT false,
  failed_attempts    INT  DEFAULT 0,
  locked_until       TIMESTAMP,
  last_used          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, device_fingerprint)
);
 
-- ─── TABLE 10: AUDIT_LOG ──────────────────────────────────────
CREATE TABLE audit_log (
  id         SERIAL PRIMARY KEY,
  admin_id   INT REFERENCES users(id) ON DELETE SET NULL,
  action     VARCHAR(100) NOT NULL,
  target_id  INT,
  ip_address VARCHAR(45),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 11: NOTIFICATIONS ──────────────────────────────────
CREATE TABLE notifications (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  actor_id   INT REFERENCES users(id) ON DELETE CASCADE,
  type       VARCHAR(50) NOT NULL,
  post_id    INT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id INT REFERENCES comments(id) ON DELETE CASCADE,
  is_read    BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 12: SAVED_POSTS ────────────────────────────────────
CREATE TABLE saved_posts (
  id         SERIAL PRIMARY KEY,
  user_id    INT REFERENCES users(id) ON DELETE CASCADE,
  post_id    INT REFERENCES posts(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(user_id, post_id)
);
 
-- ─── TABLE 13: PASSWORD_RESETS ────────────────────────────────
CREATE TABLE password_resets (
  id         SERIAL PRIMARY KEY,
  user_id    INT  REFERENCES users(id) ON DELETE CASCADE,
  token      TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP  NOT NULL,
  used       BOOLEAN    DEFAULT false,
  created_at TIMESTAMP  DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 14: BLOCKS ─────────────────────────────────────────
CREATE TABLE blocks (
  id         SERIAL PRIMARY KEY,
  blocker_id INT REFERENCES users(id) ON DELETE CASCADE,
  blocked_id INT REFERENCES users(id) ON DELETE CASCADE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(blocker_id, blocked_id),
  CHECK (blocker_id != blocked_id)
);
 
-- ─── TABLE 15: REPORTS ────────────────────────────────────────
CREATE TABLE reports (
  id               SERIAL PRIMARY KEY,
  reporter_id      INT REFERENCES users(id) ON DELETE SET NULL,
  reported_user_id INT REFERENCES users(id) ON DELETE CASCADE,
  post_id          INT REFERENCES posts(id) ON DELETE CASCADE,
  comment_id       INT REFERENCES comments(id) ON DELETE CASCADE,
  reason           VARCHAR(50) NOT NULL,
  description      TEXT,
  status           VARCHAR(20) DEFAULT 'pending',
  resolved_at      TIMESTAMP,
  resolved_by      INT REFERENCES users(id) ON DELETE SET NULL,
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 16: HASHTAGS ───────────────────────────────────────
CREATE TABLE hashtags (
  id           SERIAL PRIMARY KEY,
  tag          VARCHAR(100) UNIQUE NOT NULL,
  post_count   INT DEFAULT 0,
  last_used_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);
 
-- ─── TABLE 17: POST_HASHTAGS ──────────────────────────────────
CREATE TABLE post_hashtags (
  id         SERIAL PRIMARY KEY,
  post_id    INT REFERENCES posts(id)    ON DELETE CASCADE,
  hashtag_id INT REFERENCES hashtags(id) ON DELETE CASCADE,
  UNIQUE(post_id, hashtag_id)
);

-- Indexes

CREATE INDEX idx_users_username      ON users(username);
CREATE INDEX idx_users_email         ON users(email);
CREATE INDEX idx_posts_user          ON posts(user_id);
CREATE INDEX idx_posts_created       ON posts(created_at DESC);
CREATE INDEX idx_likes_post          ON likes(post_id);
CREATE INDEX idx_comments_post       ON comments(post_id);
CREATE INDEX idx_follows_follower    ON follows(follower_id);
CREATE INDEX idx_follows_following   ON follows(following_id);
CREATE INDEX idx_messages_sender     ON messages(sender_id);
CREATE INDEX idx_messages_receiver   ON messages(receiver_id);
CREATE INDEX idx_hashtags_tag        ON hashtags(tag);
CREATE INDEX idx_hashtags_count      ON hashtags(post_count DESC);
CREATE INDEX idx_notifications_user  ON notifications(user_id, is_read);
CREATE INDEX idx_blocks_blocker      ON blocks(blocker_id);
CREATE INDEX idx_blocks_blocked      ON blocks(blocked_id);
CREATE INDEX idx_reports_status      ON reports(status);

-- Content moderation (auto-approve clean content, flag spam)
CREATE OR REPLACE FUNCTION check_content_moderation()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.caption ILIKE '%spam%' OR NEW.caption ILIKE '%scam%' THEN
    NEW.status := 'flagged';
  ELSE
    NEW.status := 'approved';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER moderate_post_content
  BEFORE INSERT ON posts FOR EACH ROW
  EXECUTE FUNCTION check_content_moderation();
 
-- Notification on like
CREATE OR REPLACE FUNCTION notify_on_like()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, post_id)
  SELECT p.user_id, NEW.user_id, 'like', NEW.post_id
  FROM posts p WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_notify_on_like
  AFTER INSERT ON likes FOR EACH ROW
  EXECUTE FUNCTION notify_on_like();
 
-- Notification on comment
CREATE OR REPLACE FUNCTION notify_on_comment()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type, post_id, comment_id)
  SELECT p.user_id, NEW.user_id, 'comment', NEW.post_id, NEW.id
  FROM posts p WHERE p.id = NEW.post_id AND p.user_id != NEW.user_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_notify_on_comment
  AFTER INSERT ON comments FOR EACH ROW
  EXECUTE FUNCTION notify_on_comment();
 
-- Notification on follow
CREATE OR REPLACE FUNCTION notify_on_follow()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO notifications (user_id, actor_id, type)
  VALUES (NEW.following_id, NEW.follower_id, 'follow');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER trigger_notify_on_follow
  AFTER INSERT ON follows FOR EACH ROW
  EXECUTE FUNCTION notify_on_follow();

