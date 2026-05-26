const deviceService = require('../services/device.service');
const familyConsumptionService = require('../services/familyConsumption.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const RECORD_ID_MAX_LENGTH = 100;

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

function getRecordJson(req) {
  return req.body.consumptionRecordJson
    || req.body.consumptionJson
    || req.body.recordJson
    || req.body.record
    || req.body;
}

async function upsertRecord(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const recordJson = getRecordJson(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (recordJson === undefined || recordJson === null) {
      return res.status(400).json({ message: '请填写消费记录数据' });
    }

    const data = await familyConsumptionService.upsertRecordByDevice(
      device.deviceId,
      familyCode,
      recordJson
    );

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '消费记录数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getRecord(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const recordId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'recordId'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const recordIdError = validateText(recordId, '消费记录 ID', RECORD_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || recordIdError) {
      return res.status(400).json({ message: familyCodeError || recordIdError });
    }

    const data = await familyConsumptionService.getRecordByDevice(device.deviceId, familyCode, recordId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    if (!data.record || data.record.deleted) {
      return res.status(404).json({ message: '消费记录不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function listRecords(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyConsumptionService.listRecordsByDevice(device.deviceId, {
      familyCode,
      categoryId: getInput(req, 'categoryId') || getInput(req, 'category_id'),
      startTime: getInput(req, 'startTime') || getInput(req, 'start_time'),
      endTime: getInput(req, 'endTime') || getInput(req, 'end_time')
    });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function deleteRecord(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const recordId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'recordId'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const recordIdError = validateText(recordId, '消费记录 ID', RECORD_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || recordIdError) {
      return res.status(400).json({ message: familyCodeError || recordIdError });
    }

    const data = await familyConsumptionService.deleteRecordByDevice(device.deviceId, familyCode, recordId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertRecord,
  getRecord,
  listRecords,
  deleteRecord
};
