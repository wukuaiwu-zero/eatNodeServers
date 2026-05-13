# family_members 家庭成员接口

`family_members` 保存匿名设备和家庭的绑定关系：

```text
deviceId -> familyCode
```

`memberCode` 当前直接使用 `deviceId`，用于兼容已有 service 字段命名。

## 加入家庭

```text
POST /api/joinFamily
```

请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

请求体：

```json
{
  "inviteCode": "123456"
}
```

## 查询家庭成员

```text
GET /api/getFamilyMembers?familyCode=fam_xxx
```

请求设备必须已加入该家庭。
