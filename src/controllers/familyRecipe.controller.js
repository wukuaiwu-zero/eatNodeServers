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
    return 'familyCode is required';
  }

  if (familyCode.length > FAMILY_CODE_MAX_LENGTH) {
    return `familyCode must be ${FAMILY_CODE_MAX_LENGTH} characters or fewer`;
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
      return res.status(400).json({ message: 'recipeJson is required' });
    }

    const data = await familyRecipeService.upsertFamilyRecipeByDevice(
      device.deviceId,
      familyCode,
      req.body.recipeJson
    );
    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: 'recipeJson must be valid JSON' });
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
      return res.status(400).json({ message: 'inviteCode is required' });
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
      return res.status(404).json({ message: 'Family member not found' });
    }

    if (!data.recipe) {
      return res.status(404).json({ message: 'Family recipe not found' });
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
      return res.status(404).json({ message: 'Family recipe not found' });
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
