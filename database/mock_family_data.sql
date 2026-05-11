CREATE DATABASE IF NOT EXISTS node_servers DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE node_servers;

-- 这份 SQL 用来给真实 MySQL 灌一组演示数据，不是 USE_MOCK_DB 的内存 mock。
-- 它可以重复执行：下面大量使用 ON DUPLICATE KEY UPDATE，
-- 已存在的数据会被更新，不会因为唯一键冲突中断。

-- 1. 准备一个默认家庭。family_code 是后续所有共享数据的关联主键。
INSERT INTO families (family_code, family_name, is_deleted)
VALUES ('default_family', '默认家庭', 0)
ON DUPLICATE KEY UPDATE
  family_name = VALUES(family_name),
  is_deleted = 0;

-- 2. 准备两个家庭成员。聚合接口 /api/family-data/member/member_a
-- 会先从 family_members 查 member_a 属于哪个家庭，再读取这个家庭的数据。
INSERT INTO family_members (member_code, family_code, joined_family)
VALUES
  ('member_a', 'default_family', 1),
  ('member_b', 'default_family', 1)
ON DUPLICATE KEY UPDATE
  family_code = VALUES(family_code),
  joined_family = VALUES(joined_family);

-- 3. 菜谱当前按“家庭 -> 一整份 JSON”存储，所以 family_recipes 每个家庭只有一行。
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

-- 4. 购物清单按 item 存储。item_json 保留前端原始字段，
-- item_id / family_code / version / deleted_at 则服务于后端同步逻辑。
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

-- 5. 食材库和购物清单字段目前相同，但单独放在 family_ingredient_items。
-- 这样以后比如食材库要加保质期、库存预警，不会影响购物清单。
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
