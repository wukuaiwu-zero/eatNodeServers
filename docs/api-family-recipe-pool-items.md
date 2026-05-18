# family_recipe_pool_items 菜品随机池接口

菜品随机池按家庭存储。首次查询、保存或聚合拉取时，服务端会自动补齐默认菜品。默认菜品也可以被改名或软删除。

所有接口都需要设备请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

默认菜品：

```text
番茄炒蛋、可乐鸡翅、青椒肉丝、蒜蓉西兰花、红烧肉、酸辣土豆丝、水煮肉片、香菇滑鸡、蛋炒饭、粉蒸排骨、糖醋里脊、麻婆豆腐、手撕包菜、清炒菜心
```

默认菜品的 `type` 是 `default`。手动添加默认是 `manual`，也可以传 `takeout`、`dine_in`、`recipe_sync` 等业务类型。

## 查询菜品随机池

```text
GET /api/getFamilyRecipePoolItems
```

按当前设备所属家庭返回未删除菜品。

## 保存菜品

```text
POST /api/saveFamilyRecipePoolItem
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "dishJson": {
    "name": "宫保鸡丁",
    "type": "manual"
  }
}
```

更新已有菜品时传 `id`、`_id` 或 `dishId`：

```json
{
  "familyCode": "fam_xxx",
  "dishJson": {
    "id": "default_dish_1",
    "name": "番茄炒鸡蛋"
  }
}
```

更新时不传 `type` 会保留原类型。

## 删除菜品

```text
POST /api/deleteFamilyRecipePoolItem
```

请求：

```json
{
  "id": "default_dish_1"
}
```
