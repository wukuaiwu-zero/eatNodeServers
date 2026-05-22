const familyService = require('../services/family.service');
const familyRecipeService = require('../services/familyRecipe.service');
const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const FAMILY_NAME_MAX_LENGTH = 100;
const MEMBER_TEXT_MAX_LENGTH = 100;
const AVATAR_URL_MAX_LENGTH = 255;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
}

function normalizeNullableText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized || null;
}

function validateFamilyCode(familyCode) {
  if (!familyCode) {
    return '请选择家庭';
  }

  if (familyCode.length > FAMILY_CODE_MAX_LENGTH) {
    return `家庭码太长了，不能超过 ${FAMILY_CODE_MAX_LENGTH} 个字符`;
  }

  return null;
}

function validateFamilyName(familyName) {
  if (familyName && familyName.length > FAMILY_NAME_MAX_LENGTH) {
    return `家庭名称太长了，不能超过 ${FAMILY_NAME_MAX_LENGTH} 个字符`;
  }

  return null;
}

function validateMaxLength(value, fieldName, maxLength) {
  if (value && value.length > maxLength) {
    return `${fieldName}太长了，不能超过 ${maxLength} 个字符`;
  }

  return null;
}

async function createFamily(req, res, next) {
  try {
    const familyName = normalizeNullableText(req.body.familyName);
    const avatarUrl = normalizeNullableText(req.body.avatarUrl || req.body.avatar_url);
    const familyNameError = validateFamilyName(familyName);
    const avatarUrlError = validateMaxLength(avatarUrl, '家庭头像 URL', AVATAR_URL_MAX_LENGTH);

    if (familyNameError) {
      return res.status(400).json({ message: familyNameError });
    }

    if (avatarUrlError) {
      return res.status(400).json({ message: avatarUrlError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const data = await familyService.createFamilyForDevice(device.deviceId, familyName, {
      avatarUrl
    });
    const member = await familyRecipeService.bindDeviceToFamily(device.deviceId, data.family.familyCode, 'owner');
    const invite = await familyService.createFamilyInvite(data.family.familyCode);
    const familySummary = await familyRecipeService.getFamilySummaryByDevice(device.deviceId);

    return res.status(201).json({
      data: {
        ...data,
        member,
        invite,
        familyCodeList: familySummary.familyCodeList,
        families: familySummary.families
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function getMyFamilies(req, res, next) {
  try {
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const data = await familyRecipeService.getFamilySummaryByDevice(device.deviceId);

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function getFamily(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const family = await familyService.getFamilyByCode(familyCode);

    if (!family) {
      return res.status(404).json({ message: '家庭不存在' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function updateFamily(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const hasFamilyNameInput = req.body.familyName !== undefined;
    const familyName = hasFamilyNameInput ? normalizeNullableText(req.body.familyName) : undefined;
    const hasAvatarUrlInput = req.body.avatarUrl !== undefined || req.body.avatar_url !== undefined;
    const avatarUrl = hasAvatarUrlInput
      ? normalizeNullableText(req.body.avatarUrl || req.body.avatar_url)
      : undefined;
    const familyCodeError = validateFamilyCode(familyCode);
    const familyNameError = hasFamilyNameInput ? validateFamilyName(familyName) : null;
    const avatarUrlError = hasAvatarUrlInput
      ? validateMaxLength(avatarUrl, '家庭头像 URL', AVATAR_URL_MAX_LENGTH)
      : null;

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (familyNameError) {
      return res.status(400).json({ message: familyNameError });
    }

    if (avatarUrlError) {
      return res.status(400).json({ message: avatarUrlError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const family = await familyService.updateFamily(familyCode, familyName, avatarUrl);

    if (!family) {
      return res.status(404).json({ message: '家庭不存在' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function deleteFamily(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const family = await familyService.deleteFamily(familyCode);

    if (!family) {
      return res.status(404).json({ message: '家庭不存在' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function listFamilyMembers(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const family = await familyService.getFamilyByCode(familyCode);

    if (!family) {
      return res.status(404).json({ message: '家庭不存在' });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const members = await familyRecipeService.listFamilyMembers(familyCode);
    return res.json({ data: members });
  } catch (error) {
    return next(error);
  }
}

async function updateMyFamilyMemberProfile(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);
    const name = normalizeNullableText(req.body.name || req.body.memberName);
    const title = normalizeNullableText(req.body.title);
    const avatarUrl = normalizeNullableText(req.body.avatarUrl || req.body.avatar_url);
    const nameError = validateMaxLength(name, '成员名字', MEMBER_TEXT_MAX_LENGTH);
    const titleError = validateMaxLength(title, '成员职称', MEMBER_TEXT_MAX_LENGTH);
    const avatarUrlError = validateMaxLength(avatarUrl, '头像 URL', AVATAR_URL_MAX_LENGTH);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (nameError || titleError || avatarUrlError) {
      return res.status(400).json({ message: nameError || titleError || avatarUrlError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const member = await familyRecipeService.updateFamilyMemberProfileByDevice(device.deviceId, familyCode, {
      name,
      title,
      avatarUrl
    });

    if (!member) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data: member });
  } catch (error) {
    return next(error);
  }
}

async function leaveFamily(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const member = await familyRecipeService.leaveFamilyByDevice(device.deviceId, familyCode);

    if (!member) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data: member });
  } catch (error) {
    return next(error);
  }
}

async function createFamilyInvite(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const ttlMinutes = Number(req.body.ttlMinutes || req.query.ttlMinutes || 60);
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const invite = await familyService.createFamilyInvite(
      familyCode,
      Number.isFinite(ttlMinutes) ? ttlMinutes : 60
    );

    return res.status(201).json({ data: invite });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createFamily,
  getMyFamilies,
  getFamily,
  updateFamily,
  deleteFamily,
  listFamilyMembers,
  updateMyFamilyMemberProfile,
  leaveFamily,
  createFamilyInvite
};
