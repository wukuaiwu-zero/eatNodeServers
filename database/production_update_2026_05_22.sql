USE node_servers;

CREATE TABLE IF NOT EXISTS family_recipe_ingredients (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  recipe_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  amount VARCHAR(100) DEFAULT NULL,
  is_seasoning TINYINT(1) NOT NULL DEFAULT 0,
  sort_order INT NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_recipe_ingredients_recipe_sort (family_code, recipe_id, sort_order),
  KEY idx_family_recipe_ingredients_recipe (family_code, recipe_id)
);

DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS drop_index_if_exists;
DROP PROCEDURE IF EXISTS add_index_if_missing;

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

CREATE PROCEDURE drop_index_if_exists(
  IN target_table VARCHAR(64),
  IN target_index VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND INDEX_NAME = target_index
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', target_table, '` DROP INDEX `', target_index, '`');
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

CREATE PROCEDURE add_index_if_missing(
  IN target_table VARCHAR(64),
  IN target_index VARCHAR(64),
  IN index_definition TEXT
)
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND INDEX_NAME = target_index
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', target_table, '` ADD ', index_definition);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

DELIMITER ;

CALL add_column_if_missing('family_members', 'relation_type', 'relation_type VARCHAR(20) NOT NULL DEFAULT ''joined'' AFTER role');
CALL drop_index_if_exists('family_members', 'uk_family_members_member_code');
CALL add_index_if_missing('family_members', 'uk_family_members_family_member', 'UNIQUE KEY uk_family_members_family_member (family_code, member_code)');
CALL add_index_if_missing('family_members', 'idx_family_members_device', 'KEY idx_family_members_device (device_id)');

DROP PROCEDURE add_column_if_missing;
DROP PROCEDURE drop_index_if_exists;
DROP PROCEDURE add_index_if_missing;

-- 菜谱 JSON 拆字段请运行：
-- node scripts/migrate-family-recipes.js
