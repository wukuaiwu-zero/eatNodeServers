# 家庭聚合数据接口

## 说明

聚合接口不对应单独数据表，它用于客户端启动时一次拉取当前家庭的三类 JSON 数据：

- `familyRecipe`
- `shoppingList`
- `ingredientLibrary`

## GET /api/getFamilyData

按成员码查询家庭聚合数据。

### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |

### 示例

```bash
curl 'http://localhost:3000/api/getFamilyData?memberCode=member_a'
```

### 响应示例

```json
{
  "data": {
    "familyRecipe": {
      "recipes": []
    },
    "shoppingList": [],
    "ingredientLibrary": []
  }
}
```
