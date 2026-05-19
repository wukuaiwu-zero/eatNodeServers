CREATE DATABASE IF NOT EXISTS node_servers DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE node_servers;

-- 这份 SQL 用来给真实 MySQL 灌一组演示数据，不是 USE_MOCK_DB 的内存 mock。
-- 它可以重复执行：下面大量使用 ON DUPLICATE KEY UPDATE，
-- 已存在的数据会被更新，不会因为唯一键冲突中断。

-- 1. 准备一个默认匿名设备。演示请求可使用：
-- X-Device-Id: demo_device
-- X-Device-Secret: demo_secret
INSERT INTO devices (device_id, device_secret_hash, last_seen_at)
VALUES (
  'demo_device',
  'demo_salt_1234567:6fd0a893dc2d9f0dd5ae90a6197e5fad33cf8264511f9f9ac12a4e2b3bd65cfc',
  CURRENT_TIMESTAMP
)
ON DUPLICATE KEY UPDATE
  last_seen_at = CURRENT_TIMESTAMP;

-- 2. 准备一个默认家庭。family_code 是后续所有共享数据的关联主键。
INSERT INTO families (family_code, family_name, is_deleted, created_by_device_id)
VALUES ('default_family', '默认家庭', 0, 'demo_device')
ON DUPLICATE KEY UPDATE
  family_name = VALUES(family_name),
  is_deleted = 0,
  created_by_device_id = VALUES(created_by_device_id);

-- 3. 准备默认家庭成员。聚合接口会通过设备身份找到家庭，再读取家庭数据。
INSERT INTO family_members (member_code, family_code, device_id, role, joined_family)
VALUES
  ('demo_device', 'default_family', 'demo_device', 'owner', 1)
ON DUPLICATE KEY UPDATE
  family_code = VALUES(family_code),
  device_id = VALUES(device_id),
  role = VALUES(role),
  joined_family = VALUES(joined_family),
  revoked_at = NULL;

-- 4. 菜谱当前按“家庭 -> 一整份 JSON”存储，所以 family_recipes 每个家庭只有一行。
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

-- 5. 购物清单按字段存储，item_id / family_code / version / deleted_at 服务于后端同步逻辑。
INSERT INTO family_shopping_items
  (item_id, family_code, name, quantity, category_id, price, done, create_time, created_by, updated_by, version, deleted_at)
VALUES
  (
    'shop_tomato',
    'default_family',
    '番茄',
    '3个',
    'shopping_cat_vegetable',
    '6',
    0,
    1778294348928,
    'demo_device',
    'demo_device',
    1,
    NULL
  ),
  (
    'shop_egg',
    'default_family',
    '鸡蛋',
    '1盒',
    'shopping_cat_egg_dairy',
    '12',
    1,
    1778294358928,
    'demo_device',
    'demo_device',
    1,
    NULL
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  quantity = VALUES(quantity),
  category_id = VALUES(category_id),
  price = VALUES(price),
  done = VALUES(done),
  create_time = VALUES(create_time),
  updated_by = VALUES(updated_by),
  version = version + 1,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

-- 6. 食材库按字段存储，方便按分类、库存和过期时间查询。
INSERT INTO family_ingredient_items
  (item_id, family_code, name, quantity, category_id, price, has_stock, expire_date, create_time, created_by, updated_by, version, deleted_at)
VALUES
  (
    'ingredient_rice',
    'default_family',
    '大米',
    '5kg',
    'ingredient_cat_staple',
    '35',
    1,
    NULL,
    1778294368928,
    'demo_device',
    'demo_device',
    1,
    NULL
  ),
  (
    'ingredient_garlic',
    'default_family',
    '大蒜',
    '1袋',
    'ingredient_cat_seasoning',
    '5',
    1,
    NULL,
    1778294378928,
    'demo_device',
    'demo_device',
    1,
    NULL
  )
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  quantity = VALUES(quantity),
  category_id = VALUES(category_id),
  price = VALUES(price),
  has_stock = VALUES(has_stock),
  expire_date = VALUES(expire_date),
  create_time = VALUES(create_time),
  updated_by = VALUES(updated_by),
  version = version + 1,
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

-- 7. 购物车类别、食材类别和菜品类别按家庭存储。
-- 默认类别是每个家庭初始化时都会有的基础选项，用户后续可以自己新增类别。
INSERT INTO family_shopping_categories
  (category_id, family_code, name, sort_order, is_default, created_by, updated_by, version, deleted_at)
VALUES
  ('shopping_cat_staple', 'default_family', '主食', 10, 1, 'system', 'system', 1, NULL),
  ('shopping_cat_vegetable', 'default_family', '蔬菜', 20, 1, 'system', 'system', 1, NULL),
  ('shopping_cat_meat', 'default_family', '肉类', 30, 1, 'system', 'system', 1, NULL),
  ('shopping_cat_egg_dairy', 'default_family', '蛋奶', 40, 1, 'system', 'system', 1, NULL),
  ('shopping_cat_seasoning', 'default_family', '调味', 50, 1, 'system', 'system', 1, NULL),
  ('shopping_cat_other', 'default_family', '其他', 900, 1, 'system', 'system', 1, NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_default = VALUES(is_default),
  updated_by = VALUES(updated_by),
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO family_ingredient_categories
  (category_id, family_code, name, sort_order, is_default, created_by, updated_by, version, deleted_at)
VALUES
  ('ingredient_cat_staple', 'default_family', '主食', 10, 1, 'system', 'system', 1, NULL),
  ('ingredient_cat_vegetable', 'default_family', '蔬菜', 20, 1, 'system', 'system', 1, NULL),
  ('ingredient_cat_meat', 'default_family', '肉类', 30, 1, 'system', 'system', 1, NULL),
  ('ingredient_cat_egg_dairy', 'default_family', '蛋奶', 40, 1, 'system', 'system', 1, NULL),
  ('ingredient_cat_seasoning', 'default_family', '调味', 50, 1, 'system', 'system', 1, NULL),
  ('ingredient_cat_other', 'default_family', '其他', 900, 1, 'system', 'system', 1, NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_default = VALUES(is_default),
  updated_by = VALUES(updated_by),
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;

INSERT INTO family_recipe_categories
  (category_id, family_code, name, sort_order, is_default, created_by, updated_by, version, deleted_at)
VALUES
  ('recipe_cat_home', 'default_family', '家常菜', 10, 1, 'system', 'system', 1, NULL),
  ('recipe_cat_cold', 'default_family', '凉菜', 20, 1, 'system', 'system', 1, NULL),
  ('recipe_cat_soup', 'default_family', '汤羹', 30, 1, 'system', 'system', 1, NULL),
  ('recipe_cat_staple', 'default_family', '主食', 40, 1, 'system', 'system', 1, NULL),
  ('recipe_cat_breakfast', 'default_family', '早餐', 50, 1, 'system', 'system', 1, NULL),
  ('recipe_cat_other', 'default_family', '其他', 900, 1, 'system', 'system', 1, NULL)
ON DUPLICATE KEY UPDATE
  name = VALUES(name),
  sort_order = VALUES(sort_order),
  is_default = VALUES(is_default),
  updated_by = VALUES(updated_by),
  deleted_at = NULL,
  updated_at = CURRENT_TIMESTAMP;
