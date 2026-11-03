const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const TABLE_NAME = 'family_anchor_prices';
const mockAnchors = new Map();

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createAnchorId() {
  return `anchor_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function nameKey(value) {
  return normalizeText(value).replace(/\s+/g, ' ').toLowerCase();
}

function normalizeTimeValue(value) {
  function formatBeijingTime(date) {
    const beijingTime = new Date(date.getTime() + 8 * 60 * 60 * 1000);
    return `${beijingTime.toISOString().slice(0, -1)}+08:00`;
  }

  if (value instanceof Date) {
    return formatBeijingTime(value);
  }

  if (typeof value === 'number' && Number.isFinite(value)) {
    return formatBeijingTime(new Date(value));
  }

  if (typeof value === 'string') {
    const text = value.trim();
    const numeric = Number(text);

    if (Number.isFinite(numeric) && text) {
      return formatBeijingTime(new Date(numeric));
    }

    const parsed = Date.parse(text);
    if (!Number.isNaN(parsed)) {
      return formatBeijingTime(new Date(parsed));
    }
  }

  return null;
}

function normalizeAnchorPrice(value) {
  if (value === undefined || value === null || value === '') {
    throw new TypeError('请填写锚定价格');
  }

  let number = value;

  if (typeof value === 'string') {
    const text = value.trim().replace(/,/g, '');

    if (!/^\d+(\.\d+)?$/.test(text)) {
      throw new TypeError('锚定价格请填写数字');
    }

    number = Number(text);
  }

  if (typeof number !== 'number' || !Number.isFinite(number)) {
    throw new TypeError('锚定价格请填写数字');
  }

  if (number < 0 || number > 999999.99) {
    throw new TypeError('锚定价格超出范围');
  }

  return Math.round(number * 100) / 100;
}

function toPriceNumber(value) {
  const number = Number(value);

  if (!Number.isFinite(number)) {
    return null;
  }

  return Math.round(number * 100) / 100;
}

function normalizeAnchor(anchorJson) {
  if (anchorJson === undefined || anchorJson === null) {
    throw new TypeError('请填写锚定价格数据');
  }

  const anchor = typeof anchorJson === 'string' ? JSON.parse(anchorJson) : { ...anchorJson };

  if (!anchor || typeof anchor !== 'object' || Array.isArray(anchor)) {
    throw new TypeError('锚定价格数据格式不正确');
  }

  const name = normalizeText(anchor.name);
  const tag = normalizeText(anchor.tag ?? anchor.channel ?? anchor.brand ?? '');
  const anchorId = normalizeText(anchor.id || anchor._id || anchor.anchorId);

  if (!name) {
    throw new TypeError('物件名称不能为空');
  }

  if (name.length > 100) {
    throw new TypeError('物件名称太长了，不能超过 100 个字符');
  }

  if (tag.length > 50) {
    throw new TypeError('区分标签太长了，不能超过 50 个字符');
  }

  if (anchorId.length > 64) {
    throw new TypeError('锚定价格 ID 太长了，不能超过 64 个字符');
  }

  return {
    anchorId: anchorId || createAnchorId(),
    idProvided: Boolean(anchorId),
    name,
    nameKey: nameKey(name),
    tag: tag || null,
    tagKey: tag ? nameKey(tag) : '',
    anchorPrice: normalizeAnchorPrice(anchor.anchorPrice ?? anchor.anchor_price ?? anchor.price)
  };
}

function toAnchor(row) {
  if (!row) {
    return null;
  }

  return {
    id: row.anchor_id,
    _id: row.anchor_id,
    anchorId: row.anchor_id,
    family_id: row.family_code,
    familyCode: row.family_code,
    family_code: row.family_code,
    name: row.name,
    tag: row.tag || null,
    anchorPrice: toPriceNumber(row.anchor_price),
    anchor_price: toPriceNumber(row.anchor_price),
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function compareAnchors(left, right) {
  if (!left.tag && right.tag) {
    return -1;
  }

  if (left.tag && !right.tag) {
    return 1;
  }

  return String(left.tag || '').localeCompare(String(right.tag || ''), 'zh');
}

function summarizeAnchors(anchors, options = {}) {
  const active = (Array.isArray(anchors) ? anchors : []).filter((anchor) => anchor && !anchor.deleted);
  const hasPreferredTag = Object.prototype.hasOwnProperty.call(options, 'tag');
  const preferredTag = hasPreferredTag ? (normalizeText(options.tag) || null) : undefined;
  const list = (hasPreferredTag
    ? active.filter((anchor) => (anchor.tag || null) === preferredTag)
    : active.slice()
  ).sort(compareAnchors);
  const prices = list
    .map((anchor) => toPriceNumber(anchor.anchorPrice))
    .filter((price) => price !== null);
  const defaultAnchor = list.find((anchor) => !anchor.tag) || null;
  let anchorPrice = null;

  if (hasPreferredTag) {
    anchorPrice = prices.length === 1 ? prices[0] : null;
  } else if (defaultAnchor) {
    anchorPrice = toPriceNumber(defaultAnchor.anchorPrice);
  } else if (list.length === 1) {
    anchorPrice = prices[0] ?? null;
  }

  return {
    anchorPrice,
    anchorMin: prices.length ? Math.min(...prices) : null,
    anchorMax: prices.length ? Math.max(...prices) : null,
    anchorCount: list.length,
    matches: list.map((anchor) => ({
      anchorId: anchor.anchorId || anchor.id,
      name: anchor.name,
      tag: anchor.tag || null,
      anchorPrice: toPriceNumber(anchor.anchorPrice)
    }))
  };
}

function decorateShoppingItems(items, anchors) {
  const index = new Map();

  (Array.isArray(anchors) ? anchors : []).forEach((anchor) => {
    if (!anchor || anchor.deleted) {
      return;
    }

    const key = nameKey(anchor.name);
    const list = index.get(key) || [];
    list.push(anchor);
    index.set(key, list);
  });

  return (Array.isArray(items) ? items : []).map((item) => {
    const summary = summarizeAnchors(index.get(nameKey(item?.name)) || []);

    return {
      ...item,
      anchor: summary.anchorCount ? summary : null
    };
  });
}

function getMockKey(familyCode, anchorId) {
  return `${familyCode}:${anchorId}`;
}

function selectColumns() {
  return `id, anchor_id, family_code, name, name_key, tag, tag_key, anchor_price,
    version, deleted_at, created_at, updated_at`;
}

function findMockByKey(familyCode, nameKeyValue, tagKeyValue, anchorIdToIgnore = '') {
  return Array.from(mockAnchors.values()).find((row) => (
    row.family_code === familyCode
    && row.name_key === nameKeyValue
    && row.tag_key === tagKeyValue
    && row.anchor_id !== anchorIdToIgnore
  )) || null;
}

function createMockRow(familyCode, memberCode, normalized, current) {
  const now = new Date().toISOString();

  return {
    id: current?.id || mockAnchors.size + 1,
    anchor_id: current?.anchor_id || normalized.anchorId,
    family_code: familyCode,
    name: normalized.name,
    name_key: normalized.nameKey,
    tag: normalized.tag,
    tag_key: normalized.tagKey,
    anchor_price: normalized.anchorPrice,
    created_by: current?.created_by || memberCode,
    updated_by: memberCode,
    version: (current?.version || 0) + 1,
    deleted_at: null,
    created_at: current?.created_at || now,
    updated_at: now
  };
}

async function findRowByKey(familyCode, nameKeyValue, tagKeyValue) {
  if (env.useMockDb) {
    return findMockByKey(familyCode, nameKeyValue, tagKeyValue);
  }

  const rows = await query(
    `SELECT ${selectColumns()}
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND name_key = ? AND tag_key = ?
     LIMIT 1`,
    [familyCode, nameKeyValue, tagKeyValue]
  );

  return rows[0] || null;
}

async function findRowById(familyCode, anchorId) {
  if (env.useMockDb) {
    return mockAnchors.get(getMockKey(familyCode, anchorId)) || null;
  }

  const rows = await query(
    `SELECT ${selectColumns()}
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND anchor_id = ?
     LIMIT 1`,
    [familyCode, anchorId]
  );

  return rows[0] || null;
}

async function updateAnchorRow(familyCode, memberCode, anchorId, normalized) {
  if (env.useMockDb) {
    const current = mockAnchors.get(getMockKey(familyCode, anchorId));
    const row = createMockRow(familyCode, memberCode, normalized, current);
    mockAnchors.set(getMockKey(familyCode, row.anchor_id), row);
    return toAnchor(row);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET name = ?,
         name_key = ?,
         tag = ?,
         tag_key = ?,
         anchor_price = ?,
         updated_by = ?,
         version = version + 1,
         deleted_at = NULL,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND anchor_id = ?`,
    [
      normalized.name,
      normalized.nameKey,
      normalized.tag,
      normalized.tagKey,
      normalized.anchorPrice,
      memberCode,
      familyCode,
      anchorId
    ]
  );

  return toAnchor(await findRowById(familyCode, anchorId));
}

async function insertAnchorRow(familyCode, memberCode, normalized) {
  if (env.useMockDb) {
    const row = createMockRow(familyCode, memberCode, normalized, null);
    mockAnchors.set(getMockKey(familyCode, row.anchor_id), row);
    return toAnchor(row);
  }

  try {
    await query(
      `INSERT INTO ${TABLE_NAME}
         (anchor_id, family_code, name, name_key, tag, tag_key, anchor_price, created_by, updated_by, version)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1)`,
      [
        normalized.anchorId,
        familyCode,
        normalized.name,
        normalized.nameKey,
        normalized.tag,
        normalized.tagKey,
        normalized.anchorPrice,
        memberCode,
        memberCode
      ]
    );
  } catch (error) {
    if (error.code !== 'ER_DUP_ENTRY') {
      throw error;
    }

    const existing = await findRowByKey(familyCode, normalized.nameKey, normalized.tagKey);

    if (!existing) {
      throw error;
    }

    return updateAnchorRow(familyCode, memberCode, existing.anchor_id, normalized);
  }

  return toAnchor(await findRowById(familyCode, normalized.anchorId));
}

async function saveAnchor(familyCode, memberCode, anchorJson) {
  const normalized = normalizeAnchor(anchorJson);
  const existingByKey = await findRowByKey(familyCode, normalized.nameKey, normalized.tagKey);

  if (normalized.idProvided) {
    const existingById = await findRowById(familyCode, normalized.anchorId);

    if (existingById && existingByKey && existingByKey.anchor_id !== existingById.anchor_id) {
      throw new TypeError('这个物件的锚定价格已经存在，请直接修改那一条');
    }

    if (existingById) {
      return updateAnchorRow(familyCode, memberCode, existingById.anchor_id, normalized);
    }
  }

  if (existingByKey) {
    return updateAnchorRow(familyCode, memberCode, existingByKey.anchor_id, {
      ...normalized,
      anchorId: existingByKey.anchor_id
    });
  }

  return insertAnchorRow(familyCode, memberCode, normalized);
}

async function saveAnchorByDevice(deviceId, familyCode, anchorJson) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const anchor = await saveAnchor(member.familyCode, member.memberCode, anchorJson);
  return { member, anchor };
}

async function listAnchorsByFamily(familyCode, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);
  const itemNameKey = nameKey(options.name || '');

  if (env.useMockDb) {
    return Array.from(mockAnchors.values())
      .filter((row) => row.family_code === familyCode)
      .filter((row) => includeDeleted || !row.deleted_at)
      .filter((row) => !itemNameKey || row.name_key === itemNameKey)
      .sort((left, right) => {
        const nameOrder = left.name_key.localeCompare(right.name_key, 'zh');
        if (nameOrder !== 0) {
          return nameOrder;
        }
        return left.tag_key.localeCompare(right.tag_key, 'zh');
      })
      .map(toAnchor);
  }

  const filters = ['family_code = ?'];
  const params = [familyCode];

  if (!includeDeleted) {
    filters.push('deleted_at IS NULL');
  }

  if (itemNameKey) {
    filters.push('name_key = ?');
    params.push(itemNameKey);
  }

  const rows = await query(
    `SELECT ${selectColumns()}
     FROM ${TABLE_NAME}
     WHERE ${filters.join(' AND ')}
     ORDER BY name_key ASC, tag_key ASC, id ASC`,
    params
  );

  return rows.map(toAnchor);
}

async function listAnchorsByDevice(deviceId, options = {}) {
  const familyCode = normalizeText(options.familyCode || options.family_code);
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

  if (!member) {
    return null;
  }

  const anchors = await listAnchorsByFamily(member.familyCode, options);
  return { member, anchors };
}

async function getAnchorByDevice(deviceId, familyCode, anchorId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const anchor = toAnchor(await findRowById(member.familyCode, anchorId));
  return { member, anchor };
}

async function matchAnchorByDevice(deviceId, familyCode, name, tag, hasTag) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const anchors = await listAnchorsByFamily(member.familyCode, { name });
  const match = summarizeAnchors(anchors, hasTag ? { tag } : {});

  return {
    member,
    match: {
      name: normalizeText(name),
      ...match
    }
  };
}

async function getChangesByFamily(familyCode, since) {
  const sinceMs = Number(since || 0);

  if (env.useMockDb) {
    const anchors = Array.from(mockAnchors.values())
      .filter((row) => row.family_code === familyCode)
      .filter((row) => Date.parse(row.updated_at) > sinceMs)
      .sort((left, right) => Date.parse(left.updated_at) - Date.parse(right.updated_at))
      .map(toAnchor);

    return { familyCode, anchors, serverTime: Date.now() };
  }

  const rows = await query(
    `SELECT ${selectColumns()}
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND updated_at > FROM_UNIXTIME(?)
     ORDER BY updated_at ASC, id ASC`,
    [familyCode, Math.max(0, sinceMs) / 1000]
  );

  return {
    familyCode,
    anchors: rows.map(toAnchor),
    serverTime: Date.now()
  };
}

async function getChangesByDevice(deviceId, since, options = {}) {
  const familyCode = normalizeText(options.familyCode || options.family_code);
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

  if (!member) {
    return null;
  }

  return getChangesByFamily(member.familyCode, since);
}

async function deleteAnchor(familyCode, memberCode, target) {
  const row = target.anchorId
    ? await findRowById(familyCode, target.anchorId)
    : await findRowByKey(familyCode, nameKey(target.name), target.tag ? nameKey(target.tag) : '');

  if (!row || row.deleted_at) {
    return null;
  }

  if (env.useMockDb) {
    row.deleted_at = new Date().toISOString();
    row.updated_by = memberCode;
    row.version += 1;
    row.updated_at = row.deleted_at;
    mockAnchors.set(getMockKey(familyCode, row.anchor_id), row);
    return toAnchor(row);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND anchor_id = ? AND deleted_at IS NULL`,
    [memberCode, familyCode, row.anchor_id]
  );

  return toAnchor(await findRowById(familyCode, row.anchor_id));
}

async function deleteAnchorByDevice(deviceId, familyCode, target) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const anchor = await deleteAnchor(member.familyCode, member.memberCode, target);

  if (!anchor) {
    throw createNotFoundError('锚定价格不存在');
  }

  return { member, anchor };
}

async function attachToShoppingItems(familyCode, items) {
  if (!familyCode || !Array.isArray(items) || items.length === 0) {
    return items || [];
  }

  const anchors = await listAnchorsByFamily(familyCode);
  return decorateShoppingItems(items, anchors);
}

module.exports = {
  nameKey,
  normalizeAnchor,
  summarizeAnchors,
  decorateShoppingItems,
  saveAnchorByDevice,
  listAnchorsByFamily,
  listAnchorsByDevice,
  getAnchorByDevice,
  matchAnchorByDevice,
  getChangesByDevice,
  deleteAnchorByDevice,
  attachToShoppingItems
};
