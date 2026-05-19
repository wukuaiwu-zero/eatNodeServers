# family_shopping_items 购物清单接口

购物清单按条目存储，唯一键是 `family_code + item_id`。删除采用软删除，用于多端同步删除状态。

所有接口都需要设备请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 保存购物清单条目

```text
POST /api/saveFamilyShoppingItem
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "shoppingItemJson": {
    "name": "番茄",
    "num": "3个",
    "categoryId": "shopping_cat_vegetable",
    "price": "6",
    "done": false,
    "id": "shop_tomato"
  }
}
```

设备必须已加入 `familyCode` 对应家庭。服务端会把条目的 `family_id` 统一改成后端确认过的家庭。

## 修改购物清单条目

```text
POST /api/updateFamilyShoppingItem
```

请求体和保存接口一致。按 `familyCode + id` 覆盖同一条购物清单，并递增 `version`：

```json
{
  "familyCode": "fam_xxx",
  "shoppingItemJson": {
    "id": "shop_tomato",
    "name": "番茄",
    "num": "5个",
    "categoryId": "shopping_cat_vegetable",
    "price": "10",
    "done": true
  }
}
```

## 查询单条购物清单

```text
GET /api/getFamilyShoppingItem?id=shop_tomato
```

按当前设备所属家庭查询，不需要传 `familyCode`。

## 查询购物清单列表

```text
GET /api/getFamilyShoppingItems
```

按当前设备所属家庭返回未删除条目。

可按分类筛选：

```text
GET /api/getFamilyShoppingItems?categoryId=cat_vegetable
```

请传 `categoryId`。购物清单已经按字段存储，服务端直接匹配 `family_shopping_items.category_id`。

## 查询购物清单增量

```text
GET /api/getFamilyShoppingChanges?since=0
```

返回当前设备所属家庭在 `since` 之后更新过的条目，包括软删除条目：

```json
{
  "data": {
    "familyCode": "fam_xxx",
    "items": [],
    "serverTime": 1778482043966
  }
}
```

## 删除购物清单条目

```text
POST /api/deleteFamilyShoppingItem
```

请求：

```json
{
  "id": "shop_tomato"
}
```

## 批量删除购物清单条目

```text
POST /api/deleteFamilyShoppingItems
```

请求：

```json
{
  "ids": ["shop_tomato", "shop_milk"]
}
```

删除采用软删除。不存在的 ID 会跳过，返回实际删除数量 `deletedCount`。

## 清除已购购物清单

```text
POST /api/clearPurchasedFamilyShoppingItems
```

按当前设备所属家庭软删除 `done: true` 的购物清单条目，返回实际删除数量 `deletedCount`。
