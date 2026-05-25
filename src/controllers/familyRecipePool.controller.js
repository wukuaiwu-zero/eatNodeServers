const deviceService = require('../services/device.service');
const familyRecipePoolService = require('../services/familyRecipePool.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const DISH_ID_MAX_LENGTH = 100;

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

async function upsertDish(req, res, next) {
  try {
    const familyCode = normalizeText(
      getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
    );
    const dishJson = req.body.dishJson || req.body.recipePoolItemJson || req.body.dish;
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (dishJson === undefined || dishJson === null) {
      return res.status(400).json({ message: '请填写菜品数据' });
    }

    const data = await familyRecipePoolService.upsertDishByDevice(device.deviceId, familyCode, dishJson);

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '菜品数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function listDishes(req, res, next) {
  try {
    const familyCode = normalizeText(
      getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
    );
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const data = await familyRecipePoolService.listDishesByDevice(device.deviceId, { familyCode });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function deleteDish(req, res, next) {
  try {
    const familyCode = normalizeText(
      getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
    );
    const dishId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'dishId'));
    const dishIdError = validateText(dishId, '菜品 ID', DISH_ID_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (dishIdError) {
      return res.status(400).json({ message: dishIdError });
    }

    const data = await familyRecipePoolService.deleteDishByDevice(device.deviceId, dishId, { familyCode });

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  upsertDish,
  listDishes,
  deleteDish
};
