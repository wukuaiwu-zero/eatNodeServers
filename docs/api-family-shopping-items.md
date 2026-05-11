# family_shopping_items 购物清单表接口

## 表说明

`family_shopping_items` 按条目存购物清单。唯一键是 `family_code + item_id`，删除采用软删除，方便多端同步删除状态。

## 数据对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id/_id | string | 条目 ID |
| family_id | string | 家庭码 |
| name | string | 名称 |
| num | string | 数量 |
| category | string | 分类 |
| price | string | 价格 |
| done | boolean | 是否完成 |
| create_time | number | 客户端创建时间 |
| version | number | 服务端版本号 |
| deleted | boolean | 是否软删除 |
| deletedAt | string/null | 删除时间 |
| updatedAt | string | 服务端更新时间 |

## POST /api/saveFamilyShoppingItem

新增或更新购物清单条目。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |
| familyCode | string | 是 | 家庭码 |
| shoppingItemJson | object/string | 是 | 购物清单条目 |

### 示例

```bash
curl -X POST http://localhost:3000/api/saveFamilyShoppingItem \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"member_a","familyCode":"default_family","shoppingItemJson":{"name":"番茄","num":"3个","category":"蔬菜","price":"6","done":false,"family_id":"default_family","_id":"shop_tomato","create_time":1778294348928,"id":"shop_tomato"}}'
```

## GET /api/getFamilyShoppingItem

查询单条购物清单。推荐传 `familyCode + id`。

### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |
| id | string | 是 | 条目 ID |

### 示例

```bash
curl 'http://localhost:3000/api/getFamilyShoppingItem?familyCode=default_family&id=shop_tomato'
```

## GET /api/getFamilyShoppingItems

查询购物清单列表。可传 `familyCode`，也可传 `memberCode`。

```bash
curl 'http://localhost:3000/api/getFamilyShoppingItems?familyCode=default_family'
```

## GET /api/getFamilyShoppingChanges

查询增量变更，包含已软删除条目。

```bash
curl 'http://localhost:3000/api/getFamilyShoppingChanges?familyCode=default_family&since=0'
```

## POST /api/deleteFamilyShoppingItem

软删除购物清单条目。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |
| id | string | 是 | 条目 ID |
| memberCode | string | 否 | 操作成员码 |

```bash
curl -X POST http://localhost:3000/api/deleteFamilyShoppingItem \
  -H 'Content-Type: application/json' \
  -d '{"familyCode":"default_family","id":"shop_tomato","memberCode":"member_a"}'
```
