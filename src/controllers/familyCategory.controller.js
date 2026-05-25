const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const CATEGORY_ID_MAX_LENGTH = 100;

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

function createFamilyCategoryController(service, categoryFieldName) {
  async function upsertCategory(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const categoryJson = req.body[categoryFieldName] || req.body.categoryJson || req.body.category;
      const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      if (familyCodeError) {
        return res.status(400).json({ message: familyCodeError });
      }

      if (categoryJson === undefined || categoryJson === null) {
        return res.status(400).json({ message: '请填写类别数据' });
      }

      const data = await service.upsertCategoryByDevice(device.deviceId, familyCode, categoryJson);

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

  async function listCategories(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
      const data = await service.listCategoriesByDevice(device.deviceId, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function deleteCategory(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const categoryId = normalizeText(
        getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'categoryId')
      );
      const categoryIdError = validateText(categoryId, '类别 ID', CATEGORY_ID_MAX_LENGTH);
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      if (categoryIdError) {
        return res.status(400).json({ message: categoryIdError });
      }

      const data = await service.deleteCategoryByDevice(device.deviceId, categoryId, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  return {
    upsertCategory,
    listCategories,
    deleteCategory
  };
}

module.exports = {
  createFamilyCategoryController
};
