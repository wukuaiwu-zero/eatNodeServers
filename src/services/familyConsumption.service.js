const { query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const TABLE_NAME = 'family_consumption_records';
const SHOPPING_CATEGORY_TABLE = 'family_shopping_categories';
const BEIJING_TIME_ZONE = 'Asia/Shanghai';

const mockRecords = new Map();

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function createRecordId() {
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function getMockKey(familyCode, recordId) {
  return `${familyCode}:${recordId}`;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeDate(value) {
  const text = normalizeText(value);

  if (!text) {
    return new Date().toISOString().slice(0, 10);
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return text;
  }

  const date = new Date(text);

  if (Number.isNaN(date.getTime())) {
    throw new TypeError('消费日期格式不正确');
  }

  return date.toISOString().slice(0, 10);
}

function normalizeDateBoundary(value, fieldName, suffix) {
  const text = normalizeNullableText(value);

  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TypeError(`${fieldName}格式不正确`);
  }

  return `${text} ${suffix}`;
}

function normalizeCalendarDate(value, fieldName = '日期') {
  const text = normalizeText(value);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TypeError(`${fieldName}格式不正确`);
  }

  const parsed = new Date(`${text}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== text) {
    throw new TypeError(`${fieldName}格式不正确`);
  }

  return text;
}

function formatBeijingDate(date) {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: BEIJING_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit'
  }).formatToParts(date);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));

  return `${values.year}-${values.month}-${values.day}`;
}

function addDays(date, amount) {
  const normalizedDate = normalizeCalendarDate(date);
  const nextDate = new Date(`${normalizedDate}T00:00:00.000Z`);
  nextDate.setUTCDate(nextDate.getUTCDate() + amount);
  return nextDate.toISOString().slice(0, 10);
}

function getMonthEnd(date) {
  const normalizedDate = normalizeCalendarDate(date);
  const [year, month] = normalizedDate.split('-').map(Number);
  return new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
}

function getConsumptionChartRanges(now = new Date()) {
  const today = formatBeijingDate(now);
  const weekday = new Date(`${today}T00:00:00.000Z`).getUTCDay();
  const weekStartDate = addDays(today, -((weekday + 6) % 7));

  return {
    today,
    month: {
      startDate: `${today.slice(0, 8)}01`,
      endDate: getMonthEnd(today)
    },
    week: {
      startDate: weekStartDate,
      endDate: addDays(weekStartDate, 6)
    }
  };
}

function buildDailySeries(startDate, endDate, today, totals) {
  const normalizedStartDate = normalizeCalendarDate(startDate, '开始日期');
  const normalizedEndDate = normalizeCalendarDate(endDate, '结束日期');
  const normalizedToday = normalizeCalendarDate(today, '当前日期');
  const series = [];

  for (let date = normalizedStartDate; date <= normalizedEndDate; date = addDays(date, 1)) {
    series.push({
      date,
      value: date > normalizedToday ? null : Number(totals.get(date) || 0)
    });
  }

  return series;
}

function normalizeChartRows(rows) {
  return rows.map((row) => ({
    type: normalizeText(row.type) || '未分类',
    value: Number(row.value) || 0
  }));
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

function normalizePrice(value) {
  const price = Number(value);

  if (!Number.isFinite(price) || price < 0) {
    throw new TypeError('消费金额格式不正确');
  }

  return Math.round(price * 100) / 100;
}

function normalizeRecord(recordJson, familyCode) {
  if (recordJson === undefined || recordJson === null) {
    throw new TypeError('请填写消费记录数据');
  }

  const record = typeof recordJson === 'string' ? JSON.parse(recordJson) : { ...recordJson };

  if (!record || typeof record !== 'object' || Array.isArray(record)) {
    throw new TypeError('消费记录数据格式不正确');
  }

  const recordId = normalizeText(record.id || record._id || record.recordId || createRecordId());
  const name = normalizeText(record.name);
  const createTime = Number(record.create_time || record.createTime || Date.now());

  if (!recordId) {
    throw new TypeError('消费记录 id 不能为空');
  }

  if (!name) {
    throw new TypeError('消费名称不能为空');
  }

  if (record.price === undefined || record.price === null || record.price === '') {
    throw new TypeError('请填写消费金额');
  }

  return {
    recordId,
    familyCode,
    name,
    categoryId: normalizeNullableText(record.categoryId || record.category_id),
    price: normalizePrice(record.price),
    consumeDate: normalizeDate(record.date || record.consumeDate || record.consume_date),
    createTime: Number.isFinite(createTime) ? createTime : Date.now()
  };
}

function toRecord(row) {
  if (!row) {
    return null;
  }

  const createTime = normalizeTimeValue(row.create_time);

  return {
    id: row.record_id,
    _id: row.record_id,
    recordId: row.record_id,
    family_id: row.family_code,
    familyCode: row.family_code,
    family_code: row.family_code,
    name: row.name,
    categoryId: row.category_id,
    category_id: row.category_id,
    price: Number(row.price),
    date: row.consume_date,
    consumeDate: row.consume_date,
    consume_date: row.consume_date,
    create_time: createTime,
    createTime,
    version: row.version,
    deleted: Boolean(row.deleted_at),
    deletedAt: row.deleted_at,
    updatedAt: row.updated_at
  };
}

async function upsertRecord(familyCode, memberCode, recordJson) {
  const normalized = normalizeRecord(recordJson, familyCode);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const key = getMockKey(familyCode, normalized.recordId);
    const current = mockRecords.get(key);
    const row = {
      id: current?.id || mockRecords.size + 1,
      record_id: normalized.recordId,
      family_code: familyCode,
      name: normalized.name,
      category_id: normalized.categoryId,
      price: normalized.price,
      consume_date: normalized.consumeDate,
      create_time: normalized.createTime,
      created_by: current?.created_by || memberCode,
      updated_by: memberCode,
      version: (current?.version || 0) + 1,
      deleted_at: null,
      created_at: current?.created_at || now,
      updated_at: now
    };

    mockRecords.set(key, row);
    return toRecord(row);
  }

  await query(
    `INSERT INTO ${TABLE_NAME}
       (record_id, family_code, name, category_id, price, consume_date, create_time, created_by, updated_by, version)
     VALUES (?, ?, ?, ?, ?, ?, FROM_UNIXTIME(? / 1000), ?, ?, 1)
     ON DUPLICATE KEY UPDATE
       name = VALUES(name),
       category_id = VALUES(category_id),
       price = VALUES(price),
       consume_date = VALUES(consume_date),
       create_time = VALUES(create_time),
       updated_by = VALUES(updated_by),
       version = version + 1,
       deleted_at = NULL,
       updated_at = CURRENT_TIMESTAMP`,
    [
      normalized.recordId,
      familyCode,
      normalized.name,
      normalized.categoryId,
      normalized.price,
      normalized.consumeDate,
      normalized.createTime,
      memberCode,
      memberCode
    ]
  );

  return getRecordByFamily(familyCode, normalized.recordId);
}

async function upsertRecordByDevice(deviceId, familyCode, recordJson) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const record = await upsertRecord(member.familyCode, member.memberCode, recordJson);
  return { member, record };
}

async function getRecordByFamily(familyCode, recordId) {
  if (env.useMockDb) {
    return toRecord(mockRecords.get(getMockKey(familyCode, recordId)));
  }

  const rows = await query(
    `SELECT id, record_id, family_code, name, category_id, price, consume_date, create_time,
            version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE family_code = ? AND record_id = ?`,
    [familyCode, recordId]
  );

  return toRecord(rows[0]);
}

async function getRecordByDevice(deviceId, familyCode, recordId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const record = await getRecordByFamily(member.familyCode, recordId);

  return { member, record };
}

async function listRecordsByFamily(familyCode, options = {}) {
  const includeDeleted = Boolean(options.includeDeleted);
  const categoryId = normalizeNullableText(options.categoryId || options.category_id);
  const startTime = normalizeDateBoundary(options.startTime || options.start_time, '开始时间', '00:00:00');
  const endTime = normalizeDateBoundary(options.endTime || options.end_time, '结束时间', '23:59:59');

  if (env.useMockDb) {
    return Array.from(mockRecords.values())
      .filter((row) => row.family_code === familyCode)
      .filter((row) => includeDeleted || !row.deleted_at)
      .filter((row) => !categoryId || row.category_id === categoryId)
      .filter((row) => {
        const consumeTime = `${row.consume_date} 00:00:00`;
        return (!startTime || consumeTime >= startTime) && (!endTime || consumeTime <= endTime);
      })
      .sort((a, b) => {
        if (a.consume_date === b.consume_date) {
          return (a.create_time || 0) - (b.create_time || 0);
        }
        return a.consume_date.localeCompare(b.consume_date);
      })
      .map(toRecord);
  }

  const filters = ['family_code = ?'];
  const params = [familyCode];

  if (!includeDeleted) {
    filters.push('deleted_at IS NULL');
  }

  if (categoryId) {
    filters.push('category_id = ?');
    params.push(categoryId);
  }

  if (startTime) {
    filters.push('consume_date >= ?');
    params.push(startTime);
  }

  if (endTime) {
    filters.push('consume_date <= ?');
    params.push(endTime);
  }

  const rows = await query(
    `SELECT id, record_id, family_code, name, category_id, price, consume_date, create_time,
            version, deleted_at, created_at, updated_at
     FROM ${TABLE_NAME}
     WHERE ${filters.join(' AND ')}
     ORDER BY consume_date ASC, create_time ASC, id ASC`,
    params
  );

  return rows.map(toRecord);
}

async function listRecordsByDevice(deviceId, options = {}) {
  const familyCode = normalizeText(options.familyCode || options.family_code);
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode || null);

  if (!member) {
    return null;
  }

  const records = await listRecordsByFamily(member.familyCode, options);
  return { member, records };
}

async function listDailyTotalsByFamily(familyCode, startDate, endDate) {
  if (env.useMockDb) {
    const totals = new Map();

    for (const row of mockRecords.values()) {
      if (row.family_code !== familyCode || row.deleted_at || row.consume_date < startDate || row.consume_date > endDate) {
        continue;
      }

      totals.set(row.consume_date, (totals.get(row.consume_date) || 0) + Number(row.price));
    }

    return totals;
  }

  const rows = await query(
    `SELECT DATE_FORMAT(consume_date, '%Y-%m-%d') AS date, ROUND(SUM(price), 2) AS value
     FROM ${TABLE_NAME}
     WHERE family_code = ?
       AND deleted_at IS NULL
       AND consume_date >= ?
       AND consume_date < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY DATE_FORMAT(consume_date, '%Y-%m-%d')`,
    [familyCode, startDate, endDate]
  );

  return new Map(rows.map((row) => [row.date, Number(row.value)]));
}

async function getConsumptionChartByDevice(deviceId, familyCode) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const ranges = getConsumptionChartRanges();
  const [monthTotals, weekTotals] = await Promise.all([
    listDailyTotalsByFamily(member.familyCode, ranges.month.startDate, ranges.month.endDate),
    listDailyTotalsByFamily(member.familyCode, ranges.week.startDate, ranges.week.endDate)
  ]);

  return {
    member,
    month: buildDailySeries(ranges.month.startDate, ranges.month.endDate, ranges.today, monthTotals),
    week: buildDailySeries(ranges.week.startDate, ranges.week.endDate, ranges.today, weekTotals)
  };
}

async function listDailyCategoryTotalsByFamily(familyCode, date) {
  if (env.useMockDb) {
    const categoryService = require('./familyShoppingCategory.service');
    const categories = await categoryService.listCategoriesByFamily(familyCode);
    const categoryNames = new Map(categories.map((category) => [category.categoryId, category.name]));
    const totals = new Map();

    for (const row of mockRecords.values()) {
      if (row.family_code !== familyCode || row.deleted_at || row.consume_date !== date) {
        continue;
      }

      const type = categoryNames.get(row.category_id) || row.category_id || '未分类';
      totals.set(type, (totals.get(type) || 0) + Number(row.price));
    }

    return normalizeChartRows(
      Array.from(totals, ([type, value]) => ({ type, value }))
        .sort((a, b) => b.value - a.value || a.type.localeCompare(b.type))
    );
  }

  const rows = await query(
    `SELECT COALESCE(NULLIF(c.name, ''), NULLIF(r.category_id, ''), '未分类') AS type,
            ROUND(SUM(r.price), 2) AS value
     FROM ${TABLE_NAME} r
     LEFT JOIN ${SHOPPING_CATEGORY_TABLE} c
       ON c.family_code = r.family_code AND c.category_id = r.category_id AND c.deleted_at IS NULL
     WHERE r.family_code = ?
       AND r.deleted_at IS NULL
       AND r.consume_date >= ?
       AND r.consume_date < DATE_ADD(?, INTERVAL 1 DAY)
     GROUP BY r.category_id, c.name
     ORDER BY value DESC, type ASC`,
    [familyCode, date, date]
  );

  return normalizeChartRows(rows);
}

async function getDailyConsumptionChartByDevice(deviceId, familyCode, date) {
  const normalizedDate = normalizeCalendarDate(date);
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  return {
    member,
    date: normalizedDate,
    charts: await listDailyCategoryTotalsByFamily(member.familyCode, normalizedDate)
  };
}

async function deleteRecordByFamily(familyCode, recordId, memberCode) {
  const record = await getRecordByFamily(familyCode, recordId);

  if (!record || record.deleted) {
    return null;
  }

  if (env.useMockDb) {
    const key = getMockKey(familyCode, recordId);
    const current = mockRecords.get(key);
    current.deleted_at = new Date().toISOString();
    current.updated_by = memberCode;
    current.version += 1;
    current.updated_at = current.deleted_at;
    mockRecords.set(key, current);
    return toRecord(current);
  }

  await query(
    `UPDATE ${TABLE_NAME}
     SET deleted_at = CURRENT_TIMESTAMP,
         updated_by = ?,
         version = version + 1,
         updated_at = CURRENT_TIMESTAMP
     WHERE family_code = ? AND record_id = ? AND deleted_at IS NULL`,
    [memberCode, familyCode, recordId]
  );

  return getRecordByFamily(familyCode, recordId);
}

async function deleteRecordByDevice(deviceId, familyCode, recordId) {
  const member = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!member) {
    return null;
  }

  const record = await deleteRecordByFamily(member.familyCode, recordId, member.memberCode);

  if (!record) {
    throw createNotFoundError('消费记录不存在');
  }

  return { member, record };
}

module.exports = {
  upsertRecordByDevice,
  getRecordByDevice,
  listRecordsByDevice,
  deleteRecordByDevice,
  listRecordsByFamily,
  getConsumptionChartByDevice,
  getDailyConsumptionChartByDevice,
  getConsumptionChartRanges,
  buildDailySeries,
  normalizeCalendarDate,
  normalizeChartRows
};
