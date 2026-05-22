# family_recipes 家庭菜谱接口

`family_recipes` 现在按“一个家庭的一道菜谱一行”存储，不再保存整份 `recipe_json`。

主要字段：

```text
family_code, recipe_id, name, category, cover_url, difficulty, duration,
favorite, own, steps_json, version, deleted_at
```

配料保存在 `family_recipe_ingredients`：

```text
family_code, recipe_id, name, amount, is_seasoning, sort_order
```

`steps` 是数组，服务端会存到 `steps_json`。所有接口都需要设备请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 批量保存家庭菜谱

```text
POST /api/saveFamilyRecipe
```

这个接口兼容批量上传，会逐条写入字段表，不再整份覆盖 JSON。请求体可以传 `recipeJson.recipes`，也可以直接传数组。

请求：

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
        "steps": [
          "里脊肉切丝，用生抽、料酒、淀粉腌制15分钟",
          "青椒去籽切丝，大蒜切末"
        ]
      }
    ]
  }
}
```

设备必须已加入 `familyCode` 对应家庭。

## 新增/修改单条菜谱

```text
POST /api/saveFamilyRecipeItem
POST /api/updateFamilyRecipeItem
```

这两个接口共用同一套逻辑：按 `id`、`_id` 或 `recipeId` 更新已有菜谱；没有匹配到时新增。局部修改会保留原来的字段。

请求：

```json
{
  "familyCode": "fam_xxx",
  "recipeItemJson": {
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
      },
      {
        "amount": "3个",
        "isSeasoning": false,
        "name": "青椒"
      }
    ],
    "name": "青椒肉丝",
    "own": true,
    "steps": [
      "里脊肉切丝，用生抽、料酒、淀粉腌制15分钟",
      "青椒去籽切丝，大蒜切末"
    ]
  }
}
```

`id` 可不传，服务端会生成 `recipe_xxx`。新增时 `name` 必填；修改时如果原菜谱存在，可以只传要改的字段。

## 查询单条菜谱详情

```text
GET /api/getFamilyRecipeItem?familyCode=fam_xxx&id=recipe_qjrs
```

`id` 也兼容 `_id` 或 `recipeId`。

返回：

```json
{
  "data": {
    "member": {
      "familyCode": "fam_xxx",
      "memberCode": "dev_xxx"
    },
    "recipe": {
      "id": "recipe_qjrs",
      "recipeId": "recipe_qjrs",
      "familyCode": "fam_xxx",
      "category": "家常菜",
      "cover": "",
      "coverUrl": "",
      "difficulty": "中等",
      "duration": "20分钟",
      "favorite": false,
      "ingredients": [],
      "name": "青椒肉丝",
      "own": true,
      "steps": []
    }
  }
}
```

## 删除单条菜谱

```text
POST /api/deleteFamilyRecipeItem
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "id": "recipe_qjrs"
}
```

删除采用软删除：写入 `family_recipes.deleted_at`，配料明细会保留。列表和详情接口默认只返回未删除菜谱。

## 上传家庭菜谱封面

```text
POST /api/uploadFamilyRecipeCover
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "imageData": "data:image/jpeg;base64,..."
}
```

也兼容裸 base64：

```json
{
  "familyCode": "fam_xxx",
  "mimeType": "image/png",
  "imageBase64": "..."
}
```

支持 `jpeg/png/webp/gif`，最大 4MB。上传成功后服务端会把图片存到 `public/uploads/recipe-covers`，并更新该家庭第一条未删除菜谱的 `coverUrl`。

## 查询当前设备家庭菜谱

```text
GET /api/getFamilyRecipeByMember
```

接口名保留历史命名，但现在按设备凭证找家庭，不再需要 `memberCode`。

## 按家庭查询菜谱列表

```text
GET /api/getFamilyRecipe?familyCode=fam_xxx
```

设备必须已加入该家庭。

返回会同时包含兼容字段 `recipeJson.recipes` 和新的 `recipes`：

```json
{
  "data": {
    "familyCode": "fam_xxx",
    "coverUrl": "",
    "recipeJson": {
      "recipes": []
    },
    "recipes": []
  }
}
```
