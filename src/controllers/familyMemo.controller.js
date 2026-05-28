const deviceService = require('../services/device.service');
const familyMemoService = require('../services/familyMemo.service');
const { getDeviceCredentials } = require('../utils/request');
const { paginateDataList } = require('../utils/pagination');

const FAMILY_CODE_MAX_LENGTH = 100;
const MEMO_ID_MAX_LENGTH = 100;

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

function getMemoJson(req) {
  return req.body.memoJson
    || req.body.familyMemoJson
    || req.body.memo
    || req.body;
}

async function upsertMemo(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const memoJson = getMemoJson(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (memoJson === undefined || memoJson === null) {
      return res.status(400).json({ message: '请填写备忘录数据' });
    }

    const data = await familyMemoService.upsertMemoByDevice(
      device.deviceId,
      familyCode,
      memoJson
    );

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '备忘录数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getMemo(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const memoId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'memoId'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const memoIdError = validateText(memoId, '备忘录 ID', MEMO_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || memoIdError) {
      return res.status(400).json({ message: familyCodeError || memoIdError });
    }

    const data = await familyMemoService.getMemoByDevice(device.deviceId, familyCode, memoId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    if (!data.memo || data.memo.deleted) {
      return res.status(404).json({ message: '备忘录不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function listMemos(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMemoService.listMemosByDevice(device.deviceId, { familyCode });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data: paginateDataList(req, data, 'memos') });
  } catch (error) {
    return next(error);
  }
}

async function deleteMemo(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const memoId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'memoId'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const memoIdError = validateText(memoId, '备忘录 ID', MEMO_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || memoIdError) {
      return res.status(400).json({ message: familyCodeError || memoIdError });
    }

    const data = await familyMemoService.deleteMemoByDevice(device.deviceId, familyCode, memoId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertMemo,
  getMemo,
  listMemos,
  deleteMemo
};
