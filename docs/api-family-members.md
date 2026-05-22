# family_members 家庭成员接口

`family_members` 保存匿名设备和家庭的多家庭绑定关系：

```text
deviceId -> familyCode[]
```

`memberCode` 当前直接使用 `deviceId`，用于兼容已有 service 字段命名。
`relationType = "home"` 表示设备首次使用时创建的基础家庭，基础家庭不能退出。

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

返回：

```json
{
  "data": [
    {
      "memberCode": "dev_xxx",
      "familyCode": "fam_xxx",
      "deviceId": "dev_xxx",
      "name": "小明",
      "title": "爸爸",
      "avatarUrl": "/uploads/avatars/a.png",
      "role": "owner",
      "isManager": true
    }
  ]
}
```

`role` 当前常见值是 `owner`、`member`。`isManager` 会在 `role` 为 `owner`、`admin` 或 `manager` 时返回 `true`。

## 更新当前设备的成员资料

```text
POST /api/updateMyFamilyMemberProfile
```

请求设备必须已加入该家庭。

请求体：

```json
{
  "familyCode": "fam_xxx",
  "name": "小明",
  "title": "爸爸",
  "avatarUrl": "/uploads/avatars/a.png"
}
```

## 退出家庭

```text
POST /api/leaveFamily
```

请求设备必须已加入该家庭。`relationType = "home"` 的基础家庭不能退出。

请求体：

```json
{
  "familyCode": "fam_xxx"
}
```

退出采用软撤销成员关系：`joined_family = 0`，`revoked_at` 写入当前时间。家庭数据不会删除。
