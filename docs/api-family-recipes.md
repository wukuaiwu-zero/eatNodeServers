# family_recipes 家庭菜谱表接口

## 表说明

`family_recipes` 当前按家庭存一整份 `recipe_json`。同一个 `family_code` 再次上传会覆盖旧 JSON。

## 保存家庭菜谱

### 接口地址

```text
POST /api/saveFamilyRecipe
```

### 请求参数示例

```json
{
  "memberCode": "member_a",
  "familyCode": "default_family",
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

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "member": {
      "memberCode": "member_a",
      "familyCode": "default_family",
      "joinedFamily": false
    },
    "recipe": {
      "id": 1,
      "familyCode": "default_family",
      "recipeJson": {
        "recipes": [
          {
            "id": "recipe_tomato_egg",
            "name": "番茄炒蛋"
          }
        ]
      },
      "createdAt": "2026-05-11T10:00:00.000Z",
      "updatedAt": "2026-05-11T10:00:00.000Z"
    }
  }
}
```

## 按成员查询家庭菜谱

### 接口地址

```text
GET /api/getFamilyRecipeByMember?memberCode=member_a
```

### 请求参数示例

```json
{
  "memberCode": "member_a"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "member": {
      "memberCode": "member_a",
      "familyCode": "default_family",
      "joinedFamily": true
    },
    "recipe": {
      "familyCode": "default_family",
      "recipeJson": {
        "recipes": []
      }
    }
  }
}
```

## 按家庭查询菜谱

### 接口地址

```text
GET /api/getFamilyRecipe?familyCode=default_family
```

### 请求参数示例

```json
{
  "familyCode": "default_family"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "id": 1,
    "familyCode": "default_family",
    "recipeJson": {
      "recipes": []
    },
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T10:00:00.000Z"
  }
}
```
