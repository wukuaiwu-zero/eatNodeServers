-- 家庭采购锚定价格
-- 跟购物清单条目分开存：清单是一次次的待购，锚定是家庭对某个物件的长期参考价。
-- 同一家庭下，名称 + 可选标签唯一。标签为空表示这个名称的默认锚定。

CREATE TABLE IF NOT EXISTS family_anchor_prices (
  id BIGINT(20) NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  anchor_id VARCHAR(64) NOT NULL COMMENT '锚定价格ID',
  family_code VARCHAR(100) NOT NULL COMMENT '家庭码',
  name VARCHAR(100) NOT NULL COMMENT '采购物件名称',
  name_key VARCHAR(100) NOT NULL COMMENT '归一化名称，用于匹配',
  tag VARCHAR(50) DEFAULT NULL COMMENT '可选区分：渠道/品牌/规格，空为默认锚定',
  tag_key VARCHAR(50) NOT NULL DEFAULT '' COMMENT '归一化标签，空串表示默认',
  anchor_price DECIMAL(10,2) NOT NULL COMMENT '锚定价格',
  created_by VARCHAR(64) DEFAULT NULL COMMENT '创建成员码',
  updated_by VARCHAR(64) DEFAULT NULL COMMENT '更新成员码',
  version INT(11) NOT NULL DEFAULT 1 COMMENT '版本号',
  deleted_at TIMESTAMP NULL DEFAULT NULL COMMENT '软删除时间',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (id),
  UNIQUE KEY uk_family_anchor_id (anchor_id),
  UNIQUE KEY uk_family_anchor_name_tag (family_code, name_key, tag_key),
  KEY idx_family_anchor_updated (family_code, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='家庭采购锚定价格';
