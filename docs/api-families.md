# families 家庭接口

## 认证方式

除 `POST /api/registerDevice` 外，家庭和同步接口都需要请求头：

```text
X-Device-Id: dev_xxx
X-Device-Secret: 设备密钥
```

## 注册匿名设备

```text
POST /api/registerDevice
```

请求体可为空。服务端会生成匿名设备，并确保当前设备拥有一个 `relationType = "home"` 的基础家庭：

```json
{
  "data": {
    "device": {
      "deviceId": "dev_abc"
    },
    "deviceSecret": "只返回一次的密钥",
    "homeFamilyCode": "fam_home",
    "familyCodeList": ["fam_home"],
    "families": [
      {
        "familyCode": "fam_home",
        "familyName": "我的厨房",
        "relationType": "home",
        "isHomeFamily": true,
        "role": "owner"
      }
    ]
  }
}
```

前端需要把 `deviceId/deviceSecret` 存到本地缓存。
`familyCodeList` 不落库，由 `family_members` 关系动态查询出来，用于前端展示多家庭切换列表。

## 创建家庭

```text
POST /api/createFamily
```

请求：

```json
{
  "familyName": "默认家庭",
  "avatarUrl": "/uploads/family-avatars/demo.png"
}
```

返回：

```json
{
  "data": {
    "family": {
      "familyCode": "fam_xxx",
      "familyName": "默认家庭",
      "avatarUrl": "/uploads/family-avatars/demo.png",
      "createdByDeviceId": "dev_xxx"
    },
    "familySecret": "家庭密钥，只返回一次",
    "member": {
      "memberCode": "dev_xxx",
      "familyCode": "fam_xxx",
      "deviceId": "dev_xxx",
      "role": "owner",
      "relationType": "joined",
      "isHomeFamily": false,
      "joinedFamily": true
    },
    "invite": {
      "familyCode": "fam_xxx",
      "inviteCode": "123456",
      "expiresAt": "2026-05-12T07:28:49.000Z"
    },
    "familyCodeList": ["fam_home", "fam_xxx"],
    "families": []
  }
}
```

`familyCode` 由后端生成，前端不再自定义。
手动创建的家庭默认是 `relationType = "joined"`，不会替换设备首次注册时生成的基础家庭。

## 查询当前设备的家庭列表

```text
GET /api/getMyFamilies
```

返回当前设备可访问的所有家庭：

```json
{
  "data": {
    "homeFamilyCode": "fam_home",
    "familyCodeList": ["fam_home", "fam_xxx"],
    "families": [
      {
        "familyCode": "fam_home",
        "familyName": "我的厨房",
        "relationType": "home",
        "isHomeFamily": true,
        "role": "owner"
      },
      {
        "familyCode": "fam_xxx",
        "familyName": "周末家宴",
        "relationType": "joined",
        "isHomeFamily": false,
        "role": "member"
      }
    ]
  }
}
```

## 创建邀请码

```text
POST /api/createFamilyInvite
```

请求：

```json
{
  "familyCode": "fam_xxx",
  "ttlMinutes": 60
}
```

返回：

```json
{
  "data": {
    "familyCode": "fam_xxx",
    "inviteCode": "123456",
    "expiresAt": "2026-05-12T07:28:49.000Z"
  }
}
```

## 加入家庭

```text
POST /api/joinFamily
```

请求：

```json
{
  "inviteCode": "123456"
}
```

返回当前设备在家庭中的成员关系，并返回最新 `familyCodeList/families`。

邀请码在过期前可重复使用，适合一次分享给多个家庭成员。

如果当前设备已经在另一个家庭，加入成功后会新增一条家庭成员关系，不会覆盖原基础家庭。

## 查询/修改/删除家庭

这些接口仍使用 `familyCode` 定位家庭，但必须带设备凭证，且设备必须已加入该家庭：

```text
GET /api/getFamily?familyCode=fam_xxx
POST /api/updateFamily
POST /api/deleteFamily
GET /api/getFamilyMembers?familyCode=fam_xxx
```

修改家庭时可传：

```json
{
  "familyCode": "fam_xxx",
  "familyName": "新的家庭名",
  "avatarUrl": "/uploads/family-avatars/new.png"
}
```

## 退出家庭

```text
POST /api/leaveFamily
```

请求：

```json
{
  "familyCode": "fam_xxx"
}
```

`relationType = "home"` 的基础家庭不能退出；其他家庭退出时会软撤销成员关系，家庭数据不会删除。
