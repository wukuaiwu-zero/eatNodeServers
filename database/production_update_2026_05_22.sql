USE node_servers;

DROP PROCEDURE IF EXISTS exec_if_column_exists;
DROP PROCEDURE IF EXISTS add_column_if_missing;
DROP PROCEDURE IF EXISTS drop_index_if_exists;
DROP PROCEDURE IF EXISTS add_index_if_missing;

DELIMITER //

CREATE PROCEDURE exec_if_column_exists(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64),
  IN sql_text LONGTEXT
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
  ) THEN
    SET @ddl = sql_text;
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END//

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

CALL exec_if_column_exists('family_recipes', 'recipe_json', 'DROP TABLE IF EXISTS family_recipes_new');
CALL exec_if_column_exists('family_recipes', 'recipe_json', 'CREATE TABLE family_recipes_new (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  recipe_id VARCHAR(100) NOT NULL,
  name VARCHAR(100) NOT NULL,
  category VARCHAR(100) DEFAULT NULL,
  cover_url VARCHAR(255) DEFAULT NULL,
  difficulty VARCHAR(50) DEFAULT NULL,
  duration VARCHAR(50) DEFAULT NULL,
  favorite TINYINT(1) NOT NULL DEFAULT 0,
  own TINYINT(1) NOT NULL DEFAULT 1,
  steps_json LONGTEXT DEFAULT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_recipes_family_recipe (family_code, recipe_id),
  KEY idx_family_recipes_family_category (family_code, category),
  KEY idx_family_recipes_family_favorite (family_code, favorite),
  KEY idx_family_recipes_family_deleted (family_code, deleted_at)
)');

CALL exec_if_column_exists('family_recipes', 'recipe_json', 'INSERT INTO family_recipes_new
  (family_code, recipe_id, name, category, cover_url, difficulty, duration, favorite, own, steps_json, created_at, updated_at)
SELECT
  fr.family_code,
  COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.id'')), ''''), CONCAT(''recipe_'', fr.id, ''_'', recipe_item.item_index)) AS recipe_id,
  COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.name'')), ''''), CONCAT(''未命名菜谱'', recipe_item.item_index)) AS name,
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.category'')), '''') AS category,
  COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.coverUrl'')), ''''), NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.cover'')), ''''), fr.cover_url) AS cover_url,
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.difficulty'')), '''') AS difficulty,
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.duration'')), '''') AS duration,
  IF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.favorite'')) IN (''true'', ''1''), 1, 0) AS favorite,
  IF(COALESCE(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.own'')), ''true'') IN (''false'', ''0''), 0, 1) AS own,
  COALESCE(JSON_EXTRACT(recipe_item.item_json, ''$.steps''), JSON_ARRAY()) AS steps_json,
  fr.created_at,
  fr.updated_at
FROM family_recipes fr
JOIN JSON_TABLE(IF(JSON_VALID(fr.recipe_json), COALESCE(JSON_EXTRACT(fr.recipe_json, ''$.recipes''), JSON_ARRAY()), JSON_ARRAY()), ''$[*]'' COLUMNS (
  item_index FOR ORDINALITY,
  item_json JSON PATH ''$''
)) AS recipe_item');

CALL exec_if_column_exists('family_recipes', 'recipe_json', 'INSERT IGNORE INTO family_recipe_ingredients
  (family_code, recipe_id, name, amount, is_seasoning, sort_order)
SELECT
  migrated.family_code,
  migrated.recipe_id,
  COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ingredient.item_json, ''$.name'')), ''''), ''未命名食材'') AS name,
  NULLIF(JSON_UNQUOTE(JSON_EXTRACT(ingredient.item_json, ''$.amount'')), '''') AS amount,
  IF(JSON_UNQUOTE(JSON_EXTRACT(ingredient.item_json, ''$.isSeasoning'')) IN (''true'', ''1''), 1, 0) AS is_seasoning,
  ingredient.item_index - 1 AS sort_order
FROM (
  SELECT
    fr.family_code,
    COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(recipe_item.item_json, ''$.id'')), ''''), CONCAT(''recipe_'', fr.id, ''_'', recipe_item.item_index)) AS recipe_id,
    recipe_item.item_json
  FROM family_recipes fr
  JOIN JSON_TABLE(IF(JSON_VALID(fr.recipe_json), COALESCE(JSON_EXTRACT(fr.recipe_json, ''$.recipes''), JSON_ARRAY()), JSON_ARRAY()), ''$[*]'' COLUMNS (
    item_index FOR ORDINALITY,
    item_json JSON PATH ''$''
  )) AS recipe_item
) AS migrated
JOIN JSON_TABLE(COALESCE(JSON_EXTRACT(migrated.item_json, ''$.ingredients''), JSON_ARRAY()), ''$[*]'' COLUMNS (
  item_index FOR ORDINALITY,
  item_json JSON PATH ''$''
)) AS ingredient');

CALL exec_if_column_exists('family_recipes', 'recipe_json', 'DROP TABLE family_recipes');
CALL exec_if_column_exists('family_recipes_new', 'recipe_id', 'RENAME TABLE family_recipes_new TO family_recipes');

CALL add_column_if_missing('family_members', 'relation_type', 'relation_type VARCHAR(20) NOT NULL DEFAULT ''joined'' AFTER role');
CALL drop_index_if_exists('family_members', 'uk_family_members_member_code');
CALL add_index_if_missing('family_members', 'uk_family_members_family_member', 'UNIQUE KEY uk_family_members_family_member (family_code, member_code)');
CALL add_index_if_missing('family_members', 'idx_family_members_device', 'KEY idx_family_members_device (device_id)');

DROP PROCEDURE exec_if_column_exists;
DROP PROCEDURE add_column_if_missing;
DROP PROCEDURE drop_index_if_exists;
DROP PROCEDURE add_index_if_missing;
