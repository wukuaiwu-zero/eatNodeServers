USE node_servers;

CREATE TABLE IF NOT EXISTS personal_notes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  note_id VARCHAR(100) NOT NULL,
  user_id VARCHAR(100) NOT NULL,
  content TEXT NOT NULL,
  create_time DATETIME NOT NULL,
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_personal_notes_user_note (user_id, note_id),
  KEY idx_personal_notes_user_time (user_id, create_time),
  KEY idx_personal_notes_user_deleted (user_id, deleted_at)
);
