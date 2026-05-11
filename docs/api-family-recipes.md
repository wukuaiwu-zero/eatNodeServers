# family_recipes 家庭菜谱表接口

## 表说明

`family_recipes` 当前按家庭存一整份 `recipe_json`。同一个 `family_code` 再次上传会覆盖旧 JSON。

## POST /api/saveFamilyRecipe

上传或更新家庭菜谱。首次上传时会自动创建家庭并绑定 `memberCode -> familyCode`。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |
| familyCode | string | 是 | 家庭码 |
| recipeJson | object/string | 是 | 菜谱 JSON |

### 示例

```bash
curl -X POST http://localhost:3000/api/saveFamilyRecipe \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"member_a","familyCode":"default_family","recipeJson":{"recipes":[{"name":"番茄炒蛋"}]}}'
```

## GET /api/getFamilyRecipeByMember

按成员码查询当前家庭菜谱。

### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |

### 示例

```bash
curl 'http://localhost:3000/api/getFamilyRecipeByMember?memberCode=member_a'
```

## GET /api/getFamilyRecipe

按家庭码查询菜谱。

### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

### 示例

```bash
curl 'http://localhost:3000/api/getFamilyRecipe?familyCode=default_family'
```
