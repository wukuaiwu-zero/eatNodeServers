const familyRecipeService = require('../services/familyRecipe.service');
const familyService = require('../services/family.service');
const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;

function normalizeFamilyCode(familyCode) {
  return typeof familyCode === 'string' ? familyCode.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
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

async function uploadFamilyRecipe(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (req.body.recipeJson === undefined || req.body.recipeJson === null) {
      return res.status(400).json({ message: '请填写家庭菜谱数据' });
    }

    const data = await familyRecipeService.upsertFamilyRecipeByDevice(
      device.deviceId,
      familyCode,
      req.body.recipeJson
    );
    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '菜谱数据格式不正确' });
    }

    return next(error);
  }
}

async function joinFamily(req, res, next) {
  try {
    const inviteCode = normalizeFamilyCode(getInput(req, 'inviteCode') || getInput(req, 'invitecode'));
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (!inviteCode) {
      return res.status(400).json({ message: '请输入邀请码' });
    }

    const member = await familyRecipeService.joinFamilyByInvite(device.deviceId, inviteCode);
    return res.json({ data: member });
  } catch (error) {
    return next(error);
  }
}

async function getFamilyRecipeByMember(req, res, next) {
  try {
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    const data = await familyRecipeService.getFamilyRecipeByDevice(device.deviceId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    if (!data.recipe) {
      return res.status(404).json({ message: '家庭菜谱不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function getFamilyRecipe(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const recipe = await familyRecipeService.getFamilyRecipeByCode(familyCode);

    if (!recipe) {
      return res.status(404).json({ message: '家庭菜谱不存在' });
    }

    return res.json({ data: recipe });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadFamilyRecipe,
  joinFamily,
  getFamilyRecipeByMember,
  getFamilyRecipe
};
