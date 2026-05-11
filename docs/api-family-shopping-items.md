# family_shopping_items 购物清单表接口

## 表说明

`family_shopping_items` 按条目存购物清单。唯一键是 `family_code + item_id`，删除采用软删除，方便多端同步删除状态。

## 数据对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id/_id | string | 条目 ID |
| family_id | string | 家庭码 |
| name | string | 名称 |
| num | string | 数量 |
| category | string | 分类 |
| price | string | 价格 |
| done | boolean | 是否完成 |
| create_time | number | 客户端创建时间 |
| version | number | 服务端版本号 |
| deleted | boolean | 是否软删除 |
| deletedAt | string/null | 删除时间 |
| updatedAt | string | 服务端更新时间 |

## 保存购物清单条目

### 接口地址

```text
POST /api/saveFamilyShoppingItem
```

### 请求参数示例

```json
{
  "memberCode": "member_a",
  "familyCode": "default_family",
  "shoppingItemJson": {
    "name": "番茄",
    "num": "3个",
    "category": "蔬菜",
    "price": "6",
    "done": false,
    "family_id": "default_family",
    "_id": "shop_tomato",
    "create_time": 1778294348928,
    "id": "shop_tomato"
  }
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "member": {
      "memberCode": "member_a",
      "familyCode": "default_family"
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
      "updatedAt": "2026-05-11T10:00:00.000Z"
    }
  }
}
```

## 查询单条购物清单

### 接口地址

```text
GET /api/getFamilyShoppingItem?familyCode=default_family&id=shop_tomato
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "id": "shop_tomato"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
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
    "updatedAt": "2026-05-11T10:00:00.000Z"
  }
}
```

## 查询购物清单列表

### 接口地址

```text
GET /api/getFamilyShoppingItems?familyCode=default_family
```

### 请求参数示例

```json
{
  "familyCode": "default_family"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "familyCode": "default_family",
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
        "updatedAt": "2026-05-11T10:00:00.000Z"
      }
    ]
  }
}
```

## 查询购物清单增量

### 接口地址

```text
GET /api/getFamilyShoppingChanges?familyCode=default_family&since=0
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "since": 0
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "familyCode": "default_family",
    "items": [],
    "serverTime": 1778482043966
  }
}
```

## 删除购物清单条目

### 接口地址

```text
POST /api/deleteFamilyShoppingItem
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "id": "shop_tomato",
  "memberCode": "member_a"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "name": "番茄",
    "id": "shop_tomato",
    "_id": "shop_tomato",
    "family_id": "default_family",
    "version": 2,
    "deleted": true,
    "deletedAt": "2026-05-11T10:20:00.000Z",
    "updatedAt": "2026-05-11T10:20:00.000Z"
  }
}
```
