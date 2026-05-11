const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

// 购物清单和食材库的数据结构现在几乎一样，但业务上要分开表存。
// 这个文件只抽取“家庭条目集合”的公共同步逻辑：
// - 传入 tableName 后，同一套增删改查可以服务不同表。
// - 业务入口仍然分成 familyShopping.service / familyIngredient.service。
// 这样既避免复制两份一样的代码，也不会把两个业务的数据混在一张表里。

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function parseItemJson(itemJson) {
  // MySQL 里 item_json 存的是字符串，返回给前端时尽量还原成对象。
  // 这里保留兜底：如果历史数据不是合法 JSON，就原样返回，避免接口直接炸掉。
  try {
    return JSON.parse(itemJson);
  } catch (error) {
    return itemJson;
  }
}

function createItemId() {
  // 客户端离线新增时最好自己带 id；如果没带，服务端临时补一个。
  // 这里不是强安全唯一 ID，只是给普通清单条目兜底使用。
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeItem(itemJson, familyCode) {
  // 入口兼容两种请求体：
  // - 前端直接传对象
  // - 前端传 JSON 字符串
  // 统一成对象后，后面的存储逻辑就不用关心来源格式。
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

  // create_time 继续沿用客户端已有字段，方便和现有小程序/前端数据结构对齐。
  // 如果客户端没给或给错，服务端用当前时间兜底。
  const createTime = Number(item.create_time || Date.now());

  return {
    itemId,
    createTime: Number.isFinite(createTime) ? createTime : Date.now(),
    item: {
      ...item,
      // 同时保留 id 和 _id，是为了兼容你现有对象里两个字段都存在的情况。
      // 后端真正做唯一约束时用 item_id 字段，对外返回时再补齐这两个别名。
      id: itemId,
      _id: itemId,
      // 请求里可能传 family_id，也可能传 familyCode。入库前统一以服务端确认的家庭为准，
      // 防止前端对象里 family_id 写错导致串家庭。
      family_id: familyCode,
      create_time: Number.isFinite(createTime) ? createTime : Date.now()
    }
  };
}

function toItem(row) {
  // 数据库行 -> API 返回对象。
  // 这里把系统字段 version/deleted/updatedAt 合并回条目对象，
  // 前端同步时就能知道这条数据是否被删除、版本是多少、何时更新。
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
  // USE_MOCK_DB=true 时不连 MySQL，直接用内存 Map 模拟表。
  // 这适合本地接口验证；服务重启后 mock 数据会清空。
  const mockItems = new Map();

  function getMockKey(familyCode, itemId) {
    // item_id 只在同一个家庭内唯一，所以 mock key 要把 familyCode 拼进去。
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

    // MySQL 这里用 upsert：
    // - 第一次新增时插入 version=1。
    // - 再次上传同一个 family_code + item_id 时更新 JSON，并把 version + 1。
    // - deleted_at 置空表示“重新上传一条被删过的数据”会恢复它。
    // 这就是购物清单/食材库最小可用的同步写入模型。
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
    // 所有写入都先绑定/确认 memberCode 和 familyCode 的关系。
    // 这个动作很关键：后面的数据写入使用 member.familyCode，而不是盲信请求体。
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

  async function getItemByMember(memberCode, itemId) {
    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return null;
    }

    const item = await getItemByFamily(member.familyCode, itemId);

    return {
      member,
      item
    };
  }

  async function listItemsByFamily(familyCode, options = {}) {
    // 普通列表默认只返回未删除数据。
    // 增量同步接口需要知道“哪些被删了”，才会显式包含 deleted_at 不为空的数据。
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
    // 对外接口通常只有 memberCode。先通过成员表找到家庭，再查该家庭的数据。
    // 这样前端不需要反复传 familyCode，也减少越权读其他家庭数据的风险。
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
    // 增量同步：客户端保存上次拿到的 serverTime，下次作为 since 传回来。
    // 服务端返回 since 之后更新过的条目，包括软删除条目。
    // 注意这里用服务端时间作为同步水位，比客户端本地时间可靠。
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

  async function getChangesByFamily(familyCode, since) {
    const sinceMs = Number(since || 0);

    if (env.useMockDb) {
      const items = Array.from(mockItems.values())
        .filter((row) => row.family_code === familyCode)
        .filter((row) => Date.parse(row.updated_at) > sinceMs)
        .sort((a, b) => Date.parse(a.updated_at) - Date.parse(b.updated_at))
        .map(toItem);

      return {
        familyCode,
        items,
        serverTime: Date.now()
      };
    }

    const rows = await query(
      `SELECT id, item_id, family_code, item_json, create_time, version, deleted_at, created_at, updated_at
       FROM ${tableName}
       WHERE family_code = ? AND updated_at > FROM_UNIXTIME(?)
       ORDER BY updated_at ASC, id ASC`,
      [familyCode, Math.max(0, sinceMs) / 1000]
    );

    return {
      familyCode,
      items: rows.map(toItem),
      serverTime: Date.now()
    };
  }

  async function deleteItemByFamily(familyCode, itemId, memberCode = null) {
    if (env.useMockDb) {
      const key = getMockKey(familyCode, itemId);
      const current = mockItems.get(key);

      if (!current) {
        return null;
      }

      current.deleted_at = new Date().toISOString();
      current.updated_by = memberCode;
      current.version += 1;
      current.updated_at = current.deleted_at;
      mockItems.set(key, current);

      return toItem(current);
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
    // 删除采用软删除，不物理删行。
    // 原因是多设备同步时，其他设备需要收到“这条已删除”的事件；
    // 如果直接 DELETE，离线设备回来后就不知道这条数据曾经被删过。
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
    getItemByFamily,
    getItemByMember,
    listItemsByFamily,
    listItemsByMember,
    getChangesByMember,
    getChangesByFamily,
    deleteItemByFamily,
    deleteItemByMember
  };
}

module.exports = {
  createFamilyItemCollectionService
};
