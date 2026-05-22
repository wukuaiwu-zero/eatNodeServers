# 线上部署更新步骤

这次更新包含：

- `family_members` 新增 `relation_type`，支持基础家庭和多家庭关系。
- `family_recipes` 从整份 `recipe_json` 改为一行一道菜谱。
- 新增 `family_recipe_ingredients`，用于保存菜谱配料明细。
- `steps` 继续以 JSON 数组形式存到 `family_recipes.steps_json`。
- 新增单条菜谱接口：`saveFamilyRecipeItem`、`updateFamilyRecipeItem`、`getFamilyRecipeItem`。

## 1. 登录服务器并进入项目

```bash
cd /www/wwwroot/nodeServes
```

如果线上目录实际是 `nodeServers`，以实际目录为准。

## 2. 拉取代码

```bash
git pull origin main
npm install
```

如果 `git pull` 提示旧迁移文件有本地改动，先暂存：

```bash
git stash push -m "server local old migration" -- database/production_update_2026_05_18.sql
git pull origin main
```

## 3. 备份数据库

```bash
mysqldump -u root -p node_servers > /www/backup/node_servers_$(date +%F_%H%M%S).sql
```

如果没有 `/www/backup`：

```bash
mkdir -p /www/backup
```

## 4. 执行数据库变更

先跑结构变更：

```bash
mysql -u root -p node_servers < database/production_update_2026_05_22.sql
```

再把旧 `family_recipes.recipe_json` 迁移到字段表：

```bash
npm run migrate:recipes
```

`migrate:recipes` 用 Node 解析旧 JSON，兼容 MySQL 5.x。迁移后旧表会保留为：

```text
family_recipes_json_backup
```

## 5. 确认表结构

```bash
mysql -u root -p node_servers -e "SHOW COLUMNS FROM family_recipes;"
mysql -u root -p node_servers -e "SHOW TABLES LIKE 'family_recipe_ingredients';"
mysql -u root -p node_servers -e "SHOW COLUMNS FROM family_members LIKE 'relation_type';"
```

预期：

- `family_recipes` 有 `recipe_id/name/category/steps_json`。
- 有 `family_recipe_ingredients` 表。
- `family_members` 有 `relation_type` 字段。

## 6. 确保上传目录可写

菜谱封面会写入：

```text
public/uploads/recipe-covers
```

创建目录并设置权限：

```bash
mkdir -p public/uploads/recipe-covers
chmod -R 755 public/uploads
```

如果服务进程使用非当前用户运行，需要把目录 owner 改成实际运行用户。

## 7. 重启服务

```bash
pm2 restart node-servers
```

如果 PM2 应用名不同：

```bash
pm2 list
pm2 restart <实际应用名>
```

## 8. 简单验证

导入：

```text
docs/apifox-postman-collection.json
```

推荐顺序：

1. `POST /api/registerDevice`
2. `GET /api/getMyFamilies`
3. `POST /api/saveFamilyRecipeItem`
4. `GET /api/getFamilyRecipeItem?familyCode={{familyCode}}&id=recipe_qjrs`
5. `GET /api/getFamilyRecipe?familyCode={{familyCode}}`
6. `GET /api/getFamilyData`
