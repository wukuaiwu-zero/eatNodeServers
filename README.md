# Node Servers API

Express + MySQL 后端接口服务，接口统一采用 action 风格：

- 查询类：`GET /api/getXxx?param=value`
- 新增、修改、删除类：`POST /api/saveXxx` 或 `POST /api/deleteXxx`，参数放 JSON body

## Base URL

本地开发：

```text
http://localhost:3000
```

公网测试：

```text
http://110.42.36.7:3000
```

## 快速启动

```bash
npm install
cp .env.example .env
npm run start
```

初始化数据库：

```bash
npm run db:init
```

灌入演示数据：

```bash
npm run db:seed:mock
```

## 文档索引

每个数据表/业务模块单独维护接口文档：

- [家庭表 families](docs/api-families.md)
- [家庭成员表 family_members](docs/api-family-members.md)
- [家庭菜谱表 family_recipes](docs/api-family-recipes.md)
- [购物清单表 family_shopping_items](docs/api-family-shopping-items.md)
- [食材库表 family_ingredient_items](docs/api-family-ingredient-items.md)
- [家庭聚合数据](docs/api-family-data.md)

## 服务器更新

```bash
cd /www/wwwroot/nodeServes
git pull origin main
npm install
pm2 restart node-servers
```

如果数据库结构或 mock 数据有更新：

```bash
npm run db:init
npm run db:seed:mock
pm2 restart node-servers
```

## 一键验证并提交推送

本地开发完成后可以运行：

```bash
npm run ship
```

自定义提交说明：

```bash
npm run ship -- "feat: update api"
```
