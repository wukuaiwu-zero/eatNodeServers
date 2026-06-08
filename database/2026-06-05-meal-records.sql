-- 三餐食光手账后端字段变更
-- 用途：让 family_daily_meal_plans 支持每个餐次的打卡 record。
-- 图片上传只返回原图 photoUrl，并存入 record_json，不需要新增图片表或缩略图字段。
-- 注意：如果字段已经存在，不要重复执行 ALTER TABLE。

ALTER TABLE family_daily_meal_plans
ADD COLUMN record_json LONGTEXT DEFAULT NULL AFTER done;
