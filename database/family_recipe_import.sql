CREATE DATABASE IF NOT EXISTS node_servers DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE node_servers;

CREATE TABLE IF NOT EXISTS families (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  family_name VARCHAR(100) DEFAULT NULL,
  is_deleted TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_families_family_code (family_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_members (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_code VARCHAR(100) NOT NULL,
  family_code VARCHAR(100) NOT NULL,
  joined_family TINYINT(1) NOT NULL DEFAULT 0,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_members_member_code (member_code),
  KEY idx_family_members_family_code (family_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS family_recipes (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  family_code VARCHAR(100) NOT NULL,
  recipe_json LONGTEXT NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_recipes_family_code (family_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

INSERT INTO families (family_code, family_name, is_deleted)
VALUES
  ('FAM001', '林家小厨房', 0),
  ('FAM002', '周末家宴', 0),
  ('FAM003', '外婆的菜单', 0),
  ('FAM004', '健身轻食组', 0),
  ('FAM005', '川湘爱好者', 0),
  ('FAM006', '海边早餐铺', 0)
ON DUPLICATE KEY UPDATE
  family_name = VALUES(family_name),
  is_deleted = VALUES(is_deleted);

INSERT INTO family_members (member_code, family_code, joined_family)
VALUES
  ('MEM001', 'FAM001', 1),
  ('MEM002', 'FAM001', 1),
  ('MEM003', 'FAM001', 1),
  ('MEM004', 'FAM002', 1),
  ('MEM005', 'FAM002', 1),
  ('MEM006', 'FAM003', 1),
  ('MEM007', 'FAM003', 1),
  ('MEM008', 'FAM003', 1),
  ('MEM009', 'FAM004', 1),
  ('MEM010', 'FAM004', 1),
  ('MEM011', 'FAM005', 1),
  ('MEM012', 'FAM005', 1),
  ('MEM013', 'FAM005', 1),
  ('MEM014', 'FAM006', 1),
  ('MEM015', 'FAM006', 1)
ON DUPLICATE KEY UPDATE
  family_code = VALUES(family_code),
  joined_family = VALUES(joined_family);

INSERT INTO family_recipes (family_code, recipe_json)
VALUES
  ('FAM001', '{"recipes":[{"name":"番茄炒蛋","category":"家常菜","servings":2,"cookTimeMinutes":12,"ingredients":["番茄","鸡蛋","葱花","盐"],"steps":["番茄切块，鸡蛋打散","热锅炒蛋后盛出","下番茄炒出汁，倒回鸡蛋调味"]},{"name":"土豆炖牛腩","category":"炖菜","servings":4,"cookTimeMinutes":80,"ingredients":["牛腩","土豆","胡萝卜","生抽","八角"],"steps":["牛腩焯水","加入香料和调味料炖煮","放入土豆胡萝卜收汁"]}]}'),
  ('FAM002', '{"recipes":[{"name":"蒜蓉粉丝虾","category":"宴客菜","servings":3,"cookTimeMinutes":25,"ingredients":["鲜虾","粉丝","蒜蓉","蒸鱼豉油"],"steps":["粉丝泡软铺盘","鲜虾开背放在粉丝上","淋蒜蓉酱蒸熟"]},{"name":"香菇滑鸡","category":"蒸菜","servings":3,"cookTimeMinutes":30,"ingredients":["鸡腿肉","香菇","姜丝","蚝油"],"steps":["鸡肉切块腌制","香菇泡发切片","混合后上锅蒸熟"]}]}'),
  ('FAM003', '{"recipes":[{"name":"红烧狮子头","category":"传统菜","servings":4,"cookTimeMinutes":60,"ingredients":["猪肉末","荸荠","鸡蛋","青菜","老抽"],"steps":["肉末加配料搅打上劲","团成大丸子煎定型","加入酱汁小火焖煮"]},{"name":"莲藕排骨汤","category":"汤","servings":4,"cookTimeMinutes":90,"ingredients":["排骨","莲藕","姜片","盐"],"steps":["排骨焯水洗净","莲藕切块","加水小火煲至软烂"]},{"name":"葱油拌面","category":"主食","servings":2,"cookTimeMinutes":15,"ingredients":["面条","小葱","生抽","老抽","糖"],"steps":["小葱炸成葱油","调好酱汁","面条煮熟后拌匀"]}]}'),
  ('FAM004', '{"recipes":[{"name":"鸡胸藜麦碗","category":"轻食","servings":1,"cookTimeMinutes":25,"ingredients":["鸡胸肉","藜麦","西兰花","玉米粒"],"steps":["藜麦煮熟","鸡胸肉煎熟切片","蔬菜焯水后组合装碗"]},{"name":"牛油果虾仁沙拉","category":"沙拉","servings":2,"cookTimeMinutes":18,"ingredients":["牛油果","虾仁","生菜","圣女果","柠檬汁"],"steps":["虾仁煮熟放凉","蔬果切块","加入柠檬汁和黑胡椒拌匀"]}]}'),
  ('FAM005', '{"recipes":[{"name":"麻婆豆腐","category":"川菜","servings":3,"cookTimeMinutes":20,"ingredients":["嫩豆腐","肉末","豆瓣酱","花椒粉"],"steps":["豆腐切块焯水","炒香肉末和豆瓣酱","加豆腐烧入味后勾芡"]},{"name":"小炒黄牛肉","category":"湘菜","servings":3,"cookTimeMinutes":18,"ingredients":["黄牛肉","小米辣","香菜","蒜","生抽"],"steps":["牛肉切薄片腌制","大火快炒牛肉","加入辣椒香菜翻匀"]}]}'),
  ('FAM006', '{"recipes":[{"name":"海鲜粥","category":"早餐","servings":3,"cookTimeMinutes":45,"ingredients":["大米","虾仁","鱿鱼","姜丝","葱花"],"steps":["大米煮成粥底","放入姜丝和海鲜煮熟","撒葱花调味"]},{"name":"蟹柳厚蛋烧","category":"早餐","servings":2,"cookTimeMinutes":15,"ingredients":["鸡蛋","蟹柳","牛奶","盐"],"steps":["鸡蛋加牛奶打散","小火分层卷起","切块装盘"]}]}')
ON DUPLICATE KEY UPDATE
  recipe_json = VALUES(recipe_json);
