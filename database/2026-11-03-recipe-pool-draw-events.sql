-- 菜品随机池抽签事件表（P0）
-- 用途：记录每次加权抽签结果，供衰减与后续 feedback（accept/skip/cooked）使用。

CREATE TABLE IF NOT EXISTS family_recipe_pool_draw_events (
  id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  draw_id VARCHAR(64) NOT NULL COMMENT '同一次抽签批次ID',
  family_code VARCHAR(64) NOT NULL COMMENT '家庭码',
  dish_id VARCHAR(64) NOT NULL COMMENT '随机池菜品ID',
  dish_name VARCHAR(100) NOT NULL COMMENT '菜品名称快照',
  meal_name VARCHAR(50) DEFAULT NULL COMMENT '抽签餐次',
  action VARCHAR(20) NOT NULL COMMENT 'drawn|accept|skip|cooked|reject',
  score DECIMAL(10,4) DEFAULT NULL COMMENT '抽中时的权重分',
  context_json JSON DEFAULT NULL COMMENT '抽签上下文快照',
  created_by VARCHAR(64) DEFAULT NULL COMMENT '操作成员码',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (id),
  KEY idx_family_dish_time (family_code, dish_id, created_at),
  KEY idx_draw (draw_id),
  KEY idx_family_action_time (family_code, action, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='菜品随机池抽签事件';
