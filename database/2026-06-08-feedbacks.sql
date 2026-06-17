-- 时光邮局（意见反馈及回信）表结构
-- 用途：存放用户向系统提交的夸赞、建议、Bug 反馈，并支持全局管理员回信。

CREATE TABLE IF NOT EXISTS feedbacks (
  id BIGINT(20) NOT NULL COMMENT '主键ID',
  user_id VARCHAR(64) NOT NULL COMMENT '提交反馈的用户唯一ID/设备ID',
  type VARCHAR(20) NOT NULL COMMENT '反馈类型: love/idea/bug',
  content VARCHAR(600) NOT NULL COMMENT '反馈正文，最大300字',
  contact VARCHAR(100) DEFAULT NULL COMMENT '联系方式，最大50字',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '寄信时间',
  replied TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已回信: 0 未回复, 1 已回复',
  reply_text VARCHAR(600) DEFAULT NULL COMMENT '回信内容，最大200字',
  PRIMARY KEY (id),
  KEY idx_user_id (user_id),
  KEY idx_replied (replied),
  KEY idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COMMENT='意见反馈信箱表';

-- 兼容旧版本 feedbacks 表（旧字段：device_id/is_replied/replied_at/family_code）。
-- 如果是首次建表，下面语句会因列已存在或不存在而报错，可忽略对应错误。
-- 如需从旧表平滑迁移，请按实际库结构逐条执行。
-- ALTER TABLE feedbacks CHANGE COLUMN device_id user_id VARCHAR(64) NOT NULL COMMENT '提交反馈的用户唯一ID/设备ID';
-- ALTER TABLE feedbacks CHANGE COLUMN is_replied replied TINYINT(1) NOT NULL DEFAULT 0 COMMENT '是否已回信: 0 未回复, 1 已回复';
-- ALTER TABLE feedbacks MODIFY COLUMN content VARCHAR(600) NOT NULL COMMENT '反馈正文，最大300字';
-- ALTER TABLE feedbacks MODIFY COLUMN reply_text VARCHAR(600) DEFAULT NULL COMMENT '回信内容，最大200字';
-- ALTER TABLE feedbacks DROP COLUMN family_code;
-- ALTER TABLE feedbacks DROP COLUMN replied_at;
