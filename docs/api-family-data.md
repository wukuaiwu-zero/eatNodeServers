# 家庭聚合数据接口

聚合接口用于客户端启动时一次拉取当前设备所属家庭的三类数据：

- `familyRecipe`
- `shoppingList`
- `ingredientLibrary`
- `shoppingCategories`
- `ingredientCategories`
- `recipeCategories`
- `recipePoolItems`

请求必须带：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 查询家庭聚合数据

```text
GET /api/getFamilyData
```

返回：

```json
{
  "data": {
    "familyRecipe": {
      "recipes": [],
      "coverUrl": "/uploads/recipe-covers/fam_xxx/xxx.jpg"
    },
    "shoppingList": [],
    "ingredientLibrary": [],
    "shoppingCategories": [],
    "ingredientCategories": [],
    "recipeCategories": [],
    "recipePoolItems": []
  }
}
```
