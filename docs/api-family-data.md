# 家庭聚合数据接口

## 说明

聚合接口不对应单独数据表，它用于客户端启动时一次拉取当前家庭的三类 JSON 数据：

- `familyRecipe`
- `shoppingList`
- `ingredientLibrary`

## 查询家庭聚合数据

### 接口地址

```text
GET /api/getFamilyData?memberCode=member_a
```

### 请求参数示例

```json
{
  "memberCode": "member_a"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "familyRecipe": {
      "recipes": [
        {
          "id": "recipe_tomato_egg",
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
        "updatedAt": "2026-05-11T10:00:00.000Z"
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
        "updatedAt": "2026-05-11T10:00:00.000Z"
      }
    ]
  }
}
```
