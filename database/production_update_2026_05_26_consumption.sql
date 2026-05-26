USE node_servers;

CREATE TABLE IF NOT EXISTS family_consumption_records (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  record_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category_id VARCHAR(100) DEFAULT NULL,
  price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
  consume_date DATE NOT NULL,
  create_time DATETIME NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_consumption_family_record (family_code, record_id),
  KEY idx_family_consumption_family_date (family_code, consume_date),
  KEY idx_family_consumption_family_category (family_code, category_id),
  KEY idx_family_consumption_family_deleted (family_code, deleted_at)
);
