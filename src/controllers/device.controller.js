const deviceService = require('../services/device.service');
const familyRecipeService = require('../services/familyRecipe.service');
const { normalizeText } = require('../utils/request');

const DEVICE_ID_MAX_LENGTH = 100;
const DEVICE_SECRET_MAX_LENGTH = 200;

function validateText(value, fieldName, maxLength, required = false) {
  if (required && !value) {
    return `请填写${fieldName}`;
  }

  if (value && value.length > maxLength) {
    return `${fieldName}太长了，不能超过 ${maxLength} 个字符`;
  }

  return null;
}

async function registerDevice(req, res, next) {
  try {
    const deviceId = normalizeText(req.body.deviceId);
    const deviceSecret = normalizeText(req.body.deviceSecret);
    const deviceIdError = validateText(deviceId, '设备编号', DEVICE_ID_MAX_LENGTH);
    const secretError = validateText(deviceSecret, '设备密钥', DEVICE_SECRET_MAX_LENGTH);

    if (deviceIdError) {
      return res.status(400).json({ message: deviceIdError });
    }

    if (secretError) {
      return res.status(400).json({ message: secretError });
    }

    const data = await deviceService.registerDevice({
      deviceId: deviceId || undefined,
      deviceSecret: deviceSecret || undefined
    });
    const familySummary = await familyRecipeService.getFamilySummaryByDevice(data.device.deviceId);

    return res.status(201).json({
      data: {
        ...data,
        familyCodeList: familySummary.familyCodeList,
        homeFamilyCode: familySummary.homeFamilyCode,
        families: familySummary.families
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerDevice
};
