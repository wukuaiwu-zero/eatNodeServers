CREATE DATABASE IF NOT EXISTS node_servers DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE node_servers;

INSERT INTO families (family_code, family_name, is_deleted)
VALUES ('default_family', '默认家庭', 0)
ON DUPLICATE KEY UPDATE
  family_name = VALUES(family_name),
  is_deleted = 0;

INSERT INTO family_members (member_code, family_code, joined_family)
VALUES
  ('member_a', 'default_family', 1),
  ('member_b', 'default_family', 1)
ON DUPLICATE KEY UPDATE
  family_code = VALUES(family_code),
  joined_family = VALUES(joined_family);

INSERT INTO family_recipes (family_code, recipe_json)
VALUES (
  'default_family',
  JSON_OBJECT(
    'recipes',
    JSON_ARRAY(
      JSON_OBJECT(
        'id', 'recipe_tomato_egg',
        '_id', 'recipe_tomato_egg',
        'name', '番茄炒蛋',
        'category', '家常菜',
        'ingredients', JSON_ARRAY('番茄', '鸡蛋', '葱'),
        'steps', JSON_ARRAY('番茄切块', '鸡蛋炒散', '合炒调味'),
        'family_id', 'default_family',
        'create_time', 1778294348928
      ),
      JSON_OBJECT(
        'id', 'recipe_cucumber',
        '_id', 'recipe_cucumber',
        'name', '凉拌黄瓜',
        'category', '凉菜',
        'ingredients', JSON_ARRAY('黄瓜', '蒜', '醋'),
        'steps', JSON_ARRAY('黄瓜拍碎', '调汁', '拌匀'),
        'family_id', 'default_family',
        'create_time', 1778294358928
      )
    )
  )
)
ON DUPLICATE KEY UPDATE
  recipe_json = VALUES(recipe_json),
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO family_shopping_items
  (item_id, family_code, item_json, create_time, created_by, updated_by, version, deleted_at)
VALUES
  (
    'shop_tomato',
    'default_family',
    JSON_OBJECT(
      'name', '番茄',
      'num', '3个',
      'category', '蔬菜',
      'price', '6',
      'done', false,
      'family_id', 'default_family',
      '_id', 'shop_tomato',
      'create_time', 1778294348928,
      'id', 'shop_tomato'
    ),
    1778294348928,
    'member_a',
    'member_a',
    1,
    NULL
  ),
  (
    'shop_egg',
    'default_family',
    JSON_OBJECT(
      'name', '鸡蛋',
      'num', '1盒',
      'category', '蛋奶',
      'price', '12',
      'done', true,
      'family_id', 'default_family',
      '_id', 'shop_egg',
      'create_time', 1778294358928,
      'id', 'shop_egg'
    ),
    1778294358928,
    'member_a',
    'member_b',
    1,
    NULL
  )
ON DUPLICATE KEY UPDATE
  item_json = VALUES(item_json),
  create_time = VALUES(create_time),
  updated_by = VALUES(updated_by),
  version = version + 1,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO family_ingredient_items
  (item_id, family_code, item_json, create_time, created_by, updated_by, version, deleted_at)
VALUES
  (
    'ingredient_rice',
    'default_family',
    JSON_OBJECT(
      'name', '大米',
      'num', '5kg',
      'category', '主食',
      'price', '35',
      'done', false,
      'family_id', 'default_family',
      '_id', 'ingredient_rice',
      'create_time', 1778294368928,
      'id', 'ingredient_rice'
    ),
    1778294368928,
    'member_a',
    'member_a',
    1,
    NULL
  ),
  (
    'ingredient_garlic',
    'default_family',
    JSON_OBJECT(
      'name', '大蒜',
      'num', '1袋',
      'category', '调味',
      'price', '5',
      'done', false,
      'family_id', 'default_family',
      '_id', 'ingredient_garlic',
      'create_time', 1778294378928,
      'id', 'ingredient_garlic'
    ),
    1778294378928,
    'member_b',
    'member_b',
    1,
    NULL
  )
ON DUPLICATE KEY UPDATE
  item_json = VALUES(item_json),
  create_time = VALUES(create_time),
  updated_by = VALUES(updated_by),
  version = version + 1,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;
