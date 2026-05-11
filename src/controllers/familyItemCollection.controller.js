const FAMILY_CODE_MAX_LENGTH = 100;
const MEMBER_CODE_MAX_LENGTH = 100;
const ITEM_ID_MAX_LENGTH = 100;

// 购物清单和食材库的 HTTP 层非常像：
// - 校验 memberCode/familyCode/itemId
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
    return `${fieldName} is required`;
  }

  if (value.length > maxLength) {
    return `${fieldName} must be ${maxLength} characters or fewer`;
  }

  return null;
}

function createFamilyItemCollectionController(service, itemFieldName) {
  async function upsertItem(req, res, next) {
    try {
      const memberCode = normalizeText(getInput(req, 'memberCode') || getInput(req, 'membercode'));
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      // itemFieldName 是业务专属字段：
      // - shoppingItemJson：购物清单
      // - ingredientItemJson：食材库
      // 同时兼容 itemJson/item，是为了调试和未来通用客户端更方便。
      const itemJson = req.body[itemFieldName] || req.body.itemJson || req.body.item;
      const memberCodeError = validateText(memberCode, 'memberCode', MEMBER_CODE_MAX_LENGTH);
      const familyCodeError = validateText(familyCode, 'familyCode', FAMILY_CODE_MAX_LENGTH);

      if (memberCodeError) {
        return res.status(400).json({ message: memberCodeError });
      }

      if (familyCodeError) {
        return res.status(400).json({ message: familyCodeError });
      }

      if (itemJson === undefined || itemJson === null) {
        return res.status(400).json({ message: `${itemFieldName} is required` });
      }

      const data = await service.upsertItemByMember(memberCode, familyCode, itemJson);
      return res.json({ data });
    } catch (error) {
      // JSON 字符串解析失败，说明请求体里的 item 不是合法 JSON。
      if (error instanceof SyntaxError) {
        return res.status(400).json({ message: `${itemFieldName} must be valid JSON` });
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
      const memberCode = normalizeText(getInput(req, 'memberCode') || getInput(req, 'membercode'));
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const itemId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'itemId'));
      const itemIdError = validateText(itemId, 'itemId', ITEM_ID_MAX_LENGTH);

      if (itemIdError) {
        return res.status(400).json({ message: itemIdError });
      }

      if (memberCode) {
        const data = await service.getItemByMember(memberCode, itemId);

        if (!data) {
          return res.status(404).json({ message: 'Family member not found' });
        }

        if (!data.item || data.item.deleted) {
          return res.status(404).json({ message: 'item not found' });
        }

        return res.json({ data });
      }

      const familyCodeError = validateText(familyCode, 'familyCode', FAMILY_CODE_MAX_LENGTH);

      if (familyCodeError) {
        return res.status(400).json({ message: familyCodeError });
      }

      const item = await service.getItemByFamily(familyCode, itemId);

      if (!item || item.deleted) {
        return res.status(404).json({ message: 'item not found' });
      }

      return res.json({ data: item });
    } catch (error) {
      return next(error);
    }
  }

  async function listItemsByMember(req, res, next) {
    try {
      const memberCode = normalizeText(getInput(req, 'memberCode') || getInput(req, 'membercode'));
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );

      if (familyCode) {
        const items = await service.listItemsByFamily(familyCode);
        return res.json({ data: { familyCode, items } });
      }

      const memberCodeError = validateText(memberCode, 'memberCode', MEMBER_CODE_MAX_LENGTH);
      if (memberCodeError) {
        return res.status(400).json({ message: memberCodeError });
      }

      const data = await service.listItemsByMember(memberCode);

      if (!data) {
        return res.status(404).json({ message: 'Family member not found' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function getChangesByMember(req, res, next) {
    try {
      const memberCode = normalizeText(getInput(req, 'memberCode') || getInput(req, 'membercode'));
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );

      if (familyCode) {
        const data = await service.getChangesByFamily(familyCode, req.query.since);
        return res.json({ data });
      }

      const memberCodeError = validateText(memberCode, 'memberCode', MEMBER_CODE_MAX_LENGTH);
      if (memberCodeError) {
        return res.status(400).json({ message: memberCodeError });
      }

      // since 是客户端上次同步到的服务端时间戳。
      // service 会返回之后发生变化的条目，包括已软删除的条目。
      const data = await service.getChangesByMember(memberCode, req.query.since);

      if (!data) {
        return res.status(404).json({ message: 'Family member not found' });
      }

      return res.json({ data });
    } catch (error) {
      return next(error);
    }
  }

  async function deleteItem(req, res, next) {
    try {
      // DELETE 请求有些客户端不方便带 body，所以这里同时支持 body 和 query。
      const memberCode = normalizeText(getInput(req, 'memberCode') || getInput(req, 'membercode'));
      const familyCode = normalizeText(
        getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_id')
      );
      const itemId = normalizeText(getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'itemId'));
      const itemIdError = validateText(itemId, 'itemId', ITEM_ID_MAX_LENGTH);

      if (itemIdError) {
        return res.status(400).json({ message: itemIdError });
      }

      if (familyCode) {
        const item = await service.deleteItemByFamily(familyCode, itemId, memberCode || null);

        if (!item) {
          return res.status(404).json({ message: 'item not found' });
        }

        return res.json({ data: item });
      }

      const memberCodeError = validateText(memberCode, 'memberCode', MEMBER_CODE_MAX_LENGTH);

      if (memberCodeError) {
        return res.status(400).json({ message: memberCodeError });
      }

      const data = await service.deleteItemByMember(memberCode, itemId);

      if (!data) {
        return res.status(404).json({ message: 'Family member not found' });
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
    deleteItem
  };
}

module.exports = {
  createFamilyItemCollectionController
};
