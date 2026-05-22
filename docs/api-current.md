# 家庭厨房 API 当前接口文档

Base URL:

```text
{{baseUrl}}/api
```

除 `POST /api/registerDevice` 外，接口都需要：

```text
X-Device-Id: {{deviceId}}
X-Device-Secret: {{deviceSecret}}
```

## 设备

### POST /api/registerDevice

注册匿名设备。返回 `device.deviceId` 和只返回一次的 `deviceSecret`。

请求：

```json
{}
```

## 家庭与成员

### POST /api/createFamily

创建家庭，当前设备成为 `owner`。

```json
{
  "familyName": "我的厨房"
}
```

### GET /api/getFamily?familyCode=fam_xxx

查询家庭信息。

### POST /api/updateFamily

```json
{
  "familyCode": "fam_xxx",
  "familyName": "新的厨房名"
}
```

### POST /api/deleteFamily

解散家庭。

```json
{
  "familyCode": "fam_xxx"
}
```

### POST /api/createFamilyInvite

```json
{
  "familyCode": "fam_xxx",
  "ttlMinutes": 60
}
```

### POST /api/joinFamily

```json
{
  "inviteCode": "123456"
}
```

### GET /api/getFamilyMembers?familyCode=fam_xxx

返回家庭成员，包含：

```json
{
  "memberCode": "dev_xxx",
  "familyCode": "fam_xxx",
  "deviceId": "dev_xxx",
  "name": "小明",
  "title": "爸爸",
  "avatarUrl": "/uploads/avatars/a.png",
  "role": "owner",
  "isManager": true
}
```

### POST /api/leaveFamily

当前设备退出家庭。`owner` 不能退出，只能调用 `POST /api/deleteFamily` 解散家庭。

```json
{
  "familyCode": "fam_xxx"
}
```

### POST /api/updateMyFamilyMemberProfile

更新当前设备在某个家庭里的成员资料。

```json
{
  "familyCode": "fam_xxx",
  "name": "小明",
  "title": "爸爸",
  "avatarUrl": "/uploads/avatars/a.png"
}
```

## 家庭菜谱

### POST /api/saveFamilyRecipe

批量保存家庭菜谱。后端会逐条写入 `family_recipes` 和 `family_recipe_ingredients`，不再保存整份 `recipeJson`。

```json
{
  "familyCode": "fam_xxx",
  "recipeJson": {
    "recipes": [
      {
        "id": "recipe_qjrs",
        "category": "家常菜",
        "cover": "",
        "difficulty": "中等",
        "duration": "20分钟",
        "favorite": false,
        "ingredients": [
          {
            "amount": "200g",
            "isSeasoning": false,
            "name": "猪里脊"
          }
        ],
        "name": "青椒肉丝",
        "own": true,
        "steps": ["里脊肉切丝", "青椒去籽切丝"]
      }
    ]
  }
}
```

### POST /api/saveFamilyRecipeItem

新增单条菜谱。服务端会写入字段表；`steps` 存为 JSON，`ingredients` 存到配料表。

```json
{
  "familyCode": "fam_xxx",
  "recipeItemJson": {
    "id": "recipe_tomato_egg",
    "name": "番茄炒蛋",
    "ingredients": [
      {
        "amount": "2个",
        "isSeasoning": false,
        "name": "鸡蛋"
      }
    ],
    "steps": ["鸡蛋炒熟", "番茄炒出汁后合炒"]
  }
}
```

`id` 可不传，服务端会生成；`name` 必填。

### POST /api/updateFamilyRecipeItem

修改单条菜谱。按 `recipeItemJson.id` 找到原菜谱后合并更新；没有匹配到时新增一条。修改已有菜谱时可以只传要改的字段。

```json
{
  "familyCode": "fam_xxx",
  "recipeItemJson": {
    "id": "recipe_tomato_egg",
    "name": "番茄炒鸡蛋"
  }
}
```

### GET /api/getFamilyRecipeItem?familyCode=fam_xxx&id=recipe_tomato_egg

查询单条菜谱详情。`id` 也兼容 `_id` 或 `recipeId`。

### POST /api/uploadFamilyRecipeCover

上传家庭菜谱封面。支持 `jpeg/png/webp/gif`，最大 4MB。

```json
{
  "familyCode": "fam_xxx",
  "imageData": "data:image/png;base64,..."
}
```

也支持：

```json
{
  "familyCode": "fam_xxx",
  "mimeType": "image/png",
  "imageBase64": "..."
}
```

### GET /api/getFamilyRecipeByMember

按当前设备所属家庭查询菜谱。

### GET /api/getFamilyRecipe?familyCode=fam_xxx

按家庭查询菜谱。返回包含 `coverUrl`。

## 购物清单

### POST /api/saveFamilyShoppingItem

```json
{
  "familyCode": "fam_xxx",
  "shoppingItemJson": {
    "id": "shop_tomato",
    "name": "番茄",
    "num": "3个",
    "categoryId": "shopping_cat_vegetable",
    "done": false
  }
}
```

### POST /api/updateFamilyShoppingItem

请求体同保存接口。按 `familyCode + id` 覆盖同一条购物清单。

### GET /api/getFamilyShoppingItem?id=shop_tomato

查询单条购物清单。

### GET /api/getFamilyShoppingItems

查询当前设备所属家庭的购物清单。

### GET /api/getFamilyShoppingItems?categoryId=cat_vegetable

按分类 ID 查询当前设备所属家庭的购物清单。

### GET /api/getFamilyShoppingChanges?since=0

查询增量变化，包括软删除条目。

### POST /api/deleteFamilyShoppingItem

```json
{
  "id": "shop_tomato"
}
```

### POST /api/deleteFamilyShoppingItems

```json
{
  "ids": ["shop_tomato", "shop_milk"]
}
```

### POST /api/clearPurchasedFamilyShoppingItems

清除当前设备所属家庭里 `done: true` 的购物清单。

## 食材库

### POST /api/saveFamilyIngredientItem

```json
{
  "familyCode": "fam_xxx",
  "ingredientItemJson": {
    "id": "ingredient_coriander",
    "name": "香菜",
    "num": "1把",
    "categoryId": "ingredient_cat_vegetable",
    "expire_date": "2026-05-20",
    "has": true
  }
}
```

### POST /api/updateFamilyIngredientItem

请求体同保存接口。按 `familyCode + id` 覆盖同一条食材库存。

### GET /api/getFamilyIngredientItem?id=ingredient_coriander

查询单条食材。

### GET /api/getFamilyIngredientItems

查询当前设备所属家庭的食材库。

### GET /api/getFamilyIngredientItems?categoryId=cat_staple

按分类 ID 查询当前设备所属家庭的食材库。

### GET /api/getFamilyIngredientChanges?since=0

查询增量变化，包括软删除条目。

### POST /api/deleteFamilyIngredientItem

```json
{
  "id": "ingredient_coriander"
}
```

### POST /api/deleteFamilyIngredientItems

```json
{
  "ids": ["ingredient_coriander", "ingredient_rice"]
}
```

### POST /api/clearExpiredFamilyIngredientItems

清除当前设备所属家庭里 `expire_date < CURDATE()` 的食材。

## 分类

分类按家庭存储，默认分类会在首次查询或聚合拉取时自动补齐。默认分类也可以软删除。

### POST /api/saveFamilyCategory

通用分类保存接口，可同步写入购物分类和食材分类。

```json
{
  "familyCode": "fam_xxx",
  "categoryType": "shopping",
  "syncToIngredient": true,
  "categoryJson": {
    "name": "冷冻",
    "sortOrder": 60
  }
}
```

### 购物分类

```text
POST /api/saveFamilyShoppingCategory
GET /api/getFamilyShoppingCategories
POST /api/deleteFamilyShoppingCategory
```

保存请求：

```json
{
  "familyCode": "fam_xxx",
  "shoppingCategoryJson": {
    "name": "冷冻",
    "sortOrder": 60
  }
}
```

删除请求：

```json
{
  "id": "shopping_cat_xxx"
}
```

### 食材分类

```text
POST /api/saveFamilyIngredientCategory
GET /api/getFamilyIngredientCategories
POST /api/deleteFamilyIngredientCategory
```

保存请求：

```json
{
  "familyCode": "fam_xxx",
  "ingredientCategoryJson": {
    "name": "干货",
    "sortOrder": 70
  }
}
```

### 菜品分类

```text
POST /api/saveFamilyRecipeCategory
GET /api/getFamilyRecipeCategories
POST /api/deleteFamilyRecipeCategory
```

保存请求：

```json
{
  "familyCode": "fam_xxx",
  "recipeCategoryJson": {
    "name": "快手菜",
    "sortOrder": 60
  }
}
```

## 菜品随机池

### GET /api/getFamilyRecipePoolItems

查询当前设备所属家庭的菜品随机池。首次查询会自动补齐默认菜。

默认菜：番茄炒蛋、可乐鸡翅、青椒肉丝、蒜蓉西兰花、红烧肉、酸辣土豆丝、水煮肉片、香菇滑鸡、蛋炒饭、粉蒸排骨、糖醋里脊、麻婆豆腐、手撕包菜、清炒菜心。

### POST /api/saveFamilyRecipePoolItem

```json
{
  "familyCode": "fam_xxx",
  "dishJson": {
    "name": "宫保鸡丁",
    "type": "manual"
  }
}
```

`type` 可用来区分 `default`、`manual`、`takeout`、`dine_in`、`recipe_sync` 等。同一家庭下未删除菜名不能重复。

### POST /api/deleteFamilyRecipePoolItem

```json
{
  "id": "default_dish_1"
}
```

## 聚合数据

### GET /api/getFamilyData

一次拉取当前设备所属家庭数据，返回：

```json
{
  "data": {
    "familyRecipe": {
      "recipes": []
    },
    "familyRecipes": [],
    "shoppingList": [],
    "ingredientLibrary": [],
    "shoppingCategories": [],
    "ingredientCategories": [],
    "recipeCategories": [],
    "recipePoolItems": []
  }
}
```

## Postman Collection

可导入文件：

```text
docs/apifox-postman-collection.json
```
