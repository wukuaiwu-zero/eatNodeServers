const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createItemId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeBoolean(value, defaultValue = false) {
  if (typeof value === 'boolean') {
    return value;
  }

  if (typeof value === 'number') {
    return value === 1;
  }

  if (typeof value === 'string') {
    return ['true', '1', 'yes'].includes(value.trim().toLowerCase());
  }

  return defaultValue;
}

function normalizeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString().slice(0, 10);
}

function normalizeTimeValue(value) {
  if (value instanceof Date) {
    return value.toISOString();
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return new Date(value).toISOString();
  }

  if (typeof value === 'string') {
    const text = value.trim();
    const numeric = Number(text);

    if (Number.isFinite(numeric) && text) {
      return new Date(numeric).toISOString();
    }

    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) {
      return new Date(parsed).toISOString();
    }
  }

  return null;
}

function normalizeRawItem(itemJson) {
  if (itemJson === undefined || itemJson === null) {
    throw new TypeError('请填写条目数据');
  }

  const item = typeof itemJson === 'string' ? JSON.parse(itemJson) : { ...itemJson };

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError('条目数据格式不正确');
  }

  return item;
}

function normalizeItem(itemJson, familyCode, itemType) {
  const item = normalizeRawItem(itemJson);
  const itemId = String(item.id || item._id || item.itemId || createItemId()).trim();

  if (!itemId) {
    throw new TypeError('条目 id 不能为空');
  }

  const name = normalizeText(item.name);

  if (!name) {
    throw new TypeError('条目名称不能为空');
  }

  const createTime = Number(item.create_time || item.createTime || Date.now());
  const normalized = {
    itemId,
    familyCode,
    name,
    quantity: normalizeNullableText(item.quantity ?? item.num),
    categoryId: normalizeNullableText(item.categoryId ?? item.category_id),
    price: normalizeNullableText(item.price),
    createTime: Number.isFinite(createTime) ? createTime : Date.now()
  };

  if (itemType === 'shopping') {
    return {
      ...normalized,
      done: normalizeBoolean(item.done, false)
    };
  }

  return {
    ...normalized,
    hasStock: normalizeBoolean(item.hasStock ?? item.has_stock ?? item.has, true),
    expireDate: normalizeDate(item.expire_date ?? item.expireDate ?? item.expirationDate)
  };
}

function toItem(row, itemType, categoryName = null) {
  if (!row) {
    return null;
  }

  const createTime = normalizeTimeValue(row.create_time);
  const base = {
    id: row.item_id,
    _id: row.item_id,
    itemId: row.item_id,
    family_id: row.family_code,
    familyCode: row.family_code,
    name: row.name,
    quantity: row.quantity,
    num: row.quantity,
    categoryId: row.category_id,
    category_id: row.category_id,
    categoryName: categoryName || row.category_name || null,
    category_name: categoryName || row.category_name || null,
    price: row.price,
    create_time: createTime,
    createTime,
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at
  };

  if (itemType === 'shopping') {
    return {
      ...base,
      done: Boolean(row.done)
    };
  }

  return {
    ...base,
    has: Boolean(row.has_stock),
    hasStock: Boolean(row.has_stock),
    has_stock: Boolean(row.has_stock),
    expire_date: row.expire_date,
    expireDate: row.expire_date
  };
}

function createFamilyItemCollectionService({ tableName, itemType }) {
  const mockItems = new Map();

  function getMockKey(familyCode, itemId) {
    return `${familyCode}:${itemId}`;
  }

  async function getCategoryNameMapForMock(familyCode) {
    const map = new Map();
    try {
      const categoryService = itemType === 'shopping'
        ? require('./familyShoppingCategory.service')
        : require('./familyIngredientCategory.service');
      const categories = await categoryService.listCategoriesByFamily(familyCode);
      for (const cat of categories) {
        map.set(cat.categoryId, cat.name);
      }
    } catch (e) {
      // Ignore or log error
    }
    return map;
  }

  async function getCategoryNameForMock(familyCode, categoryId) {
    if (!categoryId) return null;
    const map = await getCategoryNameMapForMock(familyCode);
    return map.get(categoryId) || null;
  }

  function getSelectColumns(tableAlias = '') {
    const prefix = tableAlias ? `${tableAlias}.` : '';
    const typeColumns = itemType === 'shopping'
      ? `${prefix}done`
      : `${prefix}has_stock, ${prefix}expire_date`;

    return `${prefix}id, ${prefix}item_id, ${prefix}family_code, ${prefix}name, ${prefix}quantity, ${prefix}category_id, ${prefix}price, ${typeColumns}, ${prefix}create_time, ${prefix}version, ${prefix}deleted_at, ${prefix}created_at, ${prefix}updated_at`;
  }

  function createMockRow(familyCode, memberCode, normalized) {
    const now = new Date().toISOString();
    const key = getMockKey(familyCode, normalized.itemId);
    const current = mockItems.get(key);
    const row = {
      id: current?.id || mockItems.size + 1,
      item_id: normalized.itemId,
      family_code: familyCode,
      name: normalized.name,
      quantity: normalized.quantity,
      category_id: normalized.categoryId,
      price: normalized.price,
      done: itemType === 'shopping' ? Number(normalized.done) : undefined,
      has_stock: itemType === 'ingredient' ? Number(normalized.hasStock) : undefined,
      expire_date: itemType === 'ingredient' ? normalized.expireDate : undefined,
      create_time: normalized.createTime,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockItems.set(key, row);
    return row;
  }

  async function upsertItem(familyCode, memberCode, itemJson) {
    const normalized = normalizeItem(itemJson, familyCode, itemType);

    if (env.useMockDb) {
      const row = createMockRow(familyCode, memberCode, normalized);
      const categoryName = await getCategoryNameForMock(familyCode, row.category_id);
      return toItem(row, itemType, categoryName);
    }

    if (itemType === 'shopping') {
      await query(
        `INSERT INTO ${tableName}
           (item_id, family_code, name, quantity, category_id, price, done, create_time, created_by, updated_by, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           quantity = VALUES(quantity),
           category_id = VALUES(category_id),
           price = VALUES(price),
           done = VALUES(done),
           create_time = VALUES(create_time),
           updated_by = VALUES(updated_by),
           version = version + 1,
           deleted_at = NULL,
           updated_at = CURRENT_TIMESTAMP`,
        [
          normalized.itemId,
          familyCode,
          normalized.name,
          normalized.quantity,
          normalized.categoryId,
          normalized.price,
          Number(normalized.done),
          normalized.createTime,
          memberCode,
          memberCode
        ]
      );
    } else {
      await query(
        `INSERT INTO ${tableName}
           (item_id, family_code, name, quantity, category_id, price, has_stock, expire_date, create_time, created_by, updated_by, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1)
         ON DUPLICATE KEY UPDATE
           name = VALUES(name),
           quantity = VALUES(quantity),
           category_id = VALUES(category_id),
           price = VALUES(price),
           has_stock = VALUES(has_stock),
           expire_date = VALUES(expire_date),
           create_time = VALUES(create_time),
           updated_by = VALUES(updated_by),
           version = version + 1,
           deleted_at = NULL,
           updated_at = CURRENT_TIMESTAMP`,
        [
          normalized.itemId,
          familyCode,
          normalized.name,
          normalized.quantity,
          normalized.categoryId,
          normalized.price,
          Number(normalized.hasStock),
          normalized.expireDate,
          normalized.createTime,
          memberCode,
          memberCode
        ]
      );
    }

    return getItemByFamily(familyCode, normalized.itemId);
  }

  async function upsertItemByMember(memberCode, familyCode, itemJson) {
    const member = await familyRecipeService.bindMemberToInitialFamily(memberCode, familyCode);
    const item = await upsertItem(member.familyCode, member.memberCode, itemJson);

    return { member, item };
  }

  async function upsertItemByDevice(deviceId, familyCode, itemJson) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

    if (!member) {
      return null;
    }

    const item = await upsertItem(member.familyCode, member.memberCode, itemJson);

    return { member, item };
  }

  async function getItemByFamily(familyCode, itemId) {
    if (env.useMockDb) {
      const row = mockItems.get(getMockKey(familyCode, itemId));
      if (!row) return null;
      const categoryName = await getCategoryNameForMock(familyCode, row.category_id);
      return toItem(row, itemType, categoryName);
    }

    const categoryTable = itemType === 'shopping' ? 'family_shopping_categories' : 'family_ingredient_categories';
    const rows = await query(
      `SELECT ${getSelectColumns('i')}, c.name AS category_name
       FROM ${tableName} i
       LEFT JOIN ${categoryTable} c ON i.family_code = c.family_code AND i.category_id = c.category_id AND c.deleted_at IS NULL
       WHERE i.family_code = ? AND i.item_id = ?`,
      [familyCode, itemId]
    );

    return toItem(rows[0], itemType);
  }

  async function getItemByMember(memberCode, itemId) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    const item = await getItemByFamily(member.familyCode, itemId);

    return { member, item };
  }

  async function getItemByDevice(deviceId, itemId) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId);

    if (!member) {
      return null;
    }

    const item = await getItemByFamily(member.familyCode, itemId);

    return { member, item };
  }

  async function listItemsByFamily(familyCode, options = {}) {
    const includeDeleted = Boolean(options.includeDeleted);
    const categoryId = normalizeText(options.categoryId || options.category_id);

    if (env.useMockDb) {
      const categoryNameMap = await getCategoryNameMapForMock(familyCode);
      return Array.from(mockItems.values())
        .filter((row) => row.family_code === familyCode)
        .filter((row) => includeDeleted || !row.deleted_at)
        .filter((row) => !categoryId || row.category_id === categoryId)
        .sort((a, b) => (a.create_time || 0) - (b.create_time || 0))
        .map((row) => toItem(row, itemType, categoryNameMap.get(row.category_id)));
    }

    const filters = ['i.family_code = ?'];
    const params = [familyCode];

    if (!includeDeleted) {
      filters.push('i.deleted_at IS NULL');
    }

    if (categoryId) {
      filters.push('i.category_id = ?');
      params.push(categoryId);
    }

    const categoryTable = itemType === 'shopping' ? 'family_shopping_categories' : 'family_ingredient_categories';
    const rows = await query(
      `SELECT ${getSelectColumns('i')}, c.name AS category_name
       FROM ${tableName} i
       LEFT JOIN ${categoryTable} c ON i.family_code = c.family_code AND i.category_id = c.category_id AND c.deleted_at IS NULL
       WHERE ${filters.join(' AND ')}
       ORDER BY i.create_time ASC, i.id ASC`,
      params
    );

    return rows.map((row) => toItem(row, itemType));
  }

  async function listItemsByMember(memberCode, options = {}) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    const items = await listItemsByFamily(member.familyCode, options);

    return { member, items };
  }

  async function listItemsByDevice(deviceId, options = {}) {
    const familyCode = normalizeText(options.familyCode || options.family_code);
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

    if (!member) {
      return null;
    }

    const items = await listItemsByFamily(member.familyCode, options);

    return { member, items };
  }

  async function getChangesByFamily(familyCode, since) {
    const sinceMs = Number(since || 0);

    if (env.useMockDb) {
      const categoryNameMap = await getCategoryNameMapForMock(familyCode);
      const items = Array.from(mockItems.values())
        .filter((row) => row.family_code === familyCode)
        .filter((row) => Date.parse(row.updated_at) > sinceMs)
        .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
        .map((row) => toItem(row, itemType, categoryNameMap.get(row.category_id)));

      return { familyCode, items, serverTime: Date.now() };
    }

    const categoryTable = itemType === 'shopping' ? 'family_shopping_categories' : 'family_ingredient_categories';
    const rows = await query(
      `SELECT ${getSelectColumns('i')}, c.name AS category_name
       FROM ${tableName} i
       LEFT JOIN ${categoryTable} c ON i.family_code = c.family_code AND i.category_id = c.category_id AND c.deleted_at IS NULL
       WHERE i.family_code = ? AND i.updated_at > FROM_UNIXTIME(?)
       ORDER BY i.updated_at ASC, i.id ASC`,
      [familyCode, Math.max(0, sinceMs) / 1000]
    );

    return {
      familyCode,
      items: rows.map((row) => toItem(row, itemType)),
      serverTime: Date.now()
    };
  }

  async function getChangesByMember(memberCode, since) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    return getChangesByFamily(member.familyCode, since);
  }

  async function getChangesByDevice(deviceId, since, options = {}) {
    const familyCode = normalizeText(options.familyCode || options.family_code);
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

    if (!member) {
      return null;
    }

    return getChangesByFamily(member.familyCode, since);
  }

  async function deleteItemByFamily(familyCode, itemId, memberCode = null) {
    if (env.useMockDb) {
      const key = getMockKey(familyCode, itemId);
      const current = mockItems.get(key);

      if (!current || current.deleted_at) {
        return null;
      }

      current.deleted_at = new Date().toISOString();
      current.updated_by = memberCode;
      current.version += 1;
      current.updated_at = current.deleted_at;
      mockItems.set(key, current);

      const categoryName = await getCategoryNameForMock(familyCode, current.category_id);
      return toItem(current, itemType, categoryName);
    }

    await query(
      `UPDATE ${tableName}
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_by = ?,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE family_code = ? AND item_id = ? AND deleted_at IS NULL`,
      [memberCode, familyCode, itemId]
    );

    return getItemByFamily(familyCode, itemId);
  }

  async function deleteItemByMember(memberCode, itemId) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    const item = await deleteItemByFamily(member.familyCode, itemId, member.memberCode);

    if (!item) {
      throw createNotFoundError('条目不存在');
    }

    return { member, item };
  }

  async function deleteItemByDevice(deviceId, itemId) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId);

    if (!member) {
      return null;
    }

    const item = await deleteItemByFamily(member.familyCode, itemId, member.memberCode);

    if (!item) {
      throw createNotFoundError('条目不存在');
    }

    return { member, item };
  }

  async function deleteItemsByDevice(deviceId, itemIds) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId);

    if (!member) {
      return null;
    }

    const items = [];

    for (const itemId of itemIds) {
      const item = await deleteItemByFamily(member.familyCode, itemId, member.memberCode);

      if (item) {
        items.push(item);
      }
    }

    return { member, items, deletedCount: items.length };
  }

  async function deleteItemsByCondition(deviceId, whereSql, params, mockPredicate) {
    const member = await familyRecipeService.getFamilyMemberByDevice(deviceId);

    if (!member) {
      return null;
    }

    if (env.useMockDb) {
      const matchedItems = Array.from(mockItems.values())
        .filter((row) => row.family_code === member.familyCode)
        .filter((row) => !row.deleted_at)
        .filter(mockPredicate);
      const items = [];

      for (const row of matchedItems) {
        const item = await deleteItemByFamily(member.familyCode, row.item_id, member.memberCode);

        if (item) {
          items.push(item);
        }
      }

      return { member, items, deletedCount: items.length };
    }

    const rows = await query(
      `SELECT item_id
       FROM ${tableName}
       WHERE family_code = ? AND deleted_at IS NULL AND ${whereSql}`,
      [member.familyCode, ...params]
    );
    const items = [];

    for (const row of rows) {
      const item = await deleteItemByFamily(member.familyCode, row.item_id, member.memberCode);

      if (item) {
        items.push(item);
      }
    }

    return { member, items, deletedCount: items.length };
  }

  async function clearExpiredItemsByDevice(deviceId) {
    return deleteItemsByCondition(
      deviceId,
      'expire_date IS NOT NULL AND expire_date < CURDATE()',
      [],
      (row) => row.expire_date && row.expire_date < new Date().toISOString().slice(0, 10)
    );
  }

  async function clearPurchasedItemsByDevice(deviceId) {
    return deleteItemsByCondition(
      deviceId,
      'done = 1',
      [],
      (row) => Number(row.done) === 1
    );
  }

  return {
    upsertItemByMember,
    upsertItemByDevice,
    getItemByFamily,
    getItemByMember,
    getItemByDevice,
    listItemsByFamily,
    listItemsByMember,
    listItemsByDevice,
    getChangesByMember,
    getChangesByDevice,
    getChangesByFamily,
    deleteItemByFamily,
    deleteItemByMember,
    deleteItemByDevice,
    deleteItemsByDevice,
    clearExpiredItemsByDevice,
    clearPurchasedItemsByDevice
  };
}

module.exports = {
  createFamilyItemCollectionService
};
