USE node_servers;

CREATE TABLE IF NOT EXISTS family_security_questions (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  question_ciphertext TEXT NOT NULL,
  question_iv VARCHAR(100) NOT NULL,
  question_auth_tag VARCHAR(100) NOT NULL,
  answer_hash VARCHAR(200) NOT NULL,
  failed_count INT NOT NULL DEFAULT 0,
  locked_until TIMESTAMP NULL DEFAULT NULL,
  created_by_device_id VARCHAR(100) DEFAULT NULL,
  updated_by_device_id VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_security_questions_family (family_code),
  KEY idx_family_security_questions_locked_until (locked_until)
);
