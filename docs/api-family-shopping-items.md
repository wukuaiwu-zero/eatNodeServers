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
    "category": "蔬菜",
    "price": "6",
    "done": false,
    "id": "shop_tomato"
  }
}
```

设备必须已加入 `familyCode` 对应家庭。服务端会把条目的 `family_id` 统一改成后端确认过的家庭。

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
