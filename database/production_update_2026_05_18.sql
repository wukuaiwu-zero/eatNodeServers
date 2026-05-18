USE node_servers;

DELIMITER //

CREATE PROCEDURE add_column_if_missing(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64),
  IN column_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', target_table, '` ADD COLUMN ', column_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_column_if_missing('family_recipes', 'cover_url', 'cover_url VARCHAR(255) DEFAULT NULL AFTER recipe_json');
CALL add_column_if_missing('family_members', 'member_name', 'member_name VARCHAR(100) DEFAULT NULL AFTER device_id');
CALL add_column_if_missing('family_members', 'title', 'title VARCHAR(100) DEFAULT NULL AFTER member_name');
CALL add_column_if_missing('family_members', 'avatar_url', 'avatar_url VARCHAR(255) DEFAULT NULL AFTER title');

DROP PROCEDURE add_column_if_missing;

CREATE TABLE IF NOT EXISTS family_shopping_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_shopping_categories_family_category (family_code, category_id),
  KEY idx_family_shopping_categories_family_sort (family_code, sort_order),
  KEY idx_family_shopping_categories_family_deleted (family_code, deleted_at)
);

CREATE TABLE IF NOT EXISTS family_ingredient_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_ingredient_categories_family_category (family_code, category_id),
  KEY idx_family_ingredient_categories_family_sort (family_code, sort_order),
  KEY idx_family_ingredient_categories_family_deleted (family_code, deleted_at)
);

CREATE TABLE IF NOT EXISTS family_recipe_categories (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  category_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_recipe_categories_family_category (family_code, category_id),
  KEY idx_family_recipe_categories_family_sort (family_code, sort_order),
  KEY idx_family_recipe_categories_family_deleted (family_code, deleted_at)
);

CREATE TABLE IF NOT EXISTS family_recipe_pool_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  dish_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  type VARCHAR(30) NOT NULL DEFAULT 'manual',
  is_default TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_recipe_pool_items_family_dish (family_code, dish_id),
  KEY idx_family_recipe_pool_items_family_type (family_code, type),
  KEY idx_family_recipe_pool_items_family_deleted (family_code, deleted_at)
);

DROP TABLE IF EXISTS weather_icons;
DROP TABLE IF EXISTS users;
