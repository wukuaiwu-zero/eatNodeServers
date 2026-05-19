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

CREATE PROCEDURE drop_column_if_exists(
  IN target_table VARCHAR(64),
  IN target_column VARCHAR(64)
)
BEGIN
  IF EXISTS (
    SELECT 1
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE()
      AND TABLE_NAME = target_table
      AND COLUMN_NAME = target_column
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE `', target_table, '` DROP COLUMN `', target_column, '`');
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

CALL add_column_if_missing('family_shopping_items', 'name', 'name VARCHAR(100) NULL AFTER family_code');
CALL add_column_if_missing('family_shopping_items', 'quantity', 'quantity VARCHAR(100) DEFAULT NULL AFTER name');
CALL add_column_if_missing('family_shopping_items', 'category_id', 'category_id VARCHAR(100) DEFAULT NULL AFTER quantity');
CALL add_column_if_missing('family_shopping_items', 'price', 'price VARCHAR(50) DEFAULT NULL AFTER category_id');
CALL add_column_if_missing('family_shopping_items', 'done', 'done TINYINT(1) NOT NULL DEFAULT 0 AFTER price');

CALL add_column_if_missing('family_ingredient_items', 'name', 'name VARCHAR(100) NULL AFTER family_code');
CALL add_column_if_missing('family_ingredient_items', 'quantity', 'quantity VARCHAR(100) DEFAULT NULL AFTER name');
CALL add_column_if_missing('family_ingredient_items', 'category_id', 'category_id VARCHAR(100) DEFAULT NULL AFTER quantity');
CALL add_column_if_missing('family_ingredient_items', 'price', 'price VARCHAR(50) DEFAULT NULL AFTER category_id');
CALL add_column_if_missing('family_ingredient_items', 'has_stock', 'has_stock TINYINT(1) NOT NULL DEFAULT 1 AFTER price');
CALL add_column_if_missing('family_ingredient_items', 'expire_date', 'expire_date DATE DEFAULT NULL AFTER has_stock');

UPDATE family_shopping_items
SET
  name = COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.name')), ''), item_id),
  quantity = COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.quantity')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.num')), '')
  ),
  category_id = COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.categoryId')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.category_id')), ''),
    CASE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.category')), '')
      WHEN '主食' THEN 'shopping_cat_staple'
      WHEN '蔬菜' THEN 'shopping_cat_vegetable'
      WHEN '肉类' THEN 'shopping_cat_meat'
      WHEN '蛋奶' THEN 'shopping_cat_egg_dairy'
      WHEN '调味' THEN 'shopping_cat_seasoning'
      WHEN '其他' THEN 'shopping_cat_other'
      ELSE NULL
    END
  ),
  price = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.price')), ''),
  done = IF(
    JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.done')) IN ('true', '1'),
    1,
    0
  )
WHERE item_json IS NOT NULL AND JSON_VALID(item_json);

UPDATE family_ingredient_items
SET
  name = COALESCE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.name')), ''), item_id),
  quantity = COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.quantity')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.num')), '')
  ),
  category_id = COALESCE(
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.categoryId')), ''),
    NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.category_id')), ''),
    CASE NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.category')), '')
      WHEN '主食' THEN 'ingredient_cat_staple'
      WHEN '蔬菜' THEN 'ingredient_cat_vegetable'
      WHEN '肉类' THEN 'ingredient_cat_meat'
      WHEN '蛋奶' THEN 'ingredient_cat_egg_dairy'
      WHEN '调味' THEN 'ingredient_cat_seasoning'
      WHEN '其他' THEN 'ingredient_cat_other'
      ELSE NULL
    END
  ),
  price = NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.price')), ''),
  has_stock = IF(
    COALESCE(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.hasStock')), JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.has')), 'true') IN ('false', '0'),
    0,
    1
  ),
  expire_date = COALESCE(
    STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.expire_date')), ''), '%Y-%m-%d'),
    STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.expireDate')), ''), '%Y-%m-%d'),
    STR_TO_DATE(NULLIF(JSON_UNQUOTE(JSON_EXTRACT(item_json, '$.expirationDate')), ''), '%Y-%m-%d')
  )
WHERE item_json IS NOT NULL AND JSON_VALID(item_json);

UPDATE family_shopping_items SET name = item_id WHERE name IS NULL OR name = '';
UPDATE family_ingredient_items SET name = item_id WHERE name IS NULL OR name = '';

ALTER TABLE family_shopping_items MODIFY COLUMN name VARCHAR(100) NOT NULL;
ALTER TABLE family_ingredient_items MODIFY COLUMN name VARCHAR(100) NOT NULL;

CALL add_index_if_missing('family_shopping_items', 'idx_family_shopping_items_family_category', 'KEY idx_family_shopping_items_family_category (family_code, category_id)');
CALL add_index_if_missing('family_shopping_items', 'idx_family_shopping_items_family_done', 'KEY idx_family_shopping_items_family_done (family_code, done)');
CALL add_index_if_missing('family_ingredient_items', 'idx_family_ingredient_items_family_category', 'KEY idx_family_ingredient_items_family_category (family_code, category_id)');
CALL add_index_if_missing('family_ingredient_items', 'idx_family_ingredient_items_family_expire', 'KEY idx_family_ingredient_items_family_expire (family_code, expire_date)');

CALL drop_column_if_exists('family_shopping_items', 'item_json');
CALL drop_column_if_exists('family_ingredient_items', 'item_json');

DROP PROCEDURE add_column_if_missing;
DROP PROCEDURE drop_column_if_exists;
DROP PROCEDURE add_index_if_missing;

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
