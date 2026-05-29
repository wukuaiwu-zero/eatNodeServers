USE node_servers;

CREATE TABLE IF NOT EXISTS family_member_health_profiles (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  member_code VARCHAR(100) NOT NULL,
  height_cm DECIMAL(5,1) DEFAULT NULL,
  age TINYINT UNSIGNED DEFAULT NULL,
  goal_type VARCHAR(100) DEFAULT NULL,
  target_weight DECIMAL(5,1) DEFAULT NULL,
  start_weight DECIMAL(5,1) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_member_health_profiles_member (family_code, member_code),
  KEY idx_family_member_health_profiles_family (family_code)
);

CREATE TABLE IF NOT EXISTS family_member_weight_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  member_code VARCHAR(100) NOT NULL,
  record_date DATE NOT NULL,
  weight DECIMAL(5,1) NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_member_weight_records_day (family_code, member_code, record_date),
  KEY idx_family_member_weight_records_member_date (family_code, member_code, record_date)
);
