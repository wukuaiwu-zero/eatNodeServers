USE node_servers;

CREATE TABLE IF NOT EXISTS family_memos (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  memo_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  create_time DATETIME NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_memos_family_memo (family_code, memo_id),
  KEY idx_family_memos_family_time (family_code, create_time),
  KEY idx_family_memos_family_deleted (family_code, deleted_at)
);
