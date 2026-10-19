-- SR10 Cloud Sync schema (MySQL)
-- Tables:
-- - users: authentication users (master/admin)
-- - reviews: restaurant reviews with optional photo URL
-- - point_history: point events (+50 review, +100 review w/photo, +50 attendance, +10 ad)
-- - user_points_total: cached total points for quick display
-- - attendance: daily attendance state
-- - ads: single active ad config (image or iframe + URL)
-- - hall_seed_state: master-only toggle for hall seed data
-- - sessions: express-session storage (MySQL)

CREATE DATABASE IF NOT EXISTS sr10
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE sr10;

-- Users
CREATE TABLE IF NOT EXISTS users (
  username VARCHAR(64) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  is_master TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (username)
) ENGINE=InnoDB;

-- Reviews
CREATE TABLE IF NOT EXISTS reviews (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  owner_username VARCHAR(64) NOT NULL,
  name VARCHAR(200) NOT NULL,              -- restaurant name
  location VARCHAR(255) NULL,
  category VARCHAR(16) NULL,
  rating_dec DECIMAL(3,1) NOT NULL DEFAULT 0.0, -- 0.0 ~ 10.0 (1 decimal)
  comment VARCHAR(255) NULL,
  detail TEXT NULL,
  visit_date DATE NULL,
  photo_url TEXT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  KEY idx_reviews_owner (owner_username),
  KEY idx_reviews_name (name),
  CONSTRAINT fk_reviews_owner
    FOREIGN KEY (owner_username) REFERENCES users(username)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Point events
CREATE TABLE IF NOT EXISTS point_history (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(64) NOT NULL,
  at DATETIME NOT NULL,
  points INT NOT NULL,
  reason VARCHAR(64) NOT NULL,
  PRIMARY KEY (id),
  KEY idx_point_history_user_time (username, at),
  CONSTRAINT fk_point_history_user
    FOREIGN KEY (username) REFERENCES users(username)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Cached total points
CREATE TABLE IF NOT EXISTS user_points_total (
  username VARCHAR(64) NOT NULL,
  total_points INT NOT NULL DEFAULT 0,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username),
  CONSTRAINT fk_user_points_total_user
    FOREIGN KEY (username) REFERENCES users(username)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Attendance (daily)
CREATE TABLE IF NOT EXISTS attendance (
  username VARCHAR(64) NOT NULL,
  last_attendance_date DATE NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (username),
  CONSTRAINT fk_attendance_user
    FOREIGN KEY (username) REFERENCES users(username)
    ON DELETE CASCADE
) ENGINE=InnoDB;

-- Ads (singleton row)
CREATE TABLE IF NOT EXISTS ads (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  ad_type VARCHAR(16) NOT NULL, -- 'image' | 'iframe'
  url TEXT NOT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  CONSTRAINT chk_ads_ad_type CHECK (ad_type IN ('image', 'iframe'))
) ENGINE=InnoDB;

-- Hall seed toggle (singleton row)
CREATE TABLE IF NOT EXISTS hall_seed_state (
  id TINYINT UNSIGNED NOT NULL DEFAULT 1,
  enabled TINYINT(1) NOT NULL DEFAULT 1,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB;

-- Express-session store (MySQL)
-- Compatible with express-mysql-session defaults.
CREATE TABLE IF NOT EXISTS sessions (
  session_id VARCHAR(128) NOT NULL,
  expires DATETIME NOT NULL,
  data MEDIUMBLOB,
  PRIMARY KEY (session_id),
  KEY idx_sessions_expires (expires)
) ENGINE=InnoDB;

-- Initial singleton rows (safe to run repeatedly)
INSERT INTO hall_seed_state (id, enabled)
VALUES (1, 1)
ON DUPLICATE KEY UPDATE enabled = VALUES(enabled);

