# 家庭类别接口

类别按家庭存储，设备必须已经加入对应家庭。首次查询或聚合拉取时，服务端会自动补齐默认类别。默认类别也属于当前家庭，可以删除，不会影响其他家庭。

所有接口都需要设备请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 食材类别

```text
GET /api/getFamilyIngredientCategories
```

返回当前设备所属家庭的食材类别，默认包含：主食、蔬菜、肉类、蛋奶、调味、其他。

```text
POST /api/saveFamilyIngredientCategory
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "ingredientCategoryJson": {
    "name": "冷冻",
    "sortOrder": 60
  }
}
```

```text
POST /api/deleteFamilyIngredientCategory
```

请求：

```json
{
  "id": "ingredient_cat_xxx"
}
```

默认类别和自定义类别都可以删除，删除采用软删除。

## 购物车类别

购物车类别和食材类别分开存表，默认包含：主食、蔬菜、肉类、蛋奶、调味、其他。

```text
GET /api/getFamilyShoppingCategories
```

```text
POST /api/saveFamilyShoppingCategory
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "shoppingCategoryJson": {
    "name": "冷冻",
    "sortOrder": 60
  }
}
```

```text
POST /api/deleteFamilyShoppingCategory
```

请求：

```json
{
  "id": "shopping_cat_xxx"
}
```

## 合并保存类别

需要“新增购物车分类时同步到食材库存分类”或反向同步时，使用一个接口即可。

```text
POST /api/saveFamilyCategory
```

购物车同步到食材库存分类：

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

食材库存分类同步到购物车分类：

```json
{
  "familyCode": "fam_xxx",
  "categoryType": "ingredient",
  "syncToShopping": true,
  "categoryJson": {
    "name": "干货",
    "sortOrder": 70
  }
}
```

保存前会检查本次要写入的分类表里是否已经有同名分类；任意一张表重名都会返回错误，不会继续写入。

## 菜品类别

```text
GET /api/getFamilyRecipeCategories
```

返回当前设备所属家庭的菜品类别，默认包含：家常菜、凉菜、汤羹、主食、早餐、其他。

```text
POST /api/saveFamilyRecipeCategory
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "recipeCategoryJson": {
    "name": "快手菜",
    "sortOrder": 60
  }
}
```

```text
POST /api/deleteFamilyRecipeCategory
```

请求：

```json
{
  "id": "recipe_cat_xxx"
}
```
