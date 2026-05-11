# family_members 家庭成员表接口

## 表说明

`family_members` 保存 `memberCode -> familyCode` 的绑定关系。当前项目没有完整登录体系，`memberCode` 相当于前端本地保存的成员/设备身份。

## 数据对象

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| id | number | 绑定 ID |
| memberCode | string | 成员码 |
| familyCode | string | 家庭码 |
| joinedFamily | boolean | 是否主动加入过家庭 |
| createdAt | string | 创建时间 |
| updatedAt | string | 更新时间 |

## 加入家庭

### 接口地址

```text
POST /api/joinFamily
```

### 请求参数示例

```json
{
  "memberCode": "member_a",
  "familyCode": "default_family"
}
```

### 返回参数示例

```json
{
  "code": 200,
  "res": {
    "id": 1,
    "memberCode": "member_a",
    "familyCode": "default_family",
    "joinedFamily": true,
    "createdAt": "2026-05-11T10:00:00.000Z",
    "updatedAt": "2026-05-11T10:00:00.000Z"
  }
}
```

## 查询家庭成员

### 接口地址

```text
GET /api/getFamilyMembers?familyCode=default_family
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
  "res": [
    {
      "id": 1,
      "memberCode": "member_a",
      "familyCode": "default_family",
      "joinedFamily": true,
      "createdAt": "2026-05-11T10:00:00.000Z",
      "updatedAt": "2026-05-11T10:00:00.000Z"
    }
  ]
}
```
