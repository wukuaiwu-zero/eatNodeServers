USE node_servers;

CREATE TABLE IF NOT EXISTS family_daily_meal_plans (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  plan_date DATE NOT NULL,
  meal_name VARCHAR(50) NOT NULL,
  done TINYINT(1) NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT NULL,
  updated_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_daily_meal_plans_meal (family_code, plan_date, meal_name),
  KEY idx_family_daily_meal_plans_date (family_code, plan_date)
);

CREATE TABLE IF NOT EXISTS family_daily_meal_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  plan_date DATE NOT NULL,
  meal_name VARCHAR(50) NOT NULL,
  recipe_name VARCHAR(100) NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  created_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_daily_meal_items_recipe (family_code, plan_date, meal_name, recipe_name),
  KEY idx_family_daily_meal_items_meal (family_code, plan_date, meal_name, sort_order)
);

CREATE TABLE IF NOT EXISTS family_meal_common_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  meal_name VARCHAR(50) NOT NULL,
  recipe_name VARCHAR(100) NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_meal_common_items_recipe (family_code, meal_name, recipe_name),
  KEY idx_family_meal_common_items_meal (family_code, meal_name)
);

CREATE TABLE IF NOT EXISTS family_meal_temp_items (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  plan_date DATE NOT NULL,
  meal_name VARCHAR(50) NOT NULL,
  recipe_name VARCHAR(100) NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_meal_temp_items_recipe (family_code, plan_date, meal_name, recipe_name),
  KEY idx_family_meal_temp_items_date (family_code, plan_date, meal_name)
);
