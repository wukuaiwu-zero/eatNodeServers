# 2026-11-03 前端对接任务书

把这份文件交给前端实现 AI，按下面的任务改客户端即可。契约以本文为准。更细的抽签说明见 `docs/family-recipe-pool-draw-frontend.md`，锚定价格说明见 `docs/family-anchor-price.md`。两份专题文档和本文冲突时，以本文为准。

今天后端做了三件事，都还没发版，接口已经可联调：

1. **公共菜谱**并进家庭菜谱列表和随机池。旧的 15 道内置默认菜不再出现在列表里。
2. **随机抽菜**改为服务端加权抽签，并要求前端回传采纳 / 跳过反馈。
3. **锚定价格**：家庭给采购物件设长期参考价，购物清单按名称带出，和清单上的实付 `price` 分开。

健康目标、三餐计划、消费记录的接口协议没变。抽签会在服务端读这些数据，前端不用为抽签另做上报。

---

## 0. 全局约定（沿用现有客户端，不要重写）

- 前缀：`/api`
- 鉴权：请求头 `X-Device-Id`、`X-Device-Secret`。除注册设备外都要带。
- 多家庭：查询和写入都带 `familyCode`。
- 成功：`{ "data": ... }`
- 失败：`{ "message": "..." }`，用 HTTP 状态码区分。400 参数，403 没加入这个家庭，404 记录不存在，409 重名，429 写入太频繁。
- 金额类锚定价是数字，最多两位小数。购物清单原有 `price` 仍是自由文本，不要混用。

本地如果还缓存着 `default_dish_1` 这类旧默认菜，进随机池页时丢掉，改以服务端列表为准。

---

## 1. 公共菜谱（必做）

服务器有一份公共菜谱目录，当前 `version = 1`，4 道菜，类型都是「做饭」：

| id | 名称 |
|---|---|
| `public_pidan_qiezi_mian` | 皮蛋擂椒茄子拌面 |
| `public_qingzheng_yu` | 清蒸鱼（万能公式） |
| `public_suanrong_xia_bao` | 蒜蓉粉丝虾滑煲 |
| `public_zhengdan_geng` | 蒸蛋羹（万能公式） |

不要在客户端写死这 4 道。目录以后会加菜，用接口返回的数据和 `publicCatalogVersion` 判断要不要刷新。

### 1.1 会出现在哪些接口

这些接口的菜谱数组已经是「家庭自有菜 + 未隐藏的公共菜」：

- `GET /api/getFamilyRecipe`
- `GET /api/getFamilyRecipeByMember`
- `GET /api/getFamilyData` 里的 `familyRecipes`，以及 `familyRecipe.recipeJson.recipes`
- `GET /api/getFamilyRecipeItem?familyCode=&id=public_xxx`：公共菜也能按 id 打开详情

随机池：

- `GET /api/getFamilyRecipePoolItems` 的 `dishes` 已合并公共菜
- 同一响应多了 `publicCatalogVersion`（数字）
- `GET /api/getFamilyData` 同样多了 `publicCatalogVersion`，`recipePoolItems` 也是合并后的列表

### 1.2 怎么区分公共菜和家庭菜

菜谱条目：

- `source === "public"`：公共菜，只读。
- 没有 `source`，或不是 `"public"`：家庭自己的菜，可编辑。

随机池条目：

- `source === "public"`：公共菜。对象上还有嵌套 `recipe`（食材、步骤、难度、耗时都在里面），详情可以直接用，不必再查一次。
- `source === "family"`：家庭自己加进池子的菜。

公共菜谱条目字段：

```json
{
  "id": "public_zhengdan_geng",
  "recipeId": "public_zhengdan_geng",
  "familyCode": "fam_xxx",
  "name": "蒸蛋羹（万能公式）",
  "category": "蛋奶豆制品",
  "cover": "",
  "coverUrl": "",
  "difficulty": "简单",
  "duration": "15分钟",
  "favorite": false,
  "own": true,
  "source": "public",
  "ingredients": [{ "name": "鸡蛋", "amount": "3个", "isSeasoning": false, "sortOrder": 0 }],
  "steps": ["..."],
  "version": 1,
  "deleted": false,
  "deletedAt": null,
  "createdAt": null,
  "updatedAt": null
}
```

公共池条目在上面的菜谱之外，还有池字段：`dishId`、`type`、`manualWeight`、`paused`、`isDefault: true`、`source: "public"`、`recipe`（完整公共菜谱）。

### 1.3 前端必须改的行为

1. 菜谱列表、菜谱详情、随机池都要能展示 `source === "public"` 的数据。详情页用返回的 `ingredients` / `steps`，公共池菜优先用条目上的 `recipe`。
2. 公共菜不提供「编辑并保存」。`POST /api/saveFamilyRecipeItem`、`POST /api/updateFamilyRecipeItem` 如果 id 是公共菜 id，会 400：`公共菜谱不能在家庭里修改，请改服务器上的公共菜谱文件`。
3. 用户要改公共菜时，另存为家庭菜：不传原来的公共 id，生成新的家庭菜谱。保存成功后，若名称与某道公共菜完全相同，列表里只保留家庭这道，公共那道自动让位。
4. 删除公共菜沿用现有删除接口，效果是「这个家庭隐藏」，不是改服务器目录：
   - 菜谱：`POST /api/deleteFamilyRecipeItem`，body 带 `familyCode` + 公共 `id`
   - 随机池：`POST /api/deleteFamilyRecipePoolItem`，body 带 `familyCode` + 公共 `id`
   - 两处隐藏是同一份记录。从菜谱删掉，随机池也不再出现；反过来一样。
5. 家庭自有菜谱若与公共菜同名，列表只显示家庭那道。
6. id 以 `default_dish_` 开头的旧默认菜，接口不再返回。本地缓存命中这些 id 时直接丢弃。
7. 用 `publicCatalogVersion` 做缓存失效。版本变了就重新拉 `getFamilyData` 或菜谱 / 随机池列表。当前版本是 `1`。

### 1.4 暂停、调权重时怎么写公共菜

公共菜也可以暂停抽签、调手动权重，走现有池保存接口，**id 必须用公共 id，名称不要改**：

`POST /api/saveFamilyRecipePoolItem`

```json
{
  "familyCode": "fam_xxx",
  "dishJson": {
    "id": "public_zhengdan_geng",
    "name": "蒸蛋羹（万能公式）",
    "type": "做饭",
    "paused": true,
    "manualWeight": 1.2
  }
}
```

保存接口返回的是数据库行，**没有** `source` 和嵌套 `recipe`。保存后重新拉列表，才能拿到合并后的展示结构。对已隐藏的公共菜再保存一次（同 id），会取消隐藏。

用别的 id 保存一道和公共菜同名的池菜，会 409：`菜品名称已存在`。

---

## 2. 加权抽签（必做）

随机按钮不要再对池列表做本地 `Math.random`。改为服务端抽签，并把 `drawId` 留到这次结果被处理完。

池的增删改路径没变。旧的「只传名称 + 类型」仍可用。

### 2.1 池条目新增可选字段

`POST /api/saveFamilyRecipePoolItem` 的 `dishJson` 可额外带：

| 字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `recipeId` | string \| null | 按菜名自动对齐家庭菜谱，对不上为 null | 关联上完整菜谱后，抽签才能用收藏、难度、食材库存 |
| `manualWeight` | number | `1` | 出现频率，范围 **0.2 ~ 3** |
| `paused` | boolean | `false` | `true` 不参与抽签 |

`GET /api/getFamilyRecipePoolItems` 每条都会回这些字段。列表响应示例：

```json
{
  "data": {
    "member": {},
    "dishes": [],
    "publicCatalogVersion": 1
  }
}
```

不传 `page` / `pageSize` 时一次返回全部。传了分页参数才会裁切 `dishes` 并附带 `pagination`。

### 2.2 抽签

`POST /api/drawFamilyRecipePool`

```json
{
  "familyCode": "fam_xxx",
  "mealName": "晚餐",
  "count": 1,
  "types": ["做饭"],
  "intent": "normal",
  "memberId": null,
  "excludeDishIds": [],
  "context": {
    "isWorkday": true,
    "hour": 19,
    "weather": "normal"
  }
}
```

| 字段 | 必填 | 说明 |
|---|---|---|
| `familyCode` | 是 | |
| `mealName` | 否 | `早餐` / `午餐` / `晚餐`。传了才会吃「常用菜单」加权 |
| `count` | 否 | 一次抽几道，默认 1，最大 3。小于 1 或非整数 → 400 `抽签数量必须是正整数` |
| `types` | 否 | `外卖` / `堂食` / `做饭`。不传表示不限。非法值 → 400 |
| `intent` | 否 | `normal`（默认）、`quick` 快手、`clear_fridge` 清冰箱、`healthy` 健康 |
| `memberId` | 否 | 用谁的健康目标。不传则用当前设备成员 |
| `excludeDishIds` | 否 | 这次不想再抽到的菜 id，换一个时带上 |
| `context.hour` | 否 | 0–23。不传用北京时间 |
| `context.isWorkday` | 否 | 不传按北京时间是否周末推断 |
| `context.weather` | 否 | `normal` / `hot` / `cold` / `rain` |

成功：

```json
{
  "data": {
    "drawId": "draw_xxx",
    "items": [
      {
        "dishId": "public_zhengdan_geng",
        "id": "public_zhengdan_geng",
        "name": "蒸蛋羹（万能公式）",
        "type": "做饭",
        "recipeId": "public_zhengdan_geng",
        "score": 1.8421,
        "reasons": ["默认菜×1.15", "新鲜×1.2"],
        "missingIngredients": ["鸡蛋"],
        "expiringIngredients": []
      }
    ],
    "context": {
      "mealName": "晚餐",
      "intent": "normal",
      "isWorkday": true,
      "hour": 19,
      "weather": "normal",
      "today": "2026-11-03",
      "diningSpendHigh": false,
      "goalType": "减脂",
      "candidateCount": 8
    }
  }
}
```

- `drawId` 必须留着，反馈要用。候选为 0 时也会返回 `drawId`，但这时没有可反馈的菜。
- `items` 为空且 `context.candidateCount === 0`：空态文案用「没有可抽的菜，试试取消类型筛选、检查忌口，或取消暂停」。
- `missingIngredients`：还缺这些食材。`expiringIngredients`：冰箱里临期、建议优先用掉。只在类型为「做饭」且关联到菜谱时才有内容。
- `reasons` 是调试用的权重说明，正式环境可以折成「为什么推荐」。
- 服务端已经排除：暂停的菜、类型不符、`excludeDishIds`、今天三餐计划里已有的同名菜、饮食偏好里的忌口。

### 2.3 反馈

`POST /api/feedbackFamilyRecipePoolDraw`

```json
{
  "familyCode": "fam_xxx",
  "drawId": "draw_xxx",
  "dishId": "public_zhengdan_geng",
  "action": "skip"
}
```

| action | 何时调用 |
|---|---|
| `skip` | 用户点「换一个」。先反馈，再带 `excludeDishIds` 重新抽 |
| `accept` | 用户点「就吃这个」，写进今日计划 / 临时菜单之前 |
| `cooked` | 之后打卡「做过了 / 吃过了」 |
| `reject` | 用户明确「不想再看到」 |

成功 `data`：`{ drawId, dishId, dishName, action, score }`。

这次 `drawId + dishId` 必须来自刚才的抽签结果，否则 404 `抽签记录不存在`。动作写错 → 400 `反馈动作只能是 accept、skip、cooked、reject`。

### 2.4 推荐时序

```text
进入抽签
  → drawFamilyRecipePool
  → 展示 items[0]，记下 drawId、dishId

换一个
  → feedback action=skip
  → draw，excludeDishIds 带上刚才的 dishId

就吃这个
  → feedback action=accept
  → 再写入当日三餐 / 临时菜单（原有接口，协议没变）

之后打卡完成
  → feedback action=cooked
```

池管理页建议加上：暂停开关（`paused`）、出现频率（`manualWeight`，0.2~3，默认 1）。同名菜谱一般会自动挂上 `recipeId`，有完整菜谱时再展示「已关联菜谱」。

抽签会读取、但前端不用改写入协议的数据：忌口、全家口味、当日三餐、近 30 天吃过的菜名、常用菜单、菜谱收藏 / 难度 / 耗时 / 食材、食材库与临期、健康目标、近 7 天餐饮消费、历史 skip/reject。这些越完整，推荐越准。

---

## 3. 锚定价格（必做）

锚定价格是家庭对某个采购物件的长期参考价。购物清单上的 `price` 仍是这一次的标价或实付，自由文本，不要改它的含义。

名称按「去首尾空格、合并连续空格、忽略英文大小写」匹配。「纯牛奶」对不上「牛奶」。

同一家庭、同一名称：

- 不带 `tag` 的是**默认锚定**。清单只写「牛奶」时，优先用它。
- `tag` 可选，用来区分渠道、品牌或规格，例如 `菜市场`、`伊利`。最长 50 字。
- 没有默认、只有一条细分：清单直接用这一条。
- 没有默认、有多条细分：`anchorPrice` 为 `null`，用 `anchorMin` / `anchorMax` 表示区间。
- 没设过：购物清单该项 `anchor` 为 `null`。

### 3.1 接口

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

细分：

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

`anchorPrice` 必须是 `>= 0` 且 `<= 999999.99` 的数字，最多两位小数。不要传 `"12元"`。也可以把 `name` / `tag` / `anchorPrice` 直接放在 body 顶层，不必包进 `anchorPriceJson`。

查询：

- `GET /api/getFamilyAnchorPrices?familyCode=fam_xxx`  
  全部锚定。可加 `name=牛奶`。支持 `page` / `pageSize`，不传则全量。`data.anchors`。
- `GET /api/getFamilyAnchorPrice?familyCode=fam_xxx&id=anchor_xxx`  
  单条。不存在 404 `锚定价格不存在`。
- `GET /api/matchFamilyAnchorPrice?familyCode=fam_xxx&name=牛奶`  
  按名称出参考价。要精确到某个标签再加 `tag=菜市场`。没设过也是 200，`anchorCount` 为 0。
- `GET /api/getFamilyAnchorPriceChanges?familyCode=fam_xxx&since=上次的serverTime`  
  增量，包含软删除。

删除 `POST /api/deleteFamilyAnchorPrice`：

```json
{ "familyCode": "fam_xxx", "id": "anchor_xxx" }
```

或 `{ "familyCode": "fam_xxx", "name": "牛奶" }` 删默认锚定。删某一条细分必须带 `tag`，不带 `tag` 只会删不带标签的默认锚定。

单条锚定：

```json
{
  "id": "anchor_xxx",
  "anchorId": "anchor_xxx",
  "familyCode": "fam_xxx",
  "name": "牛奶",
  "tag": null,
  "anchorPrice": 12,
  "version": 1,
  "deleted": false,
  "deletedAt": null,
  "createdAt": "...",
  "updatedAt": "..."
}
```

`match` 的结果，以及购物清单条目上的 `anchor`，结构相同：

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

展示规则：

- `anchorPrice` 有数字：直接显示「参考价 ¥12」。
- `anchorPrice` 为 `null` 且 `anchorCount > 1`：显示区间 `anchorMin ~ anchorMax`，并可列出 `matches` 让用户看渠道。
- `anchor` 为 `null`：这项还没设参考价，给一个「设为参考价」入口。

### 3.2 已经自动挂上 anchor 的旧接口

下面接口返回的购物清单 item，在原字段之外多了 `anchor`。`price` 不变。对不上时 `anchor` 为 `null`。

- `GET /api/getFamilyShoppingItems`
- `GET /api/getFamilyShoppingItem`
- `GET /api/getFamilyShoppingChanges`
- `POST /api/saveFamilyShoppingItem` / `updateFamilyShoppingItem` 的返回 item
- 删除、清空已购的返回 item
- `GET /api/getFamilyData` 的 `shoppingList`，以及新增的 `anchorPrices` 数组（当前有效锚定，不含已删除）

前端如果整包用 `getFamilyData` 灌本地库，要接住 `anchorPrices`，并在渲染购物清单时读 `item.anchor`。

### 3.3 建议页面

1. 购物清单每一行：实付 / 标价仍编辑 `price`；旁边显示参考价 `anchor`。
2. 点参考价可维护该名称下的默认锚定和若干标签锚定（菜市场、品牌）。
3. 保存锚定后刷新这一行，或按返回的锚定更新本地 `anchor`。名称没变时，同一名称的其他清单行也要一起更新参考价。

---

## 4. `getFamilyData` 新增字段

`GET /api/getFamilyData?familyCode=fam_xxx` 在原有字段上增加：

| 字段 | 含义 |
|---|---|
| `anchorPrices` | 当前家庭有效锚定价格数组 |
| `publicCatalogVersion` | 公共菜谱目录版本，当前为 `1` |
| `shoppingList[].anchor` | 按清单名称匹配出的参考价，没有则为 `null` |
| `familyRecipes` / `familyRecipe.recipeJson.recipes` | 含未隐藏的公共菜，`source: "public"` |
| `recipePoolItems` | 含公共菜；不再含 `default_dish_*` |

---

## 5. 明确不要做

- 不要继续本地随机打乱 `getFamilyRecipePoolItems` 当抽签结果。
- 不要用 `saveFamilyRecipeItem` / `updateFamilyRecipeItem` 修改 `source === "public"` 的菜。
- 不要把锚定价写进购物清单的 `price`。
- 不要自己维护一份公共菜谱副本来覆盖服务端列表。`publicCatalogVersion` 变化时重新拉取。
- 不要假设旧默认菜（番茄炒蛋、可乐鸡翅等 `default_dish_*`）还会从池列表返回。
- 健康、三餐、消费、忌口接口不用为这次改请求体。

---

## 6. 建议实现顺序

1. 拉一次 `getFamilyData`，确认本地模型能收下 `source`、`publicCatalogVersion`、`anchor`、`anchorPrices`、池上的 `recipeId` / `manualWeight` / `paused`。旧缓存里的 `default_dish_*` 清掉。
2. 菜谱列表 / 详情：公共菜只读，删除改为隐藏；另存为家庭菜时换新 id。
3. 随机池列表：展示公共菜（用嵌套 `recipe`）、暂停和权重；保存公共菜的暂停 / 权重后重新拉列表。
4. 抽签页改成 `draw` + `feedback`，换一个走 skip 再抽。
5. 购物清单展示参考价，并做锚定的增删改。
6. 按第 7 节联调。

---

## 7. 联调清单

- [ ] 设备头鉴权正常，多家庭请求都带了 `familyCode`
- [ ] 菜谱列表能看到 4 道公共菜；家庭有同名菜时公共那道消失
- [ ] 打开 `public_zhengdan_geng` 详情有食材和步骤
- [ ] 编辑并保存公共菜 id 得到 400，界面不再提供这个操作
- [ ] 删除公共菜后，菜谱列表和随机池都不再出现它
- [ ] 随机池没有 `default_dish_*`；公共菜 `source` 为 `public` 且带 `recipe`
- [ ] 池保存仍可用只有 `name` + `type` 的旧参数；`manualWeight` / `paused` 能回显
- [ ] `paused: true` 的菜抽不到
- [ ] 抽签返回 `drawId`；换一个先 `skip` 再 `draw`，并带上 `excludeDishIds`
- [ ] 候选为 0 时有空态，不把空 `drawId` 拿去反馈
- [ ] 用一个不存在的 `drawId` 反馈得到 404
- [ ] 忌口命中的菜名不会被抽到
- [ ] 保存「牛奶」默认锚定 12 后，购物清单里名叫牛奶的行 `anchor.anchorPrice === 12`，`price` 仍是原来的文本
- [ ] 只有多条带标签、没有默认锚定时，`anchorPrice` 为 `null`，界面显示 `anchorMin` ~ `anchorMax`
- [ ] `getFamilyData` 含 `anchorPrices` 与 `publicCatalogVersion`
