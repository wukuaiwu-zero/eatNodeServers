# family_ingredient_items 食材库接口

食材库和购物清单当前字段基本一致，但独立存储，方便后续扩展保质期、库存预警等专属逻辑。

所有接口都需要设备请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 保存食材库条目

```text
POST /api/saveFamilyIngredientItem
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "ingredientItemJson": {
    "name": "大米",
    "num": "5kg",
    "category": "主食",
    "price": "35",
    "done": false,
    "id": "ingredient_rice"
  }
}
```

设备必须已加入 `familyCode` 对应家庭。

## 修改食材库条目

```text
POST /api/updateFamilyIngredientItem
```

请求体和保存接口一致。按 `familyCode + id` 覆盖同一条食材库存，并递增 `version`：

```json
{
  "familyCode": "fam_xxx",
  "ingredientItemJson": {
    "id": "ingredient_rice",
    "name": "大米",
    "num": "3kg",
    "category": "主食",
    "price": "22",
    "done": false
  }
}
```

## 查询单条食材

```text
GET /api/getFamilyIngredientItem?id=ingredient_rice
```

按当前设备所属家庭查询。

## 查询食材库列表

```text
GET /api/getFamilyIngredientItems
```

按当前设备所属家庭返回未删除条目。

可按分类筛选：

```text
GET /api/getFamilyIngredientItems?category=主食
GET /api/getFamilyIngredientItems?categoryId=cat_staple
```

服务端会匹配条目 JSON 里的 `category`、`categoryId` 或 `category_id` 字段。

## 查询食材库增量

```text
GET /api/getFamilyIngredientChanges?since=0
```

返回当前设备所属家庭在 `since` 之后更新过的条目，包括软删除条目。

## 删除食材库条目

```text
POST /api/deleteFamilyIngredientItem
```

请求：

```json
{
  "id": "ingredient_rice"
}
```
