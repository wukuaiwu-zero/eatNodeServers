const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const deviceService = require('../services/device.service');
const familyMealService = require('../services/familyMeal.service');
const familyRecipeService = require('../services/familyRecipe.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const MAX_DIET_PHOTO_BYTES = 4 * 1024 * 1024;
const DIET_PHOTO_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/diet-photos');
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

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

function getMealName(req) {
  return getInput(req, 'mealName') || getInput(req, 'meal_name');
}

function getRecipeName(req) {
  return getInput(req, 'recipeName') || getInput(req, 'recipe_name');
}

function getRecordInput(req) {
  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'record')) {
    return req.body.record;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'recordJson')) {
    return req.body.recordJson;
  }

  if (Object.prototype.hasOwnProperty.call(req.body || {}, 'record_json')) {
    return req.body.record_json;
  }

  return undefined;
}

function normalizeImageInput(req) {
  const raw = getInput(req, 'imageBase64') || getInput(req, 'imageData') || getInput(req, 'photoImage');

  if (!raw || typeof raw !== 'string') {
    throw new TypeError('请上传饮食照片');
  }

  const dataUrlMatch = raw.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : normalizeText(getInput(req, 'mimeType'));
  const base64 = dataUrlMatch ? dataUrlMatch[2] : raw;
  const ext = IMAGE_TYPES[mimeType];

  if (!ext) {
    throw new TypeError('饮食照片格式不支持');
  }

  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw new TypeError('饮食照片不能为空');
  }

  if (buffer.length > MAX_DIET_PHOTO_BYTES) {
    throw new TypeError('饮食照片不能超过 4MB');
  }

  return { buffer, ext };
}

function saveDietPhoto(familyCode, image) {
  const familyDir = path.join(DIET_PHOTO_UPLOAD_DIR, familyCode);
  fs.mkdirSync(familyDir, { recursive: true });

  const fileStem = `${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}`;
  const filename = `${fileStem}.${image.ext}`;
  const filePath = path.join(familyDir, filename);
  fs.writeFileSync(filePath, image.buffer);

  return {
    photoUrl: `/uploads/diet-photos/${familyCode}/${filename}`
  };
}

async function authenticate(req) {
  const { deviceId, deviceSecret } = getDeviceCredentials(req);
  return deviceService.authenticateDevice(deviceId, deviceSecret);
}

function sendMemberMissing(res) {
  return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
}

function handleInputError(error, res, next, fallbackMessage) {
  if (error instanceof SyntaxError) {
    return res.status(400).json({ message: fallbackMessage });
  }

  if (error instanceof TypeError) {
    return res.status(400).json({ message: error.message });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ message: error.message });
  }

  return next(error);
}

async function getPlan(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const date = getInput(req, 'date');
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.listPlanByDevice(device.deviceId, familyCode, date);

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '三餐计划参数格式不正确');
  }
}

async function savePlan(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const date = getInput(req, 'date');
    const meals = getInput(req, 'meals');
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.savePlanByDevice(device.deviceId, familyCode, date, meals);

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '三餐数组格式不正确');
  }
}

async function updatePlanStatus(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.updateMealStatusByDevice(
      device.deviceId,
      familyCode,
      getInput(req, 'date'),
      getMealName(req),
      getInput(req, 'done'),
      getRecordInput(req)
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '单餐状态参数格式不正确');
  }
}

async function getDiary(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.listDiaryByDevice(
      device.deviceId,
      familyCode,
      getInput(req, 'startDate') || getInput(req, 'start_date'),
      getInput(req, 'endDate') || getInput(req, 'end_date')
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '饮食日记参数格式不正确');
  }
}

async function uploadDietPhoto(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const member = await familyRecipeService.getFamilyMemberByDevice(device.deviceId, familyCode);
    if (!member) {
      return sendMemberMissing(res);
    }

    const image = normalizeImageInput(req);
    const imageUrls = saveDietPhoto(member.familyCode, image);

    return res.json({
      data: {
        familyCode: member.familyCode,
        family_code: member.familyCode,
        ...imageUrls
      }
    });
  } catch (error) {
    return handleInputError(error, res, next, '饮食照片参数格式不正确');
  }
}

async function listCommon(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.listCommonByDevice(device.deviceId, familyCode);

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function addCommon(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.addCommonByDevice(
      device.deviceId,
      familyCode,
      getMealName(req),
      getRecipeName(req)
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '常用菜单参数格式不正确');
  }
}

async function removeCommon(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.removeCommonByDevice(
      device.deviceId,
      familyCode,
      getMealName(req),
      getRecipeName(req)
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '常用菜单参数格式不正确');
  }
}

async function listTemp(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.listTempByDevice(device.deviceId, familyCode, getInput(req, 'date'));

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '临时菜品参数格式不正确');
  }
}

async function addTemp(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.addTempByDevice(
      device.deviceId,
      familyCode,
      getInput(req, 'date'),
      getMealName(req),
      getRecipeName(req)
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '临时菜品参数格式不正确');
  }
}

async function removeTemp(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const device = await authenticate(req);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familyMealService.removeTempByDevice(
      device.deviceId,
      familyCode,
      getInput(req, 'date'),
      getMealName(req),
      getRecipeName(req)
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '临时菜品参数格式不正确');
  }
}

module.exports = {
  getPlan,
  savePlan,
  updatePlanStatus,
  getDiary,
  uploadDietPhoto,
  listCommon,
  addCommon,
  removeCommon,
  listTemp,
  addTemp,
  removeTemp
};
