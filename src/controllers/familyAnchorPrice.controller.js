const deviceService = require('../services/device.service');
const familyAnchorPriceService = require('../services/familyAnchorPrice.service');
const { getDeviceCredentials } = require('../utils/request');
const { paginateDataList } = require('../utils/pagination');

const FAMILY_CODE_MAX_LENGTH = 100;
const ANCHOR_ID_MAX_LENGTH = 64;

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

function getAnchorJson(req) {
  if (req.body?.anchorPriceJson || req.body?.anchorJson || req.body?.anchor) {
    return req.body.anchorPriceJson || req.body.anchorJson || req.body.anchor;
  }

  if (req.body?.name !== undefined || req.body?.anchorPrice !== undefined || req.body?.anchor_price !== undefined) {
    return {
      id: req.body.id || req.body._id || req.body.anchorId,
      name: req.body.name,
      tag: req.body.tag ?? req.body.channel ?? req.body.brand,
      anchorPrice: req.body.anchorPrice ?? req.body.anchor_price ?? req.body.price
    };
  }

  return undefined;
}

function hasTagInput(req) {
  const value = getInput(req, 'tag') ?? getInput(req, 'channel') ?? getInput(req, 'brand');
  return value !== undefined && value !== null;
}

async function upsertAnchor(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const anchorJson = getAnchorJson(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (anchorJson === undefined || anchorJson === null) {
      return res.status(400).json({ message: '请填写锚定价格数据' });
    }

    const data = await familyAnchorPriceService.saveAnchorByDevice(
      device.deviceId,
      familyCode,
      anchorJson
    );

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '锚定价格数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getAnchor(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const anchorId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'anchorId'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const anchorIdError = validateText(anchorId, '锚定价格 ID', ANCHOR_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || anchorIdError) {
      return res.status(400).json({ message: familyCodeError || anchorIdError });
    }

    const data = await familyAnchorPriceService.getAnchorByDevice(device.deviceId, familyCode, anchorId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    if (!data.anchor || data.anchor.deleted) {
      return res.status(404).json({ message: '锚定价格不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function listAnchors(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyAnchorPriceService.listAnchorsByDevice(device.deviceId, {
      familyCode,
      name: getInput(req, 'name')
    });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data: paginateDataList(req, data, 'anchors') });
  } catch (error) {
    return next(error);
  }
}

async function matchAnchor(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const name = normalizeText(getInput(req, 'name'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const nameError = validateText(name, '物件名称', 100);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || nameError) {
      return res.status(400).json({ message: familyCodeError || nameError });
    }

    const data = await familyAnchorPriceService.matchAnchorByDevice(
      device.deviceId,
      familyCode,
      name,
      getInput(req, 'tag') ?? getInput(req, 'channel') ?? getInput(req, 'brand'),
      hasTagInput(req)
    );

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function getChanges(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyAnchorPriceService.getChangesByDevice(device.deviceId, req.query.since, {
      familyCode
    });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function deleteAnchor(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const anchorId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'anchorId'));
    const name = normalizeText(getInput(req, 'name'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (!anchorId && !name) {
      return res.status(400).json({ message: '请填写锚定价格 ID 或物件名称' });
    }

    if (anchorId && anchorId.length > ANCHOR_ID_MAX_LENGTH) {
      return res.status(400).json({ message: `锚定价格 ID 太长了，不能超过 ${ANCHOR_ID_MAX_LENGTH} 个字符` });
    }

    if (name && name.length > 100) {
      return res.status(400).json({ message: '物件名称太长了，不能超过 100 个字符' });
    }

    const data = await familyAnchorPriceService.deleteAnchorByDevice(device.deviceId, familyCode, {
      anchorId,
      name,
      tag: hasTagInput(req) ? getInput(req, 'tag') ?? getInput(req, 'channel') ?? getInput(req, 'brand') : ''
    });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertAnchor,
  getAnchor,
  listAnchors,
  matchAnchor,
  getChanges,
  deleteAnchor
};
