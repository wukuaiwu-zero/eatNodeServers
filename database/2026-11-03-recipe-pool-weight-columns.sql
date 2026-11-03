-- 菜品随机池加权字段（P1）
-- 用途：关联完整菜谱、支持手动权重与暂停抽签。
-- 如果列已存在，对应 ALTER 会报错，可忽略该条。

ALTER TABLE family_recipe_pool_items
  ADD COLUMN recipe_id VARCHAR(64) DEFAULT NULL COMMENT '关联家庭菜谱ID' AFTER name;

ALTER TABLE family_recipe_pool_items
  ADD COLUMN manual_weight DECIMAL(6,2) NOT NULL DEFAULT 1.00 COMMENT '手动权重 0.20~3.00' AFTER type;

ALTER TABLE family_recipe_pool_items
  ADD COLUMN paused TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否暂停参与抽签' AFTER manual_weight;

ALTER TABLE family_recipe_pool_items
  ADD KEY idx_family_recipe_pool_recipe (family_code, recipe_id);
