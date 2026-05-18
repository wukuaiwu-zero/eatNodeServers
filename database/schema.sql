CREATE DATABASE IF NOT EXISTS node_servers DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE node_servers;

CREATE TABLE IF NOT EXISTS family_recipes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  recipe_json LONGTEXT NOT NULL,
  cover_url VARCHAR(255) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_recipes_family_code (family_code)
);

CREATE TABLE IF NOT EXISTS families (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  family_secret_hash VARCHAR(255) DEFAULT NULL,
  family_name VARCHAR(100) DEFAULT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_by_device_id VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_families_family_code (family_code)
);

CREATE TABLE IF NOT EXISTS devices (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  device_id VARCHAR(100) NOT NULL,
  device_secret_hash VARCHAR(255) NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_seen_at TIMESTAMP NULL DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uk_devices_device_id (device_id)
);

CREATE TABLE IF NOT EXISTS family_invites (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  invite_code VARCHAR(20) NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  used_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_invites_invite_code (invite_code),
  KEY idx_family_invites_family_code (family_code)
);

CREATE TABLE IF NOT EXISTS family_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_code VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  device_id VARCHAR(100) DEFAULT NULL,
  member_name VARCHAR(100) DEFAULT NULL,
  title VARCHAR(100) DEFAULT NULL,
  avatar_url VARCHAR(255) DEFAULT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'member',
  joined_family TINYINT(1) NOT NULL DEFAULT 0,
  revoked_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_members_member_code (member_code),
  UNIQUE KEY uk_family_members_family_device (family_code, device_id),
  KEY idx_family_members_family_code (family_code)
);

CREATE TABLE IF NOT EXISTS family_shopping_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  item_json LONGTEXT NOT NULL,
  create_time BIGINT UNSIGNED DEFAULT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_shopping_items_family_item (family_code, item_id),
  KEY idx_family_shopping_items_family_updated (family_code, updated_at),
  KEY idx_family_shopping_items_family_deleted (family_code, deleted_at)
);

CREATE TABLE IF NOT EXISTS family_ingredient_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  item_id VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  item_json LONGTEXT NOT NULL,
  create_time BIGINT UNSIGNED DEFAULT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  version INT UNSIGNED NOT NULL DEFAULT 1,
  deleted_at TIMESTAMP NULL DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_ingredient_items_family_item (family_code, item_id),
  KEY idx_family_ingredient_items_family_updated (family_code, updated_at),
  KEY idx_family_ingredient_items_family_deleted (family_code, deleted_at)
);

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
