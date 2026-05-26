const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');
const { paginateDataList } = require('../utils/pagination');

const FAMILY_CODE_MAX_LENGTH = 100;
const ITEM_ID_MAX_LENGTH = 100;

// 购物清单和食材库的 HTTP 层非常像：
// - 校验设备凭证/familyCode/itemId
// - 从请求体里取对应的 item JSON
// - 调 service 完成真实读写
// 所以这里做成 controller 工厂，由不同业务传入不同 service 和字段名。

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

function parseItemIds(req) {
  const value = getInput(req, 'ids') || getInput(req, 'itemIds');

  if (Array.isArray(value)) {
    return value.map((itemId) => normalizeText(String(itemId))).filter(Boolean);
  }

  if (typeof value === 'string') {
    return value.split(',').map(normalizeText).filter(Boolean);
  }

  return [];
}

function getItemLabel(itemFieldName) {
  if (itemFieldName === 'shoppingItemJson') {
    return '购物清单条目';
  }

  if (itemFieldName === 'ingredientItemJson') {
    return '食材库条目';
  }

  return '条目';
}

function createFamilyItemCollectionController(service, itemFieldName) {
  const itemLabel = getItemLabel(itemFieldName);

  async function upsertItem(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      // itemFieldName 是业务专属字段：
      // - shoppingItemJson：购物清单
      // - ingredientItemJson：食材库
      // 同时兼容 itemJson/item，是为了调试和未来通用客户端更方便。
      const itemJson = req.body[itemFieldName] || req.body.itemJson || req.body.item;
      const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      if (familyCodeError) {
        return res.status(400).json({ message: familyCodeError });
      }

      if (itemJson === undefined || itemJson === null) {
        return res.status(400).json({ message: `请填写${itemLabel}数据` });
      }

      const data = await service.upsertItemByDevice(device.deviceId, familyCode, itemJson);

      if (!data) {
        return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
      }

      return res.json({ data });
    } catch (error) {
      // JSON 字符串解析失败，说明请求体里的 item 不是合法 JSON。
      if (error instanceof SyntaxError) {
        return res.status(400).json({ message: `${itemLabel}数据格式不正确` });
      }

      // TypeError 主要来自业务校验，比如 item 不是对象、缺少 id。
      if (error instanceof TypeError) {
        return res.status(400).json({ message: error.message });
      }

      return next(error);
    }
  }

  async function getItem(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const itemId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'itemId'));
      const itemIdError = validateText(itemId, '条目 ID', ITEM_ID_MAX_LENGTH);
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      if (itemIdError) {
        return res.status(400).json({ message: itemIdError });
      }

      const data = await service.getItemByDevice(device.deviceId, itemId, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      if (!data.item || data.item.deleted) {
        return res.status(404).json({ message: '条目不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function listItemsByMember(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      const data = await service.listItemsByDevice(device.deviceId, {
        familyCode,
        categoryId: getInput(req, 'categoryId') || getInput(req, 'category_id')
      });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data: paginateDataList(req, data, 'items') });
    } catch (error) {
      return next(error);
    }
  }

  async function getChangesByMember(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      // since 是客户端上次同步到的服务端时间戳。
      // service 会返回之后发生变化的条目，包括已软删除的条目。
      const data = await service.getChangesByDevice(device.deviceId, req.query.since, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function deleteItem(req, res, next) {
    try {
      // DELETE 请求有些客户端不方便带 body，所以这里同时支持 body 和 query。
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const itemId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'itemId'));
      const itemIdError = validateText(itemId, '条目 ID', ITEM_ID_MAX_LENGTH);
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      if (itemIdError) {
        return res.status(400).json({ message: itemIdError });
      }

      const data = await service.deleteItemByDevice(device.deviceId, itemId, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function deleteItems(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const itemIds = parseItemIds(req);
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

      if (itemIds.length === 0) {
        return res.status(400).json({ message: '请填写条目 ID 列表' });
      }

      if (itemIds.some((itemId) => itemId.length > ITEM_ID_MAX_LENGTH)) {
        return res.status(400).json({ message: `条目 ID 太长了，不能超过 ${ITEM_ID_MAX_LENGTH} 个字符` });
      }

      const data = await service.deleteItemsByDevice(device.deviceId, itemIds, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function clearExpiredItems(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
      const data = await service.clearExpiredItemsByDevice(device.deviceId, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function clearPurchasedItems(req, res, next) {
    try {
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const { deviceId, deviceSecret } = getDeviceCredentials(req);
      const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
      const data = await service.clearPurchasedItemsByDevice(device.deviceId, { familyCode });

      if (!data) {
        return res.status(404).json({ message: '家庭成员不存在' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  return {
    upsertItem,
    getItem,
    listItemsByMember,
    getChangesByMember,
    deleteItem,
    deleteItems,
    clearExpiredItems,
    clearPurchasedItems
  };
}

module.exports = {
  createFamilyItemCollectionController
};
