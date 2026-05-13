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
        "name": "番茄炒蛋"
      }
    ]
  }
}
```

设备必须已加入 `familyCode` 对应家庭。

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
