const familyCategorySyncService = require('../services/familyCategorySync.service');
const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
}

function validateFamilyCode(familyCode) {
  if (!familyCode) {
    return '请填写家庭码';
  }

  if (familyCode.length > FAMILY_CODE_MAX_LENGTH) {
    return `家庭码太长了，不能超过 ${FAMILY_CODE_MAX_LENGTH} 个字符`;
  }

  return null;
}

async function saveCategory(req, res, next) {
  try {
    const familyCode = normalizeText(
      getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
    );
    const categoryType = normalizeText(
      getInput(req, 'categoryType') || getInput(req, 'type') || getInput(req, 'categoryKind')
    );
    const categoryJson = req.body.categoryJson || req.body.category;
    const familyCodeError = validateFamilyCode(familyCode);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (!categoryType) {
      return res.status(400).json({ message: '请填写分类类型' });
    }

    if (categoryJson === undefined || categoryJson === null) {
      return res.status(400).json({ message: '请填写类别数据' });
    }

    const data = await familyCategorySyncService.saveCategoryByDevice(
      device.deviceId,
      familyCode,
      categoryType,
      categoryJson,
      {
        syncToIngredient: req.body.syncToIngredient === true || req.body.syncToIngredientCategory === true,
        syncToShopping: req.body.syncToShopping === true || req.body.syncToShoppingCategory === true
      }
    );

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '类别数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

module.exports = {
  saveCategory
};
