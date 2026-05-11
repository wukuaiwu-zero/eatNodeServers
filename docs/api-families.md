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

## 创建家庭

### 接口地址

```text
POST /api/createFamily
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "familyName": "默认家庭"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "id": 1,
    "familyCode": "default_family",
    "familyName": "默认家庭",
    "isDeleted": false,
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T10:00:00.000Z"
  }
}
```

## 查询家庭

### 接口地址

```text
GET /api/getFamily?familyCode=default_family
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
    "familyName": "默认家庭",
    "isDeleted": false,
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T10:00:00.000Z"
  }
}
```

## 修改家庭

### 接口地址

```text
POST /api/updateFamily
```

### 请求参数示例

```json
{
  "familyCode": "default_family",
  "familyName": "新的家庭名"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "id": 1,
    "familyCode": "default_family",
    "familyName": "新的家庭名",
    "isDeleted": false,
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T10:10:00.000Z"
  }
}
```

## 删除家庭

### 接口地址

```text
POST /api/deleteFamily
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
    "familyName": "默认家庭",
    "isDeleted": true,
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T10:20:00.000Z"
  }
}
```
