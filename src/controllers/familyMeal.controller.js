const deviceService = require('../services/device.service');
const familyMealService = require('../services/familyMeal.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;

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
      getInput(req, 'done')
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return res.json({ data });
  } catch (error) {
    return handleInputError(error, res, next, '单餐状态参数格式不正确');
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
  listCommon,
  addCommon,
  removeCommon,
  listTemp,
  addTemp,
  removeTemp
};
