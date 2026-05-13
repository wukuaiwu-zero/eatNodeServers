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

请求体可为空。服务端会生成匿名设备：

```json
{
  "data": {
    "device": {
      "deviceId": "dev_abc"
    },
    "deviceSecret": "只返回一次的密钥"
  }
}
```

前端需要把 `deviceId/deviceSecret` 存到本地缓存。

## 创建家庭

```text
POST /api/createFamily
```

请求：

```json
{
  "familyName": "默认家庭"
}
```

返回：

```json
{
  "data": {
    "family": {
      "familyCode": "fam_xxx",
      "familyName": "默认家庭",
      "createdByDeviceId": "dev_xxx"
    },
    "familySecret": "家庭密钥，只返回一次",
    "member": {
      "memberCode": "dev_xxx",
      "familyCode": "fam_xxx",
      "deviceId": "dev_xxx",
      "role": "owner",
      "joinedFamily": true
    },
    "invite": {
      "familyCode": "fam_xxx",
      "inviteCode": "123456",
      "expiresAt": "2026-05-12T07:28:49.000Z"
    }
  }
}
```

`familyCode` 由后端生成，前端不再自定义。

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

返回当前设备在家庭中的成员关系。

邀请码在过期前可重复使用，适合一次分享给多个家庭成员。

## 查询/修改/删除家庭

这些接口仍使用 `familyCode` 定位家庭，但必须带设备凭证，且设备必须已加入该家庭：

```text
GET /api/getFamily?familyCode=fam_xxx
POST /api/updateFamily
POST /api/deleteFamily
GET /api/getFamilyMembers?familyCode=fam_xxx
```
