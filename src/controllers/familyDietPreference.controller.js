const deviceService = require('../services/device.service');
const familyDietPreferenceService = require('../services/familyDietPreference.service');
const { getDeviceCredentials } = require('../utils/request');
const { paginateDataList } = require('../utils/pagination');

const FAMILY_CODE_MAX_LENGTH = 100;
const PREFERENCE_ID_MAX_LENGTH = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
}

function validateText(value, fieldName, maxLength) {
  if (!value) {
    return `请填写${fieldName}`;
  }

  if (value.length > maxLength) {
    return `${fieldName}太长了，不能超过 ${maxLength} 个字符`;
  }

  return null;
}

function getFamilyCode(req) {
  return normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_code'));
}

function getPreferenceJson(req) {
  return req.body.dietPreferenceJson
    || req.body.preferenceJson
    || req.body.preference
    || req.body;
}

async function upsertPreference(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const preferenceJson = getPreferenceJson(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyDietPreferenceService.upsertPreferenceByDevice(
      device.deviceId,
      familyCode,
      preferenceJson
    );

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '饮食偏好数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getPreference(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const preferenceId = normalizeText(
      getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'preferenceId')
    );
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const preferenceIdError = validateText(preferenceId, '饮食偏好 ID', PREFERENCE_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || preferenceIdError) {
      return res.status(400).json({ message: familyCodeError || preferenceIdError });
    }

    const data = await familyDietPreferenceService.getPreferenceByDevice(
      device.deviceId,
      familyCode,
      preferenceId
    );

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    if (!data.preference || data.preference.deleted) {
      return res.status(404).json({ message: '饮食偏好不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function listPreferences(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyDietPreferenceService.listPreferencesByDevice(device.deviceId, {
      familyCode,
      preferenceType: getInput(req, 'preferenceType') || getInput(req, 'preference_type') || getInput(req, 'type')
    });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data: paginateDataList(req, data, 'preferences') });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function deletePreference(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const preferenceId = normalizeText(
      getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'preferenceId')
    );
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const preferenceIdError = validateText(preferenceId, '饮食偏好 ID', PREFERENCE_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || preferenceIdError) {
      return res.status(400).json({ message: familyCodeError || preferenceIdError });
    }

    const data = await familyDietPreferenceService.deletePreferenceByDevice(
      device.deviceId,
      familyCode,
      preferenceId
    );

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertPreference,
  getPreference,
  listPreferences,
  deletePreference
};
