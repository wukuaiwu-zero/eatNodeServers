# family_ingredient_items 食材库表接口

## 表说明

`family_ingredient_items` 和购物清单当前字段基本一致，但独立存储，方便后续扩展食材库专属逻辑。

## 保存食材库条目

### 接口地址

```text
POST /api/saveFamilyIngredientItem
```

### 请求参数示例

```json
{
  "memberCode": "member_a",
  "familyCode": "default_family",
  "ingredientItemJson": {
    "name": "大米",
    "num": "5kg",
    "category": "主食",
    "price": "35",
    "done": false,
    "family_id": "default_family",
    "_id": "ingredient_rice",
    "create_time": 1778294368928,
    "id": "ingredient_rice"
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
      "updatedAt": "2026-05-11T10:00:00.000Z"
    }
  }
}
```

## 查询单条食材库

### 接口地址

```text
GET /api/getFamilyIngredientItem?familyCode=default_family&id=ingredient_rice
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "id": "ingredient_rice"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
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
    "updatedAt": "2026-05-11T10:00:00.000Z"
  }
}
```

## 查询食材库列表

### 接口地址

```text
GET /api/getFamilyIngredientItems?familyCode=default_family
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
        "updatedAt": "2026-05-11T10:00:00.000Z"
      }
    ]
  }
}
```

## 查询食材库增量

### 接口地址

```text
GET /api/getFamilyIngredientChanges?familyCode=default_family&since=0
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

## 删除食材库条目

### 接口地址

```text
POST /api/deleteFamilyIngredientItem
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "id": "ingredient_rice",
  "memberCode": "member_a"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "name": "大米",
    "id": "ingredient_rice",
    "_id": "ingredient_rice",
    "family_id": "default_family",
    "version": 2,
    "deleted": true,
    "deletedAt": "2026-05-11T10:20:00.000Z",
    "updatedAt": "2026-05-11T10:20:00.000Z"
  }
}
```
