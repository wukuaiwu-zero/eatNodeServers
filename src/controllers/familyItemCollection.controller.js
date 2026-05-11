const FAMILY_CODE_MAX_LENGTH = 100;
const MEMBER_CODE_MAX_LENGTH = 100;
const ITEM_ID_MAX_LENGTH = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
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
      const memberCode = normalizeText(req.body.memberCode);
      const familyCode = normalizeText(req.body.familyCode || req.body.family_id);
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
      if (error instanceof SyntaxError) {
        return res.status(400).json({ message: `${itemFieldName} must be valid JSON` });
      }

      if (error instanceof TypeError) {
        return res.status(400).json({ message: error.message });
      }

      return next(error);
    }
  }

  async function listItemsByMember(req, res, next) {
    try {
      const memberCode = normalizeText(req.params.memberCode);
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
      const memberCode = normalizeText(req.params.memberCode);
      const memberCodeError = validateText(memberCode, 'memberCode', MEMBER_CODE_MAX_LENGTH);

      if (memberCodeError) {
        return res.status(400).json({ message: memberCodeError });
      }

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
      const memberCode = normalizeText(req.body.memberCode || req.query.memberCode);
      const itemId = normalizeText(req.params.itemId);
      const memberCodeError = validateText(memberCode, 'memberCode', MEMBER_CODE_MAX_LENGTH);
      const itemIdError = validateText(itemId, 'itemId', ITEM_ID_MAX_LENGTH);

      if (memberCodeError) {
        return res.status(400).json({ message: memberCodeError });
      }

      if (itemIdError) {
        return res.status(400).json({ message: itemIdError });
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
    listItemsByMember,
    getChangesByMember,
    deleteItem
  };
}

module.exports = {
  createFamilyItemCollectionController
};
