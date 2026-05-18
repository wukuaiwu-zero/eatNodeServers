# 线上部署更新步骤

这次更新包含：

- 新增分类表：`family_shopping_categories`、`family_ingredient_categories`、`family_recipe_categories`
- 新增菜品随机池表：`family_recipe_pool_items`
- `family_recipes` 新增 `cover_url`
- `family_members` 新增 `member_name`、`title`、`avatar_url`
- 删除旧 mock/demo 表：`weather_icons`、`users`

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

## 3. 备份数据库

```bash
mysqldump -u root -p node_servers > /www/backup/node_servers_$(date +%F_%H%M%S).sql
```

如果没有 `/www/backup`：

```bash
mkdir -p /www/backup
```

## 4. 执行本次数据库变更

```bash
mysql -u root -p node_servers < database/production_update_2026_05_18.sql
```

这个 SQL 会：

- 缺字段才加字段
- 缺表才建表
- 删除 `weather_icons` 和 `users`

## 5. 确认表结构

```bash
mysql -u root -p node_servers -e "SHOW TABLES;"
mysql -u root -p node_servers -e "SHOW COLUMNS FROM family_recipes LIKE 'cover_url';"
mysql -u root -p node_servers -e "SHOW COLUMNS FROM family_members WHERE Field IN ('member_name','title','avatar_url');"
```

预期能看到：

```text
family_shopping_categories
family_ingredient_categories
family_recipe_categories
family_recipe_pool_items
```

并且不再有：

```text
users
weather_icons
```

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

```bash
curl -i http://127.0.0.1:3000/api/getFamilyData
```

未带设备凭证时返回认证错误是正常的，说明服务已经启动并命中接口。

再用 Postman 导入：

```text
docs/apifox-postman-collection.json
```

按这个顺序测：

1. `POST /api/registerDevice`
2. `POST /api/createFamily`
3. `GET /api/getFamilyData`
4. `GET /api/getFamilyRecipePoolItems`
5. `GET /api/getFamilyMembers?familyCode={{familyCode}}`
