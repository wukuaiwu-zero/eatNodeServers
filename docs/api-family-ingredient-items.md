# family_ingredient_items 食材库表接口

## 表说明

`family_ingredient_items` 和购物清单当前字段基本一致，但独立存储，方便后续扩展食材库专属逻辑。

## POST /api/saveFamilyIngredientItem

新增或更新食材库条目。

```bash
curl -X POST http://localhost:3000/api/saveFamilyIngredientItem \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"member_a","familyCode":"default_family","ingredientItemJson":{"name":"大米","num":"5kg","category":"主食","price":"35","done":false,"family_id":"default_family","_id":"ingredient_rice","create_time":1778294368928,"id":"ingredient_rice"}}'
```

## GET /api/getFamilyIngredientItem

查询单条食材库条目。

```bash
curl 'http://localhost:3000/api/getFamilyIngredientItem?familyCode=default_family&id=ingredient_rice'
```

## GET /api/getFamilyIngredientItems

查询食材库列表。

```bash
curl 'http://localhost:3000/api/getFamilyIngredientItems?familyCode=default_family'
```

## GET /api/getFamilyIngredientChanges

查询食材库增量变更。

```bash
curl 'http://localhost:3000/api/getFamilyIngredientChanges?familyCode=default_family&since=0'
```

## POST /api/deleteFamilyIngredientItem

软删除食材库条目。

```bash
curl -X POST http://localhost:3000/api/deleteFamilyIngredientItem \
  -H 'Content-Type: application/json' \
  -d '{"familyCode":"default_family","id":"ingredient_rice","memberCode":"member_a"}'
```
