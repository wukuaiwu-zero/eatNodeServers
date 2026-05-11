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

## POST /api/joinFamily

加入一个已经存在的家庭。

### Body

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| memberCode | string | 是 | 成员码 |
| familyCode | string | 是 | 目标家庭码 |

### 示例

```bash
curl -X POST http://localhost:3000/api/joinFamily \
  -H 'Content-Type: application/json' \
  -d '{"memberCode":"member_a","familyCode":"default_family"}'
```

## GET /api/getFamilyMembers

查询某个家庭的成员。

### Query

| 参数 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| familyCode | string | 是 | 家庭码 |

### 示例

```bash
curl 'http://localhost:3000/api/getFamilyMembers?familyCode=default_family'
```
