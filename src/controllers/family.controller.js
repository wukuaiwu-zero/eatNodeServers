const familyService = require('../services/family.service');
const familyRecipeService = require('../services/familyRecipe.service');
const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const FAMILY_NAME_MAX_LENGTH = 100;

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
    return 'familyCode is required';
  }

  if (familyCode.length > FAMILY_CODE_MAX_LENGTH) {
    return `familyCode must be ${FAMILY_CODE_MAX_LENGTH} characters or fewer`;
  }

  return null;
}

function validateFamilyName(familyName) {
  if (familyName && familyName.length > FAMILY_NAME_MAX_LENGTH) {
    return `familyName must be ${FAMILY_NAME_MAX_LENGTH} characters or fewer`;
  }

  return null;
}

async function createFamily(req, res, next) {
  try {
    const familyName = normalizeNullableText(req.body.familyName);
    const familyNameError = validateFamilyName(familyName);

    if (familyNameError) {
      return res.status(400).json({ message: familyNameError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const data = await familyService.createFamilyForDevice(device.deviceId, familyName);
    const member = await familyRecipeService.bindDeviceToFamily(device.deviceId, data.family.familyCode, 'owner');
    const invite = await familyService.createFamilyInvite(data.family.familyCode);

    return res.status(201).json({
      data: {
        ...data,
        member,
        invite
      }
    });
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
      return res.status(404).json({ message: 'Family not found' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function updateFamily(req, res, next) {
  try {
    const familyCode = normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyName = normalizeNullableText(req.body.familyName);
    const familyCodeError = validateFamilyCode(familyCode);
    const familyNameError = validateFamilyName(familyName);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (familyNameError) {
      return res.status(400).json({ message: familyNameError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const family = await familyService.updateFamily(familyCode, familyName);

    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
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
      return res.status(404).json({ message: 'Family not found' });
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
      return res.status(404).json({ message: 'Family not found' });
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
  getFamily,
  updateFamily,
  deleteFamily,
  listFamilyMembers,
  createFamilyInvite
};
