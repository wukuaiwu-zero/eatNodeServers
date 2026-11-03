# 菜品随机池加权抽签 — 前端对接说明

> 后端已完成 P0 / P1 / P2。本文面向前端，说明**兼容性、变更点、推荐联调方式**。  
> 鉴权方式不变：请求头 `X-Device-Id` + `X-Device-Secret`（或 body 同名字段）。

---

## 1. 先看结论：新增菜品接口变了吗？

**路径和必填参数没变，旧写法可继续用。**

| 项 | 是否变化 |
|---|---|
| `POST /api/saveFamilyRecipePoolItem` | 路径不变 |
| 必填：`familyCode` + `dishJson.name` | 不变 |
| 可选：`dishJson.type`（外卖 / 堂食 / 做饭） | 不变 |
| 返回列表 `GET /api/getFamilyRecipePoolItems` | 路径不变，**响应多了字段** |
| 删除 `POST /api/deleteFamilyRecipePoolItem` | 不变 |

### 兼容写法（旧前端不用改也能用）

```json
{
  "familyCode": "fam_xxx",
  "dishJson": {
    "name": "宫保鸡丁",
    "type": "做饭"
  }
}
```

### P1 起可选增强字段（建议逐步接）

```json
{
  "familyCode": "fam_xxx",
  "dishJson": {
    "name": "宫保鸡丁",
    "type": "做饭",
    "recipeId": "recipe_xxx",
    "manualWeight": 1.5,
    "paused": false
  }
}
```

| 新字段 | 类型 | 默认 | 说明 |
|---|---|---|---|
| `recipeId` | string \| null | 按**菜名**自动对齐家庭菜谱；对不上则为 `null` | 关联完整菜谱后，抽签才能用收藏/难度/食材库存 |
| `manualWeight` | number | `1` | 手动权重，范围 **0.2 ~ 3** |
| `paused` | boolean | `false` | `true` 时不参与抽签 |

**列表/保存响应**现在还会带上：`recipeId`、`manualWeight`、`paused`（旧字段 `id/name/type/...` 仍在）。

> 完整菜谱（`saveFamilyRecipeItem`）接口**本次未改**。随机池和完整菜谱仍是两套数据；同名时后端会尽量自动挂 `recipeId`。

---

## 2. 这几次改动总览

目标：把「随机抽菜」从**前端本地乱序**，升级为**服务端加权抽签**，并闭环用户反馈。

| 阶段 | 内容 | 前端是否必须改 |
|---|---|---|
| **P0** | 新接口抽签；忌口/类型/今日已安排过滤；类型场景、最近用餐衰减、默认菜/新鲜度；写 `drawn` 事件 | **要接抽签接口**才有效果 |
| **P1** | 池条目可挂菜谱/手动权重/暂停；收藏、常用菜单、难度耗时、冰箱库存与临期 | 保存/列表建议展示新字段；抽签结果可读 `missingIngredients` |
| **P2** | 反馈接口；skip 衰减；口味/健康/天气/消费乘子 | **要接反馈**，权重才会越抽越准 |

### 新增接口（2 个）

1. `POST /api/drawFamilyRecipePool` — 加权抽签  
2. `POST /api/feedbackFamilyRecipePoolDraw` — 抽签结果反馈  

### 未改动的相关能力

- 家庭创建/加入、完整菜谱 CRUD、三餐计划、食材库、饮食偏好、健康目标、消费记录等原有接口逻辑不变  
- 抽签会**读取**这些数据来算权重，但不要求前端为此改写入协议（除随机池可选新字段外）

### 上线依赖（后端/运维）

确保已执行：

- `database/2026-11-03-recipe-pool-draw-events.sql`（抽签事件表）  
- `database/2026-11-03-recipe-pool-weight-columns.sql`（池表新列）  
  或 `npm run migrate:recipes`

---

## 3. 抽签接口

### `POST /api/drawFamilyRecipePool`

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
| `familyCode` | 是 | 当前家庭 |
| `mealName` | 否 | `早餐` / `午餐` / `晚餐`，影响常用菜单加权 |
| `count` | 否 | 一次抽几道，默认 `1`，最大 `3` |
| `types` | 否 | 限定类型；空或不传 = 全部 |
| `intent` | 否 | `normal` \| `quick` \| `clear_fridge` \| `healthy` |
| `memberId` | 否 | 用谁的健康目标；不传则优先当前设备成员 |
| `excludeDishIds` | 否 | 「不想要再抽」时带上已抽到的 id |
| `context.isWorkday` | 否 | 不传则按北京时间工作日推断 |
| `context.hour` | 否 | `0-23`，不传用北京时间当前小时 |
| `context.weather` | 否 | `normal` \| `hot` \| `cold` \| `rain` |

### 响应示例

```json
{
  "data": {
    "drawId": "draw_xxx",
    "items": [
      {
        "dishId": "dish_xxx",
        "id": "dish_xxx",
        "name": "青椒肉丝",
        "type": "做饭",
        "recipeId": "recipe_qjrs",
        "score": 2.3715,
        "reasons": ["收藏×1.35", "临期×1.5", "最近吃过×0.55"],
        "missingIngredients": ["青椒"],
        "expiringIngredients": ["猪里脊"]
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
      "candidateCount": 12
    }
  }
}
```

| 返回字段 | 前端建议 |
|---|---|
| `drawId` | **必须存着**，反馈接口要用 |
| `items[].dishId` | 展示与反馈 |
| `items[].score` / `reasons` | 调试期可展示；正式可用「为什么推荐」折叠文案 |
| `missingIngredients` | 提示「还缺：xxx」 |
| `expiringIngredients` | 提示「临期优先：xxx」 |
| `candidateCount === 0` | 空态：可能全被忌口/今日已安排/暂停过滤，引导放宽条件 |

---

## 4. 反馈接口

### `POST /api/feedbackFamilyRecipePoolDraw`

```json
{
  "familyCode": "fam_xxx",
  "drawId": "draw_xxx",
  "dishId": "dish_xxx",
  "action": "skip"
}
```

| `action` | 含义 | 建议触发时机 |
|---|---|---|
| `accept` | 采纳（加入今日临时池/计划前） | 用户点「就吃这个」 |
| `skip` | 跳过 / 换一个 | 点「换一个」**先反馈再抽** |
| `cooked` | 实际做过/吃过 | 写入三餐完成或打卡时 |
| `reject` | 明确不想再看到 | 「不喜欢这道」 |

成功响应：

```json
{
  "data": {
    "drawId": "draw_xxx",
    "dishId": "dish_xxx",
    "dishName": "青椒肉丝",
    "action": "skip",
    "score": 2.3715
  }
}
```

注意：必须先有对应的 `drawn` 记录（即这次结果来自 `drawFamilyRecipePool`），否则 404「抽签记录不存在」。

---

## 5. 前端推荐改造清单

### 5.1 必须改（否则加权抽签用不上）

1. **随机抽菜入口**  
   - 旧：本地对 `getFamilyRecipePoolItems` 做 `Math.random`  
   - 新：改为调 `drawFamilyRecipePool`  
2. **换一个**  
   - 对当前结果 `feedback` + `action: skip`  
   - 再 `draw`，并把当前 `dishId` 放进 `excludeDishIds`  
3. **缓存本次 `drawId`**  
   - 页面离开前的 accept/skip/reject 都要带上  

### 5.2 建议改（体验明显更好）

4. 抽签前传 `mealName`（当前是早/午/晚）  
5. 传 `context.hour` / `isWorkday`（若前端已有日历逻辑可覆盖服务端推断）  
6. 有天气则传 `context.weather`  
7. 快捷意图按钮：`quick`（快手）、`clear_fridge`（清冰箱）、`healthy`（健康）  
8. 结果页展示缺料 / 临期提示  
9. 池管理页：  
   - 开关「暂停抽签」→ `paused`  
   - 滑条「出现频率」→ `manualWeight`（0.2~3，默认 1）  
   - 可选绑定完整菜谱 `recipeId`（同名一般会自动绑）  

### 5.3 可以不改

- 仅「新增菜名 + 类型」的旧保存逻辑  
- 完整菜谱、购物清单、食材库原有 CRUD  
- 若短期不做反馈，抽签仍可用，但 **skip 衰减 / 学习效果不会生效**  

### 5.4 推荐交互时序

```text
进入抽签页
  → drawFamilyRecipePool
  → 展示 items[0]，本地记下 drawId / dishId

用户点「换一个」
  → feedbackFamilyRecipePoolDraw (skip)
  → drawFamilyRecipePool (excludeDishIds: [上一个 dishId])

用户点「就吃这个」
  → feedbackFamilyRecipePoolDraw (accept)
  → （可选）写入当日三餐临时池 / 计划

用户日后打卡完成
  → feedbackFamilyRecipePoolDraw (cooked)
  → （可选）同步三餐 done / diary
```

---

## 6. 权重会参考哪些前端已有数据？

前端**不必为抽签单独上报**这些，只要用户平时正常用功能即可：

| 数据 | 作用 |
|---|---|
| 饮食偏好「忌口」 | 硬过滤 |
| 饮食偏好「全家口味」 | 加权 |
| 当日三餐安排 | 今日已有菜不抽 |
| 近 30 天三餐菜名 | 最近吃过衰减 |
| 常用菜单 | 加权 |
| 完整菜谱收藏 / 难度 / 耗时 / 食材 | 加权与冰箱匹配 |
| 食材库有货 / 临期 | 库存与清冰箱 |
| 健康目标 | 减脂/增肌关键词 |
| 近 7 天餐饮类消费 | 花费高则倾向「做饭」 |
| 抽签反馈事件 | skip/reject 衰减 |

因此：**忌口、菜谱食材、食材库、健康目标** 维护得越完整，抽签越准。

---

## 7. 旧逻辑 vs 新逻辑对比

| 场景 | 旧前端 | 新前端 |
|---|---|---|
| 抽一道菜 | 本地 random 池列表 | `drawFamilyRecipePool` |
| 换一个 | 再 random，可能重复 | `skip` 反馈 + `excludeDishIds` 再抽 |
| 新增池菜 | `name` + `type` | 仍可只用这两项；可选权重/暂停/菜谱 |
| 展示池列表 | name/type | 多展示 paused / manualWeight / 是否已关联菜谱 |
| 和完整菜谱关系 | 基本无关 | 同名自动关联后，库存/收藏才会生效 |

---

## 8. 错误码与空态（前端文案建议）

| 情况 | HTTP | message 示例 | UI 建议 |
|---|---|---|---|
| 未加入家庭 | 403 | 当前设备还没有加入这个家庭 | 引导加入家庭 |
| 参数错误 | 400 | 菜品类型只能是… / 抽签数量必须是… | Toast |
| 反馈找不到抽签 | 404 | 抽签记录不存在 | 重新抽一次 |
| 候选为 0 | 200 | `items: []`, `candidateCount: 0` | 「没有可抽的菜，试试取消类型筛选 / 检查忌口 / 取消暂停」 |
| 写入限流 | 429 | 写入请求太频繁… | 稍后再试 |

---

## 9. 联调 Checklist

- [ ] 设备头鉴权正常  
- [ ] 保存池菜：旧参数仍成功；新字段读写回显正确  
- [ ] 列表返回含 `recipeId` / `manualWeight` / `paused`  
- [ ] 抽签返回 `drawId` + `items`  
- [ ] skip → 再抽，同菜频率下降（看 `reasons`）  
- [ ] accept / cooked 成功  
- [ ] `paused: true` 的菜不会被抽到  
- [ ] 设置忌口后，命中菜名的菜不会出现  
- [ ] `intent=clear_fridge` 时临期相关菜更靠前（有食材数据时）  

---

## 10. 一句话给前端

**新增菜品：接口兼容，旧参数不用改；随机能力：请改用服务端抽签 + 反馈两个新接口，并把 `drawId` 串起来。**
