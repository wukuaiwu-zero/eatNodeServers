const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function parseItemJson(itemJson) {
  try {
    return JSON.parse(itemJson);
  } catch (error) {
    return itemJson;
  }
}

function createItemId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItem(itemJson, familyCode) {
  if (itemJson === undefined || itemJson === null) {
    throw new TypeError('itemJson is required');
  }

  const item = typeof itemJson === 'string' ? JSON.parse(itemJson) : { ...itemJson };

  if (!item || typeof item !== 'object' || Array.isArray(item)) {
    throw new TypeError('itemJson must be an object');
  }
  const itemId = String(item.id || item._id || createItemId()).trim();

  if (!itemId) {
    throw new TypeError('item id is required');
  }

  const createTime = Number(item.create_time || Date.now());

  return {
    itemId,
    createTime: Number.isFinite(createTime) ? createTime : Date.now(),
    item: {
      ...item,
      id: itemId,
      _id: itemId,
      family_id: familyCode,
      create_time: Number.isFinite(createTime) ? createTime : Date.now()
    }
  };
}

function toItem(row) {
  if (!row) {
    return null;
  }

  const parsed = parseItemJson(row.item_json);
  const item = parsed && typeof parsed === 'object' ? parsed : { value: parsed };

  return {
    ...item,
    id: row.item_id,
    _id: row.item_id,
    family_id: row.family_code,
    create_time: item.create_time || row.create_time,
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at
  };
}

function createFamilyItemCollectionService({ tableName }) {
  const mockItems = new Map();

  function getMockKey(familyCode, itemId) {
    return `${familyCode}:${itemId}`;
  }

  async function upsertItem(familyCode, memberCode, itemJson) {
    const normalized = normalizeItem(itemJson, familyCode);
    const normalizedItemJson = JSON.stringify(normalized.item);

    if (env.useMockDb) {
      const now = new Date().toISOString();
      const key = getMockKey(familyCode, normalized.itemId);
      const current = mockItems.get(key);
      const row = {
        id: current?.id || mockItems.size + 1,
        item_id: normalized.itemId,
        family_code: familyCode,
        item_json: normalizedItemJson,
        create_time: normalized.createTime,
        created_by: current?.created_by || memberCode,
        updated_by: memberCode,
        version: (current?.version || 0) + 1,
        deleted_at: null,
        created_at: current?.created_at || now,
        updated_at: now
      };

      mockItems.set(key, row);
      return toItem(row);
    }

    await query(
      `INSERT INTO ${tableName}
         (item_id, family_code, item_json, create_time, created_by, updated_by, version)
       VALUES (?, ?, ?, ?, ?, ?, 1)
       ON DUPLICATE KEY UPDATE
         item_json = VALUES(item_json),
         create_time = VALUES(create_time),
         updated_by = VALUES(updated_by),
         version = version + 1,
         deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP`,
      [
        normalized.itemId,
        familyCode,
        normalizedItemJson,
        normalized.createTime,
        memberCode,
        memberCode
      ]
    );

    return getItemByFamily(familyCode, normalized.itemId);
  }

  async function upsertItemByMember(memberCode, familyCode, itemJson) {
    const member = await familyRecipeService.bindMemberToInitialFamily(memberCode, familyCode);
    const item = await upsertItem(member.familyCode, member.memberCode, itemJson);

    return {
      member,
      item
    };
  }

  async function getItemByFamily(familyCode, itemId) {
    if (env.useMockDb) {
      return toItem(mockItems.get(getMockKey(familyCode, itemId)));
    }

    const rows = await query(
      `SELECT id, item_id, family_code, item_json, create_time, version, deleted_at, created_at, updated_at
       FROM ${tableName}
       WHERE family_code = ? AND item_id = ?`,
      [familyCode, itemId]
    );

    return toItem(rows[0]);
  }

  async function listItemsByFamily(familyCode, options = {}) {
    const includeDeleted = Boolean(options.includeDeleted);

    if (env.useMockDb) {
      return Array.from(mockItems.values())
        .filter((row) => row.family_code === familyCode)
        .filter((row) => includeDeleted || !row.deleted_at)
        .sort((a, b) => (a.create_time || 0) - (b.create_time || 0))
        .map(toItem);
    }

    const deletedFilter = includeDeleted ? '' : 'AND deleted_at IS NULL';
    const rows = await query(
      `SELECT id, item_id, family_code, item_json, create_time, version, deleted_at, created_at, updated_at
       FROM ${tableName}
       WHERE family_code = ? ${deletedFilter}
       ORDER BY create_time ASC, id ASC`,
      [familyCode]
    );

    return rows.map(toItem);
  }

  async function listItemsByMember(memberCode, options = {}) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    const items = await listItemsByFamily(member.familyCode, options);

    return {
      member,
      items
    };
  }

  async function getChangesByMember(memberCode, since) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    const sinceMs = Number(since || 0);

    if (env.useMockDb) {
      const items = Array.from(mockItems.values())
        .filter((row) => row.family_code === member.familyCode)
        .filter((row) => Date.parse(row.updated_at) > sinceMs)
        .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
        .map(toItem);

      return {
        member,
        items,
        serverTime: Date.now()
      };
    }

    const rows = await query(
      `SELECT id, item_id, family_code, item_json, create_time, version, deleted_at, created_at, updated_at
       FROM ${tableName}
       WHERE family_code = ? AND updated_at > FROM_UNIXTIME(?)
       ORDER BY updated_at ASC, id ASC`,
      [member.familyCode, Math.max(0, sinceMs) / 1000]
    );

    return {
      member,
      items: rows.map(toItem),
      serverTime: Date.now()
    };
  }

  async function deleteItemByMember(memberCode, itemId) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    if (env.useMockDb) {
      const key = getMockKey(member.familyCode, itemId);
      const current = mockItems.get(key);

      if (!current) {
        return null;
      }

      current.deleted_at = new Date().toISOString();
      current.updated_by = memberCode;
      current.version += 1;
      current.updated_at = current.deleted_at;
      mockItems.set(key, current);

      return {
        member,
        item: toItem(current)
      };
    }

    await query(
      `UPDATE ${tableName}
       SET deleted_at = CURRENT_TIMESTAMP,
           updated_by = ?,
           version = version + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE family_code = ? AND item_id = ? AND deleted_at IS NULL`,
      [memberCode, member.familyCode, itemId]
    );

    const item = await getItemByFamily(member.familyCode, itemId);

    if (!item) {
      throw createNotFoundError('item not found');
    }

    return {
      member,
      item
    };
  }

  return {
    upsertItemByMember,
    listItemsByFamily,
    listItemsByMember,
    getChangesByMember,
    deleteItemByMember
  };
}

module.exports = {
  createFamilyItemCollectionService
};
