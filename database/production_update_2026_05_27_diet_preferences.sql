USE node_servers;

CREATE TABLE IF NOT EXISTS family_diet_preferences (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  preference_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  title VARCHAR(100) NOT NULL,
  preference_type VARCHAR(50) NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_diet_preferences_family_preference (family_code, preference_id),
  KEY idx_family_diet_preferences_family_type (family_code, preference_type),
  KEY idx_family_diet_preferences_family_deleted (family_code, deleted_at)
);
