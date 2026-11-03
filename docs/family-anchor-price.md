# 家庭锚定价格 — 前端对接说明

锚定价格是家庭对某个采购物件的长期参考价，和购物清单上的 `price`（这次实付/标价，自由文本）分开存。同一物件不强制和清单行一一对应：清单可以只写「牛奶」，锚定按名称匹配。

鉴权不变：`X-Device-Id` + `X-Device-Secret`。除注册设备外都要带。多家庭时始终传 `familyCode`。

上线前执行：`database/2026-11-03-family-anchor-prices.sql`。

## 怎么匹配

同一家庭、同一名称下：

- 不带标签的那条是**默认锚定**。清单只写「牛奶」时，优先显示它。
- 标签可选，用来区分渠道、品牌或规格，例如 `菜市场`、`伊利`。
- 没有默认、只有一条细分锚定：清单直接用这一条。
- 没有默认、有多条细分：`anchorPrice` 为 `null`，用 `anchorMin` / `anchorMax` 表示区间。
- 名称按去掉首尾空格、合并连续空格、忽略英文大小写后比较。「纯牛奶」不会匹配「牛奶」。

## 保存 / 修改

`POST /api/saveFamilyAnchorPrice`  
`POST /api/updateFamilyAnchorPrice`（同一套逻辑）

同一家庭 + 名称 + 标签已存在时，改价并沿用原来的 id，不会另插一条。

```json
{
  "familyCode": "fam_xxx",
  "anchorPriceJson": {
    "name": "牛奶",
    "anchorPrice": 12
  }
}
```

细分锚定：

```json
{
  "familyCode": "fam_xxx",
  "anchorPriceJson": {
    "name": "五花肉",
    "tag": "菜市场",
    "anchorPrice": 28
  }
}
```

`anchorPrice` 必须是大于等于 0 的数字，最多两位小数。不要写「12元」。

## 查询

- `GET /api/getFamilyAnchorPrices?familyCode=fam_xxx`  
  家庭全部锚定。可加 `name=牛奶` 只看这一物件。支持 `page` / `pageSize`。
- `GET /api/getFamilyAnchorPrice?familyCode=fam_xxx&id=anchor_xxx`  
  按 id 取一条。
- `GET /api/matchFamilyAnchorPrice?familyCode=fam_xxx&name=牛奶`  
  按名称出参考价。需要精确到某个标签时再加 `tag=菜市场`。没设过也返回 200，`anchorCount` 为 0。
- `GET /api/getFamilyAnchorPriceChanges?familyCode=fam_xxx&since=上次的serverTime`  
  增量，包含软删除。

`match` 的 `match` 字段，以及购物清单条目上的 `anchor`，结构相同：

```json
{
  "anchorPrice": 12,
  "anchorMin": 10,
  "anchorMax": 15,
  "anchorCount": 3,
  "matches": [
    { "anchorId": "anchor_a", "name": "牛奶", "tag": null, "anchorPrice": 12 },
    { "anchorId": "anchor_b", "name": "牛奶", "tag": "伊利", "anchorPrice": 10 },
    { "anchorId": "anchor_c", "name": "牛奶", "tag": "盒马", "anchorPrice": 15 }
  ]
}
```

购物清单查询、增量、保存返回的每条 item 都会多一个 `anchor`。对不上时为 `null`。清单原有的 `price` 不变。

`GET /api/getFamilyData` 增加 `anchorPrices` 数组，同时 `shoppingList` 每条也带 `anchor`。

## 删除

`POST /api/deleteFamilyAnchorPrice`

```json
{ "familyCode": "fam_xxx", "id": "anchor_xxx" }
```

或按名称删默认锚定：`{ "familyCode": "fam_xxx", "name": "牛奶" }`。  
删某一条细分要带 `tag`，否则只会删不带标签的默认锚定。
