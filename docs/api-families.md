# families 家庭表接口

## 表说明

`families` 保存家庭本身的信息。`family_code` 是家庭唯一标识，后续家庭成员、菜谱、购物清单、食材库都通过它关联。

## 数据对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 家庭 ID |
| familyCode | string | 家庭码 |
| familyName | string/null | 家庭名称 |
| isDeleted | boolean | 是否软删除 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

## POST /api/createFamily

创建家庭。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码，最长 100 字符 |
| familyName | string | 否 | 家庭名称 |

### 示例

```bash
curl -X POST http://localhost:3000/api/createFamily \
  -H 'Content-Type: application/json' \
  -d '{"familyCode":"default_family","familyName":"默认家庭"}'
```

## GET /api/getFamily

查询家庭。

### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

### 示例

```bash
curl 'http://localhost:3000/api/getFamily?familyCode=default_family'
```

## POST /api/updateFamily

修改家庭名称。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |
| familyName | string/null | 否 | 新家庭名称 |

## POST /api/deleteFamily

软删除家庭。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |
