const deviceService = require('../services/device.service');
const { normalizeText } = require('../utils/request');

const DEVICE_ID_MAX_LENGTH = 100;
const DEVICE_SECRET_MAX_LENGTH = 200;

function validateText(value, fieldName, maxLength, required = false) {
  if (required && !value) {
    return `${fieldName} is required`;
  }

  if (value && value.length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or fewer`;
  }

  return null;
}

async function registerDevice(req, res, next) {
  try {
    const deviceId = normalizeText(req.body.deviceId);
    const deviceSecret = normalizeText(req.body.deviceSecret);
    const deviceIdError = validateText(deviceId, 'deviceId', DEVICE_ID_MAX_LENGTH);
    const secretError = validateText(deviceSecret, 'deviceSecret', DEVICE_SECRET_MAX_LENGTH);

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

    return res.status(201).json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  registerDevice
};
