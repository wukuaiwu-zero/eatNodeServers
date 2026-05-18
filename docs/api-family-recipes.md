# family_recipes 家庭菜谱接口

`family_recipes` 当前按家庭存一整份 `recipe_json`。所有接口都需要设备请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 保存家庭菜谱

```text
POST /api/saveFamilyRecipe
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "recipeJson": {
    "recipes": [
      {
        "id": "recipe_tomato_egg",
        "name": "番茄炒蛋",
        "coverUrl": "/uploads/recipe-covers/fam_xxx/xxx.jpg"
      }
    ],
    "coverUrl": "/uploads/recipe-covers/fam_xxx/xxx.jpg"
  }
}
```

设备必须已加入 `familyCode` 对应家庭。

也可以把 `coverUrl` 放在请求体顶层：

```json
{
  "familyCode": "fam_xxx",
  "coverUrl": "/uploads/recipe-covers/fam_xxx/xxx.jpg",
  "recipeJson": {
    "recipes": []
  }
}
```

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

支持 `jpeg/png/webp/gif`，最大 4MB。上传成功后服务端会把图片存到 `public/uploads/recipe-covers`，并更新该家庭菜谱的 `coverUrl`。

## 查询当前设备家庭菜谱

```text
GET /api/getFamilyRecipeByMember
```

接口名保留历史命名，但现在按设备凭证找家庭，不再需要 `memberCode`。

## 按家庭查询菜谱

```text
GET /api/getFamilyRecipe?familyCode=fam_xxx
```

设备必须已加入该家庭。

菜谱相关接口返回里都会包含 `coverUrl`：

```json
{
  "data": {
    "familyCode": "fam_xxx",
    "coverUrl": "/uploads/recipe-covers/fam_xxx/xxx.jpg",
    "recipeJson": {
      "recipes": [],
      "coverUrl": "/uploads/recipe-covers/fam_xxx/xxx.jpg"
    }
  }
}
```
