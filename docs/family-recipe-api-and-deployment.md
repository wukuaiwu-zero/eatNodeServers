# 家庭菜谱接口文档与部署说明

## 1. 项目说明

本项目提供家庭菜谱同步接口，核心逻辑是：

- 每个家庭有唯一且不可更改的 `familyCode`。
- 每个本地用户/设备有唯一的 `memberCode`。
- 用户首次上传菜谱时，会绑定 `memberCode -> familyCode`。
- 用户加入其他家庭后，`memberCode` 会绑定到目标 `familyCode`，且之后不能再切换到第三个家庭。
- 家庭菜谱按 `familyCode` 存储，同家庭成员拉取同一份 `recipeJson`。

推荐客户端优先使用 `memberCode` 拉取菜谱，由服务端根据成员绑定关系决定当前家庭。

## 2. 基础信息

本地基础地址：

```text
http://localhost:3000
```

生产环境示例：

```text
https://api.example.com
```

请求格式：

```text
Content-Type: application/json
```

统一响应结构：

```json
{
  "data": {}
}
```

错误响应结构：

```json
{
  "message": "错误说明"
}
```

## 3. 数据表

### 3.1 families

家庭表，记录家庭本身。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT UNSIGNED | 主键，自增 |
| family_code | VARCHAR(100) | 家庭码，唯一，不可更改 |
| family_name | VARCHAR(100) | 家庭名称，可为空 |
| is_deleted | TINYINT(1) | 是否软删除 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 3.2 family_members

家庭成员绑定表，记录本地成员属于哪个家庭。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT UNSIGNED | 主键，自增 |
| member_code | VARCHAR(100) | 成员码，唯一 |
| family_code | VARCHAR(100) | 当前绑定家庭码 |
| joined_family | TINYINT(1) | 是否已经加入过家庭 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

### 3.3 family_recipes

家庭菜谱表。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | INT UNSIGNED | 主键，自增 |
| family_code | VARCHAR(100) | 家庭码，唯一 |
| recipe_json | LONGTEXT | 菜谱 JSON 长文本 |
| created_at | TIMESTAMP | 创建时间 |
| updated_at | TIMESTAMP | 更新时间 |

## 4. 家庭接口

### 4.1 创建家庭

```text
POST /api/families
```

请求体：

```json
{
  "familyCode": "FAM001",
  "familyName": "我家的菜谱"
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| familyCode | 是 | 家庭码，最长 100 字符，唯一且不可更改 |
| familyName | 否 | 家庭名称，最长 100 字符 |

成功响应：

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "我家的菜谱",
    "isDeleted": false,
    "createdAt": "2026-05-08T06:44:49.094Z",
    "updatedAt": "2026-05-08T06:44:49.094Z"
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | `familyCode` 缺失或字段过长 |
| 409 | `familyCode` 已存在 |

### 4.2 查询家庭

```text
GET /api/families/:familyCode
```

示例：

```bash
curl http://localhost:3000/api/families/FAM001
```

成功响应：

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "我家的菜谱",
    "isDeleted": false,
    "createdAt": "2026-05-08T06:44:49.094Z",
    "updatedAt": "2026-05-08T06:44:49.094Z"
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | `familyCode` 不合法 |
| 404 | 家庭不存在或已删除 |

### 4.3 修改家庭名

```text
PATCH /api/families/:familyCode
```

说明：只允许修改 `familyName`，不允许修改 `familyCode`。

请求体：

```json
{
  "familyName": "新的家庭名"
}
```

成功响应：

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "新的家庭名",
    "isDeleted": false,
    "createdAt": "2026-05-08T06:44:49.094Z",
    "updatedAt": "2026-05-08T06:45:01.408Z"
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | 字段不合法 |
| 404 | 家庭不存在或已删除 |

### 4.4 删除家庭

```text
DELETE /api/families/:familyCode
```

说明：当前是软删除，即设置 `is_deleted = 1`，不会物理删除数据。

成功响应：

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "我家的菜谱",
    "isDeleted": true,
    "createdAt": "2026-05-08T06:44:49.094Z",
    "updatedAt": "2026-05-08T06:45:20.881Z"
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | `familyCode` 不合法 |
| 404 | 家庭不存在或已删除 |

### 4.5 查询家庭成员

```text
GET /api/families/:familyCode/members
```

成功响应：

```json
{
  "data": [
    {
      "id": 1,
      "memberCode": "M001",
      "familyCode": "FAM001",
      "joinedFamily": false,
      "createdAt": "2026-05-08T06:45:01.415Z",
      "updatedAt": "2026-05-08T06:45:01.415Z"
    }
  ]
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | `familyCode` 不合法 |
| 404 | 家庭不存在或已删除 |

## 5. 家庭菜谱接口

### 5.1 上传或更新家庭菜谱

```text
POST /api/family-recipes/upload
```

请求体：

```json
{
  "memberCode": "M001",
  "familyCode": "FAM001",
  "recipeJson": {
    "recipes": [
      {
        "name": "番茄炒蛋",
        "ingredients": ["番茄", "鸡蛋"]
      }
    ]
  }
}
```

字段说明：

| 字段 | 必填 | 说明 |
| --- | --- | --- |
| memberCode | 是 | 成员码，最长 100 字符 |
| familyCode | 是 | 家庭码，最长 100 字符 |
| recipeJson | 是 | 菜谱 JSON，可传对象、数组或字符串化 JSON |

业务规则：

- 如果 `familyCode` 不存在，会自动创建家庭。
- 如果 `memberCode` 第一次出现，会绑定到当前 `familyCode`。
- 如果 `memberCode` 已绑定其他 `familyCode`，不允许通过上传接口切换家庭。
- 同一 `familyCode` 重复上传会更新原有 `recipeJson`。

成功响应：

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "M001",
      "familyCode": "FAM001",
      "joinedFamily": false,
      "createdAt": "2026-05-08T06:45:01.415Z",
      "updatedAt": "2026-05-08T06:45:01.415Z"
    },
    "recipe": {
      "id": 1,
      "familyCode": "FAM001",
      "recipeJson": {
        "recipes": [
          {
            "name": "番茄炒蛋",
            "ingredients": ["番茄", "鸡蛋"]
          }
        ]
      },
      "createdAt": "2026-05-08T06:45:01.416Z",
      "updatedAt": "2026-05-08T06:45:01.416Z"
    }
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | 参数缺失、字段过长或 `recipeJson` 不是合法 JSON |
| 409 | `memberCode` 已绑定其他家庭 |

### 5.2 加入家庭

```text
POST /api/family-recipes/join
```

请求体：

```json
{
  "memberCode": "M001",
  "familyCode": "FAM002"
}
```

业务规则：

- 目标 `familyCode` 必须已存在于家庭表。
- 未绑定过的 `memberCode` 可以直接加入目标家庭。
- 已绑定自己初始家庭但未加入过其他家庭的 `memberCode`，可以加入一个目标家庭。
- 一旦 `joinedFamily = true`，不能再切换到第三个家庭。

成功响应：

```json
{
  "data": {
    "id": 1,
    "memberCode": "M001",
    "familyCode": "FAM002",
    "joinedFamily": true,
    "createdAt": "2026-05-08T06:45:01.415Z",
    "updatedAt": "2026-05-08T06:45:12.793Z"
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | 参数缺失或字段过长 |
| 404 | 目标家庭不存在 |
| 409 | 该成员已经加入过家庭，不能再次切换 |

### 5.3 按成员码拉取菜谱

```text
GET /api/family-recipes/member/:memberCode
```

推荐客户端使用这个接口拉取菜谱。

成功响应：

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "M001",
      "familyCode": "FAM002",
      "joinedFamily": true,
      "createdAt": "2026-05-08T06:45:01.415Z",
      "updatedAt": "2026-05-08T06:45:12.793Z"
    },
    "recipe": {
      "id": 2,
      "familyCode": "FAM002",
      "recipeJson": {
        "recipes": [
          {
            "name": "红烧肉"
          }
        ]
      },
      "createdAt": "2026-05-08T06:45:01.605Z",
      "updatedAt": "2026-05-08T06:45:01.605Z"
    }
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | `memberCode` 不合法 |
| 404 | 成员不存在或家庭菜谱不存在 |

### 5.4 按家庭码直接拉取菜谱

```text
GET /api/family-recipes/:familyCode
```

说明：这是兼容接口。更严格的业务场景建议只开放按 `memberCode` 拉取，避免知道家庭码的人直接读取菜谱。

成功响应：

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "recipeJson": {
      "recipes": [
        {
          "name": "番茄炒蛋"
        }
      ]
    },
    "createdAt": "2026-05-08T06:45:01.416Z",
    "updatedAt": "2026-05-08T06:45:01.416Z"
  }
}
```

可能错误：

| 状态码 | 说明 |
| --- | --- |
| 400 | `familyCode` 不合法 |
| 404 | 家庭菜谱不存在 |

## 6. 推荐客户端流程

### 6.1 首次使用

1. 客户端本地生成 `memberCode`。
2. 客户端本地生成 `familyCode`。
3. 调用 `POST /api/families` 创建家庭，或者首次上传菜谱时自动创建。
4. 调用 `POST /api/family-recipes/upload` 上传本地菜谱。
5. 客户端保存 `memberCode`，后续使用 `memberCode` 拉取菜谱。

### 6.2 加入别人家庭

1. 用户输入或扫码获得目标 `familyCode`。
2. 调用 `POST /api/family-recipes/join`。
3. 成功后本地不要再使用旧家庭码作为当前家庭。
4. 后续调用 `GET /api/family-recipes/member/:memberCode` 拉取目标家庭菜谱。

### 6.3 同家庭成员同步菜谱

1. 任意家庭成员调用上传接口更新菜谱。
2. 其他同家庭成员调用按成员码拉取接口。
3. 服务端根据 `memberCode` 找到当前绑定的 `familyCode`，返回该家庭的最新 `recipeJson`。

## 7. 部署到服务器流程

以下以一台 Linux 服务器为例，例如 Ubuntu 22.04。

### 7.1 准备服务器

需要安装：

- Node.js，建议 LTS 版本。
- MySQL 8.x。
- Nginx。
- PM2，用于守护 Node 服务。
- Git，用于拉代码。

示例命令：

```bash
sudo apt update
sudo apt install -y git nginx mysql-server
```

Node.js 建议使用 NodeSource 或 nvm 安装 LTS 版本。

安装 PM2：

```bash
npm install -g pm2
```

### 7.2 上传或拉取项目代码

方式一：服务器上直接拉 Git 仓库：

```bash
cd /var/www
git clone <你的仓库地址> nodeServers
cd nodeServers
```

方式二：用 scp、rsync 或面板上传项目目录到服务器。

### 7.3 安装依赖

```bash
cd /var/www/nodeServers
npm install --production
```

### 7.4 初始化 MySQL

登录 MySQL：

```bash
sudo mysql
```

创建数据库用户，示例：

```sql
CREATE USER 'node_servers_user'@'localhost' IDENTIFIED BY '强密码';
GRANT ALL PRIVILEGES ON node_servers.* TO 'node_servers_user'@'localhost';
FLUSH PRIVILEGES;
```

执行建表脚本：

```bash
mysql -u root -p < database/schema.sql
```

如果使用独立数据库用户，也可以：

```bash
mysql -u node_servers_user -p < database/schema.sql
```

### 7.5 配置环境变量

在项目根目录创建 `.env`：

```text
NODE_ENV=production
PORT=3000
USE_MOCK_DB=false

DB_HOST=127.0.0.1
DB_PORT=3306
DB_USER=node_servers_user
DB_PASSWORD=强密码
DB_NAME=node_servers
DB_CONNECTION_LIMIT=10
```

注意：`.env` 不要提交到公开仓库。

### 7.6 启动服务

先本地测试启动：

```bash
npm run start
```

确认没问题后用 PM2 启动：

```bash
pm2 start src/server.js --name node-servers
pm2 save
pm2 startup
```

查看服务状态：

```bash
pm2 status
pm2 logs node-servers
```

### 7.7 配置 Nginx 反向代理

创建配置文件：

```bash
sudo nano /etc/nginx/sites-available/node-servers
```

示例配置：

```nginx
server {
    listen 80;
    server_name api.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

启用配置：

```bash
sudo ln -s /etc/nginx/sites-available/node-servers /etc/nginx/sites-enabled/node-servers
sudo nginx -t
sudo systemctl reload nginx
```

### 7.8 配置 HTTPS

如果已经有域名并解析到服务器，可以用 Certbot 免费申请 HTTPS 证书：

```bash
sudo apt install -y certbot python3-certbot-nginx
sudo certbot --nginx -d api.example.com
```

证书会自动续期，可以检查：

```bash
sudo certbot renew --dry-run
```

### 7.9 验证生产接口

```bash
curl https://api.example.com/api/families/FAM001
```

创建家庭：

```bash
curl -X POST https://api.example.com/api/families \
  -H 'Content-Type: application/json' \
  -d '{"familyCode":"FAM001","familyName":"我家的菜谱"}'
```

上传菜谱：

```bash
curl -X POST https://api.example.com/api/family-recipes/upload \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"M001","familyCode":"FAM001","recipeJson":{"recipes":[{"name":"番茄炒蛋"}]}}'
```

## 8. 是否需要域名

域名不是启动服务的必需条件。你可以直接用：

```text
http://服务器公网IP:3000
```

或者通过 Nginx：

```text
http://服务器公网IP
```

但生产环境建议准备域名，原因是：

- HTTPS 通常需要域名来签发证书。
- App、小程序、网页调用接口时，HTTPS 更稳定，也更符合平台要求。
- 服务器 IP 可能更换，域名可以保持接口地址不变。
- 域名更便于后续区分环境，例如 `api.example.com`、`test-api.example.com`。

推荐方案：

```text
正式环境：https://api.example.com
测试环境：https://test-api.example.com
```

如果只是自己临时测试，可以先不用域名，用服务器 IP 调接口即可。等准备给用户使用、接入 App、小程序或 Web 前端时，再补域名和 HTTPS。

## 9. 上线注意事项

- 不要在生产环境开启 `USE_MOCK_DB=true`。
- 数据库密码使用强密码。
- 建议服务器安全组只开放 `80`、`443`、必要的 `22` 端口。
- MySQL 不建议直接开放公网访问。
- 当前没有登录鉴权，`memberCode` 和 `familyCode` 本质上就是访问凭证。
- 如果后续面向真实用户，建议增加账号登录、家庭邀请码有效期、成员权限、操作日志和接口限流。
- `GET /api/family-recipes/:familyCode` 是兼容接口，如果担心家庭码泄露后被直接读取，建议下线该接口，只保留按 `memberCode` 拉取。
