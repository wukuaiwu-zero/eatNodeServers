# Node Servers API 文档

Express + MySQL 后端接口服务，当前主要提供家庭、家庭成员、家庭菜谱、购物清单、食材库和家庭数据聚合接口。

## 基础信息

### Base URL

本地开发：

```text
http://localhost:3000
```

当前公网测试地址：

```text
http://110.42.36.7:3000
```

### 请求格式

除 `GET` 请求外，默认使用 JSON 请求体：

```http
Content-Type: application/json
```

### 统一成功响应

```json
{
  "data": {}
}
```

### 统一错误响应

```json
{
  "message": "错误说明"
}
```

### 通用状态码

| 状态码 | 说明 |
| --- | --- |
| 200 | 请求成功 |
| 201 | 创建成功 |
| 400 | 请求参数错误 |
| 404 | 资源不存在 |
| 409 | 数据冲突 |
| 500 | 服务端错误 |

## 快速启动

```bash
npm install
cp .env.example .env
npm run dev
```

生产启动：

```bash
npm run start
```

如果本地暂时没有 MySQL，可以在 `.env` 中开启 mock 数据：

```text
USE_MOCK_DB=true
```

## 环境变量

| 变量名 | 默认值 | 说明 |
| --- | --- | --- |
| NODE_ENV | development | 运行环境 |
| PORT | 3000 | 服务端口 |
| USE_MOCK_DB | false | 是否使用内存 mock 数据 |
| DB_HOST | 127.0.0.1 | MySQL 地址 |
| DB_PORT | 3306 | MySQL 端口 |
| DB_USER | root | MySQL 用户名 |
| DB_PASSWORD | 空 | MySQL 密码 |
| DB_NAME | node_servers | MySQL 数据库名 |
| DB_CONNECTION_LIMIT | 10 | MySQL 连接池数量 |

初始化数据库：

```bash
npm run db:init
```

灌入一组真实 MySQL 演示数据：

```bash
npm run db:seed:mock
```

## 接口总览

| 模块 | 方法 | 路径 | 说明 |
| --- | --- | --- | --- |
| 家庭 | POST | `/api/families` | 创建家庭 |
| 家庭 | GET | `/api/families/:familyCode` | 查询家庭 |
| 家庭 | PATCH | `/api/families/:familyCode` | 修改家庭名 |
| 家庭 | DELETE | `/api/families/:familyCode` | 软删除家庭 |
| 家庭 | GET | `/api/families/:familyCode/members` | 查询家庭成员 |
| 家庭菜谱 | POST | `/api/family-recipes/upload` | 上传或更新家庭菜谱 |
| 家庭菜谱 | POST | `/api/family-recipes/join` | 加入家庭 |
| 家庭菜谱 | GET | `/api/family-recipes/member/:memberCode` | 按成员码拉取菜谱 |
| 家庭菜谱 | GET | `/api/family-recipes/:familyCode` | 按家庭码拉取菜谱 |
| 购物清单 | POST | `/api/family-shopping/items` | 新增或更新购物清单条目 |
| 购物清单 | GET | `/api/family-shopping/member/:memberCode/items` | 按成员码拉取购物清单 |
| 购物清单 | GET | `/api/family-shopping/member/:memberCode/changes?since=0` | 拉取购物清单增量变更 |
| 购物清单 | DELETE | `/api/family-shopping/items/:itemId?memberCode=:memberCode` | 软删除购物清单条目 |
| 食材库 | POST | `/api/family-ingredients/items` | 新增或更新食材库条目 |
| 食材库 | GET | `/api/family-ingredients/member/:memberCode/items` | 按成员码拉取食材库 |
| 食材库 | GET | `/api/family-ingredients/member/:memberCode/changes?since=0` | 拉取食材库增量变更 |
| 食材库 | DELETE | `/api/family-ingredients/items/:itemId?memberCode=:memberCode` | 软删除食材库条目 |
| 家庭聚合 | GET | `/api/family-data/member/:memberCode` | 一次返回菜谱、购物清单、食材库 |

## 数据对象

### Family

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 家庭 ID |
| familyCode | string | 家庭码，最长 100 字符，唯一 |
| familyName | string/null | 家庭名称，最长 100 字符，可为空 |
| isDeleted | boolean | 是否已软删除 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### FamilyMember

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 成员绑定 ID |
| memberCode | string | 成员码，最长 100 字符，唯一 |
| familyCode | string | 当前绑定的家庭码 |
| joinedFamily | boolean | 是否已经主动加入过家庭 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### FamilyRecipe

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 菜谱 ID |
| familyCode | string | 家庭码 |
| recipeJson | object/array/string | 菜谱 JSON 内容 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

### FamilyItem

购物清单和食材库当前使用同构条目，但分别存储在不同表中。

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | string | 条目 ID，客户端可离线生成 |
| _id | string | 条目 ID 别名，兼容现有前端数据 |
| family_id | string | 家庭码，返回时由服务端校正 |
| name | string | 名称 |
| num | string | 数量 |
| category | string | 分类 |
| price | string | 价格 |
| done | boolean | 是否完成/勾选 |
| create_time | number | 客户端创建时间 |
| version | number | 服务端版本号，每次更新递增 |
| deleted | boolean | 是否已软删除 |
| deletedAt | string/null | 删除时间 |
| updatedAt | string | 服务端更新时间 |

## 家庭接口

### POST

```text
/api/families
```

创建家庭。`familyCode` 创建后不可修改。

**Body 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码，最长 100 字符，唯一 |
| familyName | string/null | 否 | 家庭名称，最长 100 字符，可为空 |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/families \
  -H 'Content-Type: application/json' \
  -d '{"familyCode":"FAM001","familyName":"林家小厨房"}'
```

**成功响应 201**

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "林家小厨房",
    "isDeleted": false,
    "createdAt": "2026-05-08T09:50:19.000Z",
    "updatedAt": "2026-05-08T09:50:19.000Z"
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `familyCode is required` |
| 400 | `familyCode must be 100 characters or fewer` |
| 400 | `familyName must be 100 characters or fewer` |
| 409 | `familyCode already exists` |

### GET

```text
/api/families/:familyCode
```

按家庭码查询家庭。

**Path 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

**请求示例**

```bash
curl http://localhost:3000/api/families/FAM001
```

**公网请求示例**

```bash
curl http://110.42.36.7:3000/api/families/FAM001
```

**成功响应 200**

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "林家小厨房",
    "isDeleted": false,
    "createdAt": "2026-05-08T09:50:19.000Z",
    "updatedAt": "2026-05-08T09:50:19.000Z"
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `familyCode is required` |
| 400 | `familyCode must be 100 characters or fewer` |
| 404 | `Family not found` |

### PATCH

```text
/api/families/:familyCode
```

修改家庭名称。只允许修改 `familyName`，不允许修改 `familyCode`。

**Path 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

**Body 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyName | string/null | 否 | 新家庭名称，最长 100 字符；传空字符串会保存为 `null` |

**请求示例**

```bash
curl -X PATCH http://localhost:3000/api/families/FAM001 \
  -H 'Content-Type: application/json' \
  -d '{"familyName":"新的家庭名"}'
```

**成功响应 200**

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "新的家庭名",
    "isDeleted": false,
    "createdAt": "2026-05-08T09:50:19.000Z",
    "updatedAt": "2026-05-08T10:12:30.000Z"
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `familyCode is required` |
| 400 | `familyName must be 100 characters or fewer` |
| 404 | `Family not found` |

### DELETE

```text
/api/families/:familyCode
```

软删除家庭。接口会将 `isDeleted` 置为 `true`，不会物理删除数据库记录。

**Path 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

**请求示例**

```bash
curl -X DELETE http://localhost:3000/api/families/FAM001
```

**成功响应 200**

```json
{
  "data": {
    "id": 1,
    "familyCode": "FAM001",
    "familyName": "林家小厨房",
    "isDeleted": true,
    "createdAt": "2026-05-08T09:50:19.000Z",
    "updatedAt": "2026-05-08T10:20:00.000Z"
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `familyCode is required` |
| 404 | `Family not found` |

### GET

```text
/api/families/:familyCode/members
```

查询某个家庭下的成员列表。

**Path 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

**请求示例**

```bash
curl http://localhost:3000/api/families/FAM001/members
```

**成功响应 200**

```json
{
  "data": [
    {
      "id": 1,
      "memberCode": "M001",
      "familyCode": "FAM001",
      "joinedFamily": false,
      "createdAt": "2026-05-08T09:55:00.000Z",
      "updatedAt": "2026-05-08T09:55:00.000Z"
    }
  ]
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `familyCode is required` |
| 404 | `Family not found` |

## 家庭菜谱接口

### POST

```text
/api/family-recipes/upload
```

上传或更新家庭菜谱。同一个 `familyCode` 重复上传会覆盖更新已有菜谱。

**业务规则**

- 如果 `familyCode` 不存在，会自动创建家庭。
- 如果 `memberCode` 第一次出现，会绑定到当前 `familyCode`。
- 如果 `memberCode` 已绑定其他 `familyCode`，不允许通过上传接口切换家庭。
- `recipeJson` 可以传对象、数组，也可以传字符串化后的合法 JSON。

**Body 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码，最长 100 字符 |
| familyCode | string | 是 | 家庭码，最长 100 字符 |
| recipeJson | object/array/string | 是 | 菜谱 JSON 内容 |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/family-recipes/upload \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"M001","familyCode":"FAM001","recipeJson":{"recipes":[{"name":"番茄炒蛋","ingredients":["番茄","鸡蛋"]}]}}'
```

**成功响应 200**

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "M001",
      "familyCode": "FAM001",
      "joinedFamily": false,
      "createdAt": "2026-05-08T09:55:00.000Z",
      "updatedAt": "2026-05-08T09:55:00.000Z"
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
      "createdAt": "2026-05-08T09:55:00.000Z",
      "updatedAt": "2026-05-08T09:55:00.000Z"
    }
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `memberCode is required` |
| 400 | `familyCode is required` |
| 400 | `memberCode must be 100 characters or fewer` |
| 400 | `familyCode must be 100 characters or fewer` |
| 400 | `recipeJson is required` |
| 400 | `recipeJson must be valid JSON` |
| 409 | `memberCode is already bound to another familyCode` |

### POST

```text
/api/family-recipes/join
```

成员加入一个已经存在的家庭。

**业务规则**

- 目标 `familyCode` 必须已存在。
- 未绑定过的 `memberCode` 可以直接加入目标家庭。
- 已绑定自己初始家庭但未主动加入过其他家庭的 `memberCode`，可以加入一个目标家庭。
- 一旦 `joinedFamily = true`，不能再切换到第三个家庭。

**Body 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码，最长 100 字符 |
| familyCode | string | 是 | 要加入的目标家庭码，最长 100 字符 |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/family-recipes/join \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"M001","familyCode":"FAM002"}'
```

**成功响应 200**

```json
{
  "data": {
    "id": 1,
    "memberCode": "M001",
    "familyCode": "FAM002",
    "joinedFamily": true,
    "createdAt": "2026-05-08T09:55:00.000Z",
    "updatedAt": "2026-05-08T10:05:00.000Z"
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `memberCode is required` |
| 400 | `familyCode is required` |
| 404 | `target familyCode does not exist` |
| 409 | `memberCode has already joined a family and cannot change familyCode` |

### GET

```text
/api/family-recipes/member/:memberCode
```

按成员码拉取当前绑定家庭的菜谱。客户端推荐优先使用这个接口，因为服务端会根据 `memberCode` 找到成员当前绑定的 `familyCode`。

**Path 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |

**请求示例**

```bash
curl http://localhost:3000/api/family-recipes/member/M001
```

**成功响应 200**

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "M001",
      "familyCode": "FAM001",
      "joinedFamily": false,
      "createdAt": "2026-05-08T09:55:00.000Z",
      "updatedAt": "2026-05-08T09:55:00.000Z"
    },
    "recipe": {
      "id": 1,
      "familyCode": "FAM001",
      "recipeJson": {
        "recipes": [
          {
            "name": "番茄炒蛋"
          }
        ]
      },
      "createdAt": "2026-05-08T09:55:00.000Z",
      "updatedAt": "2026-05-08T09:55:00.000Z"
    }
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `memberCode is required` |
| 400 | `memberCode must be 100 characters or fewer` |
| 404 | `Family member not found` |
| 404 | `Family recipe not found` |

### GET

```text
/api/family-recipes/:familyCode
```

按家庭码直接拉取菜谱。这个接口适合兼容旧客户端或临时调试；如果担心家庭码泄露后被直接读取，后续可以只保留按 `memberCode` 拉取的接口。

**Path 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

**请求示例**

```bash
curl http://localhost:3000/api/family-recipes/FAM001
```

**成功响应 200**

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
    "createdAt": "2026-05-08T09:55:00.000Z",
    "updatedAt": "2026-05-08T09:55:00.000Z"
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `familyCode is required` |
| 400 | `familyCode must be 100 characters or fewer` |
| 404 | `Family recipe not found` |

## 购物清单接口

购物清单按单条 item 存储，支持同家庭成员共享、软删除和增量同步。写入时会先根据 `memberCode + familyCode` 绑定或确认家庭关系。

### POST

```text
/api/family-shopping/items
```

新增或更新购物清单条目。相同 `familyCode + id` 再次上传会覆盖条目 JSON，并让 `version + 1`。

**Body 参数**

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |
| familyCode | string | 是 | 家庭码 |
| shoppingItemJson | object/string | 是 | 购物清单条目 JSON |

**请求示例**

```bash
curl -X POST http://localhost:3000/api/family-shopping/items \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"member_a","familyCode":"default_family","shoppingItemJson":{"name":"番茄","num":"3个","category":"蔬菜","price":"6","done":false,"family_id":"default_family","_id":"shop_tomato","create_time":1778294348928,"id":"shop_tomato"}}'
```

**成功响应 200**

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "member_a",
      "familyCode": "default_family",
      "joinedFamily": false,
      "createdAt": "2026-05-11T01:56:23.486Z",
      "updatedAt": "2026-05-11T01:56:23.486Z"
    },
    "item": {
      "name": "番茄",
      "num": "3个",
      "category": "蔬菜",
      "price": "6",
      "done": false,
      "family_id": "default_family",
      "_id": "shop_tomato",
      "create_time": 1778294348928,
      "id": "shop_tomato",
      "version": 1,
      "deleted": false,
      "deletedAt": null,
      "updatedAt": "2026-05-11T01:56:23.489Z"
    }
  }
}
```

### GET

```text
/api/family-shopping/member/:memberCode/items
```

按成员码获取当前家庭未删除的购物清单。

```bash
curl http://localhost:3000/api/family-shopping/member/member_a/items
```

**成功响应 200**

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "member_a",
      "familyCode": "default_family",
      "joinedFamily": true,
      "createdAt": "2026-05-11T01:56:23.486Z",
      "updatedAt": "2026-05-11T01:56:23.486Z"
    },
    "items": [
      {
        "name": "番茄",
        "num": "3个",
        "category": "蔬菜",
        "price": "6",
        "done": false,
        "family_id": "default_family",
        "_id": "shop_tomato",
        "create_time": 1778294348928,
        "id": "shop_tomato",
        "version": 1,
        "deleted": false,
        "deletedAt": null,
        "updatedAt": "2026-05-11T01:56:23.489Z"
      }
    ]
  }
}
```

### GET Changes

```text
/api/family-shopping/member/:memberCode/changes?since=0
```

拉取 `since` 时间戳之后变更过的购物清单条目。返回会包含软删除条目，客户端可以用 `deleted: true` 同步删除状态。

```bash
curl 'http://localhost:3000/api/family-shopping/member/member_a/changes?since=0'
```

**成功响应 200**

```json
{
  "data": {
    "member": {
      "id": 1,
      "memberCode": "member_a",
      "familyCode": "default_family",
      "joinedFamily": true,
      "createdAt": "2026-05-11T01:56:23.486Z",
      "updatedAt": "2026-05-11T01:56:23.486Z"
    },
    "items": [],
    "serverTime": 1778464596155
  }
}
```

客户端建议保存 `serverTime`，下次同步时作为 `since` 传回。

### DELETE

```text
/api/family-shopping/items/:itemId?memberCode=:memberCode
```

软删除购物清单条目。

```bash
curl -X DELETE 'http://localhost:3000/api/family-shopping/items/shop_tomato?memberCode=member_a'
```

## 食材库接口

食材库和购物清单当前字段相同，但独立存储在 `family_ingredient_items` 表，避免后续食材库增加保质期、库存预警等逻辑时影响购物清单。

### POST

```text
/api/family-ingredients/items
```

新增或更新食材库条目。

```bash
curl -X POST http://localhost:3000/api/family-ingredients/items \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"member_a","familyCode":"default_family","ingredientItemJson":{"name":"大米","num":"5kg","category":"主食","price":"35","done":false,"family_id":"default_family","_id":"ingredient_rice","create_time":1778294368928,"id":"ingredient_rice"}}'
```

### GET

```text
/api/family-ingredients/member/:memberCode/items
```

```bash
curl http://localhost:3000/api/family-ingredients/member/member_a/items
```

### GET Changes

```text
/api/family-ingredients/member/:memberCode/changes?since=0
```

```bash
curl 'http://localhost:3000/api/family-ingredients/member/member_a/changes?since=0'
```

### DELETE

```text
/api/family-ingredients/items/:itemId?memberCode=:memberCode
```

```bash
curl -X DELETE 'http://localhost:3000/api/family-ingredients/items/ingredient_rice?memberCode=member_a'
```

## 家庭聚合接口

### GET

```text
/api/family-data/member/:memberCode
```

按成员码一次返回当前家庭的菜谱、购物清单和食材库。这个接口适合客户端启动时首屏拉取。

```bash
curl http://localhost:3000/api/family-data/member/member_a
```

**成功响应 200**

```json
{
  "data": {
    "familyRecipe": {
      "recipes": [
        {
          "name": "番茄炒蛋"
        }
      ]
    },
    "shoppingList": [
      {
        "name": "番茄",
        "num": "3个",
        "category": "蔬菜",
        "price": "6",
        "done": false,
        "family_id": "default_family",
        "_id": "shop_tomato",
        "create_time": 1778294348928,
        "id": "shop_tomato",
        "version": 1,
        "deleted": false,
        "deletedAt": null,
        "updatedAt": "2026-05-11T01:56:23.489Z"
      }
    ],
    "ingredientLibrary": [
      {
        "name": "大米",
        "num": "5kg",
        "category": "主食",
        "price": "35",
        "done": false,
        "family_id": "default_family",
        "_id": "ingredient_rice",
        "create_time": 1778294368928,
        "id": "ingredient_rice",
        "version": 1,
        "deleted": false,
        "deletedAt": null,
        "updatedAt": "2026-05-11T01:56:23.489Z"
      }
    ]
  }
}
```

**可能错误**

| 状态码 | message |
| --- | --- |
| 400 | `memberCode is required` |
| 400 | `memberCode must be 100 characters or fewer` |
| 404 | `Family member not found` |

## 推荐客户端流程

### 首次创建并上传菜谱

1. 客户端本地生成并保存 `memberCode`。
2. 客户端本地生成并保存 `familyCode`。
3. 调用 `POST /api/family-recipes/upload` 上传菜谱。
4. 服务端会自动创建家庭、绑定成员并保存菜谱。
5. 后续使用 `GET /api/family-recipes/member/:memberCode` 拉取菜谱。

### 加入别人家庭

1. 用户输入或扫码获得目标 `familyCode`。
2. 确保目标家庭已经存在。
3. 调用 `POST /api/family-recipes/join`。
4. 成功后，本地当前家庭切换为目标家庭。
5. 后续使用 `GET /api/family-recipes/member/:memberCode` 拉取目标家庭菜谱。

### 同步购物清单或食材库

1. 客户端本地生成并保存 `memberCode`。
2. 新增条目时客户端生成稳定的 `id/_id`，即使离线也可以先写入本地。
3. 联网后调用 `POST /api/family-shopping/items` 或 `POST /api/family-ingredients/items` 上传。
4. 客户端保存 `changes` 接口返回的 `serverTime`。
5. 下次同步调用 `changes?since=上次serverTime`，按返回的 `id` 合并本地数据；如果 `deleted=true`，本地也删除或标记删除。

### 服务器更新和 mock 数据

服务器拉取新代码后，通常需要重启 pm2 进程：

```bash
git pull origin main
npm install
pm2 restart node-servers
```

如果需要灌入演示数据：

```bash
npm run db:init
npm run db:seed:mock
pm2 restart node-servers
```

灌入后可以验证聚合接口：

```bash
curl http://localhost:3000/api/family-data/member/member_a
```

## 静态资源

Demo 页面：

```text
http://localhost:3000/demo
```

## 目录结构

```text
src/
  app.js                 # Express 应用配置
  server.js              # 服务启动入口
  config/                # 环境变量和数据库配置
  controllers/           # 控制器
  routes/                # 路由
  services/              # 业务逻辑和数据库访问
  middlewares/           # 错误处理中间件
database/
  schema.sql             # 数据库建表脚本
  mock_family_data.sql   # MySQL 演示数据
docs/
  family-recipe-api-and-deployment.md
public/
  demo.html
scripts/
  demo-call.js
  verify-and-push.sh
```
