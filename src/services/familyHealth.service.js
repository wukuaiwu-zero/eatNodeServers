const { pool, query } = require('../config/db');
const { env } = require('../config/env');
const familyRecipeService = require('./familyRecipe.service');

const PROFILE_TABLE = 'family_member_health_profiles';
const WEIGHT_TABLE = 'family_member_weight_records';
const MAX_TREND_RANGE_DAYS = 366;

const mockProfiles = new Map();
const mockWeights = new Map();

const RECOMMENDATIONS = {
  fat_loss: [
    { name: '西蓝花虾仁炒蛋', kcal: 320, type: '减脂/高蛋白', image: '' },
    { name: '鸡胸肉藜麦沙拉', kcal: 380, type: '减脂/低脂', image: '' },
    { name: '番茄豆腐汤', kcal: 180, type: '轻食/高饱腹', image: '' }
  ],
  muscle_gain: [
    { name: '牛肉土豆饭', kcal: 560, type: '增肌/高蛋白', image: '' },
    { name: '鸡蛋牛油果吐司', kcal: 430, type: '增肌/优质脂肪', image: '' },
    { name: '三文鱼意面', kcal: 620, type: '增肌/高能量', image: '' }
  ],
  healthy: [
    { name: '清炒时蔬配米饭', kcal: 420, type: '均衡/家常', image: '' },
    { name: '香菇鸡肉粥', kcal: 350, type: '清淡/易消化', image: '' },
    { name: '杂粮饭配蒸鱼', kcal: 480, type: '均衡/优质蛋白', image: '' }
  ]
};

function createNotFoundError(message) {
  const error = new Error(message);
  error.statusCode = 404;
  return error;
}

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value) {
  const text = normalizeText(value);
  return text || null;
}

function normalizeNumber(value, fieldName, options = {}) {
  if (value === undefined || value === null || value === '') {
    return options.required ? (() => { throw new TypeError(`请填写${fieldName}`); })() : null;
  }

  const number = Number(value);

  if (!Number.isFinite(number)) {
    throw new TypeError(`${fieldName}必须是数字`);
  }

  if (options.min !== undefined && number < options.min) {
    throw new TypeError(`${fieldName}不能小于 ${options.min}`);
  }

  if (options.max !== undefined && number > options.max) {
    throw new TypeError(`${fieldName}不能大于 ${options.max}`);
  }

  return Math.round(number * 10) / 10;
}

function normalizeRecordDate(value) {
  if (!value) {
    return new Date().toISOString().slice(0, 10);
  }

  const text = normalizeText(value);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TypeError('记录日期格式必须是 YYYY-MM-DD');
  }

  return text;
}

function normalizeTrendDate(value, fieldName) {
  const text = normalizeText(value);
  if (!text) {
    return null;
  }

  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    throw new TypeError(`${fieldName}格式必须是 YYYY-MM-DD`);
  }

  const date = new Date(`${text}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== text) {
    throw new TypeError(`${fieldName}不是有效日期`);
  }

  return text;
}

function getDateDiffDays(startDate, endDate) {
  const start = new Date(`${startDate}T00:00:00.000Z`);
  const end = new Date(`${endDate}T00:00:00.000Z`);

  return Math.round((end.getTime() - start.getTime()) / 86400000);
}

function addDays(dateText, days) {
  const date = new Date(`${dateText}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function toDateText(value) {
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, '0');
    const day = String(value.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return String(value).slice(0, 10);
}

function buildDateRange(startDate, endDate) {
  const diffDays = getDateDiffDays(startDate, endDate);

  if (diffDays < 0) {
    throw new TypeError('结束日期不能早于开始日期');
  }

  if (diffDays + 1 > MAX_TREND_RANGE_DAYS) {
    throw new TypeError(`日期范围不能超过 ${MAX_TREND_RANGE_DAYS} 天`);
  }

  return Array.from({ length: diffDays + 1 }, (_, index) => addDays(startDate, index));
}

function getProfileKey(familyCode, memberCode) {
  return `${familyCode}:${memberCode}`;
}

function getWeightKey(familyCode, memberCode, recordDate) {
  return `${familyCode}:${memberCode}:${recordDate}`;
}

function calculateBmi(weight, height) {
  if (!weight || !height) {
    return null;
  }

  const meters = height / 100;
  return Math.round((weight / (meters * meters)) * 10) / 10;
}

function toProfile(row) {
  if (!row) {
    return {
      height: null,
      age: null,
      goalType: null,
      targetWeight: null,
      startWeight: null
    };
  }

  return {
    height: row.height_cm === null || row.height_cm === undefined ? null : Number(row.height_cm),
    age: row.age === null || row.age === undefined ? null : Number(row.age),
    goalType: row.goal_type || null,
    targetWeight: row.target_weight === null || row.target_weight === undefined ? null : Number(row.target_weight),
    startWeight: row.start_weight === null || row.start_weight === undefined ? null : Number(row.start_weight)
  };
}

function toHealthMember(member, profile, weights) {
  const history = weights.map((item) => Number(item.weight));
  const latestWeight = history.length ? history[history.length - 1] : profile.startWeight;

  return {
    memberId: member.memberCode,
    member_id: member.memberCode,
    name: member.name || member.memberCode,
    avatarUrl: member.avatarUrl || '',
    bmi: calculateBmi(latestWeight, profile.height),
    weight: latestWeight ?? null,
    height: profile.height,
    age: profile.age,
    goalType: profile.goalType,
    targetWeight: profile.targetWeight,
    startWeight: profile.startWeight,
    history
  };
}

function toWeightRecord(row, height = null) {
  const recordDate = toDateText(row.record_date);
  const weight = Number(row.weight);

  return {
    recordDate,
    record_date: recordDate,
    weight,
    bmi: calculateBmi(weight, height)
  };
}

function summarizeTrend(points) {
  const recordedPoints = points.filter((point) => point.weight !== null);
  const firstPoint = recordedPoints[0] || null;
  const lastPoint = recordedPoints[recordedPoints.length - 1] || null;
  const weights = recordedPoints.map((point) => point.weight);
  const change = firstPoint && lastPoint
    ? Math.round((lastPoint.weight - firstPoint.weight) * 10) / 10
    : null;

  return {
    labels: points.map((point) => point.recordDate),
    recordCount: recordedPoints.length,
    record_count: recordedPoints.length,
    firstWeight: firstPoint?.weight ?? null,
    first_weight: firstPoint?.weight ?? null,
    lastWeight: lastPoint?.weight ?? null,
    last_weight: lastPoint?.weight ?? null,
    weightChange: change,
    weight_change: change,
    minWeight: weights.length ? Math.min(...weights) : null,
    min_weight: weights.length ? Math.min(...weights) : null,
    maxWeight: weights.length ? Math.max(...weights) : null,
    max_weight: weights.length ? Math.max(...weights) : null
  };
}

async function assertDeviceCanAccessMember(deviceId, familyCode, memberCode) {
  const currentMember = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!currentMember) {
    return null;
  }

  const targetMember = await familyRecipeService.getFamilyMemberByCode(memberCode, currentMember.familyCode);

  if (!targetMember || targetMember.familyCode !== currentMember.familyCode) {
    throw createNotFoundError('家庭成员不存在');
  }

  return { currentMember, targetMember };
}

async function listProfilesByFamily(familyCode) {
  if (env.useMockDb) {
    return Array.from(mockProfiles.values()).filter((row) => row.family_code === familyCode);
  }

  return query(
    `SELECT family_code, member_code, height_cm, age, goal_type, target_weight, start_weight
     FROM ${PROFILE_TABLE}
     WHERE family_code = ?`,
    [familyCode]
  );
}

async function listWeightsByFamily(familyCode, memberCodes = []) {
  if (env.useMockDb) {
    return Array.from(mockWeights.values())
      .filter((row) => row.family_code === familyCode && (!memberCodes.length || memberCodes.includes(row.member_code)))
      .sort((a, b) => String(a.record_date).localeCompare(String(b.record_date)));
  }

  const memberFilter = memberCodes.length
    ? `AND member_code IN (${memberCodes.map(() => '?').join(',')})`
    : '';

  return query(
    `SELECT family_code, member_code, record_date, weight
     FROM ${WEIGHT_TABLE}
     WHERE family_code = ? ${memberFilter}
     ORDER BY record_date ASC, id ASC`,
    [familyCode, ...memberCodes]
  );
}

async function listMembersByDevice(deviceId, familyCode) {
  const currentMember = await familyRecipeService.getFamilyMemberByDevice(deviceId, familyCode);

  if (!currentMember) {
    return null;
  }

  const members = await familyRecipeService.listFamilyMembers(currentMember.familyCode);
  const profiles = await listProfilesByFamily(currentMember.familyCode);
  const weights = await listWeightsByFamily(currentMember.familyCode, members.map((member) => member.memberCode));
  const profileMap = new Map(profiles.map((row) => [row.member_code, toProfile(row)]));
  const weightsMap = weights.reduce((result, row) => {
    if (!result.has(row.member_code)) {
      result.set(row.member_code, []);
    }
    result.get(row.member_code).push(toWeightRecord(row));
    return result;
  }, new Map());

  return members.map((member) => (
    toHealthMember(
      member,
      profileMap.get(member.memberCode) || toProfile(null),
      weightsMap.get(member.memberCode) || []
    )
  ));
}

async function getMemberDetailByDevice(deviceId, familyCode, memberCode) {
  const access = await assertDeviceCanAccessMember(deviceId, familyCode, memberCode);

  if (!access) {
    return null;
  }

  const [profiles, weights] = await Promise.all([
    listProfilesByFamily(access.targetMember.familyCode),
    listWeightsByFamily(access.targetMember.familyCode, [access.targetMember.memberCode])
  ]);
  const profileRow = profiles.find((row) => row.member_code === access.targetMember.memberCode);

  const profile = toProfile(profileRow);
  return toHealthMember(
    access.targetMember,
    profile,
    weights.map((row) => toWeightRecord(row, profile.height))
  );
}

async function withTransaction(callback) {
  const connection = await pool.getConnection();

  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function recordWeightByDevice(deviceId, familyCode, memberCode, input = {}) {
  const access = await assertDeviceCanAccessMember(deviceId, familyCode, memberCode);

  if (!access) {
    return null;
  }

  const weight = normalizeNumber(input.weight, '体重', { required: true, min: 1, max: 500 });
  const recordDate = normalizeRecordDate(input.date || input.recordDate || input.record_date);
  const profileKey = getProfileKey(access.targetMember.familyCode, access.targetMember.memberCode);

  if (env.useMockDb) {
    const now = new Date().toISOString();
    const currentProfile = mockProfiles.get(profileKey);
    mockProfiles.set(profileKey, {
      family_code: access.targetMember.familyCode,
      member_code: access.targetMember.memberCode,
      height_cm: currentProfile?.height_cm ?? null,
      age: currentProfile?.age ?? null,
      goal_type: currentProfile?.goal_type ?? null,
      target_weight: currentProfile?.target_weight ?? null,
      start_weight: currentProfile?.start_weight ?? weight,
      updated_by: access.currentMember.memberCode,
      created_at: currentProfile?.created_at || now,
      updated_at: now
    });
    mockWeights.set(getWeightKey(access.targetMember.familyCode, access.targetMember.memberCode, recordDate), {
      id: mockWeights.size + 1,
      family_code: access.targetMember.familyCode,
      member_code: access.targetMember.memberCode,
      record_date: recordDate,
      weight,
      created_by: access.currentMember.memberCode,
      created_at: now,
      updated_at: now
    });
  } else {
    await withTransaction(async (connection) => {
      await connection.execute(
        `INSERT INTO ${PROFILE_TABLE}
           (family_code, member_code, start_weight, updated_by)
         VALUES (?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           start_weight = IF(start_weight IS NULL, VALUES(start_weight), start_weight),
           updated_by = VALUES(updated_by),
           updated_at = CURRENT_TIMESTAMP`,
        [access.targetMember.familyCode, access.targetMember.memberCode, weight, access.currentMember.memberCode]
      );
      await connection.execute(
        `INSERT INTO ${WEIGHT_TABLE}
           (family_code, member_code, record_date, weight, created_by)
         VALUES (?, ?, ?, ?, ?)
         ON DUPLICATE KEY UPDATE
           weight = VALUES(weight),
           updated_at = CURRENT_TIMESTAMP`,
        [access.targetMember.familyCode, access.targetMember.memberCode, recordDate, weight, access.currentMember.memberCode]
      );
    });
  }

  const detail = await getMemberDetailByDevice(deviceId, access.targetMember.familyCode, access.targetMember.memberCode);
  return {
    weight: detail.weight,
    bmi: detail.bmi,
    history: detail.history
  };
}

async function updateGoalByDevice(deviceId, familyCode, memberCode, input = {}) {
  const access = await assertDeviceCanAccessMember(deviceId, familyCode, memberCode);

  if (!access) {
    return null;
  }

  const goalType = normalizeNullableText(input.goalType || input.goal_type);
  const targetWeight = normalizeNumber(input.targetWeight ?? input.target_weight, '目标体重', {
    required: true,
    min: 1,
    max: 500
  });
  const height = normalizeNumber(input.height ?? input.heightCm ?? input.height_cm, '身高', { min: 30, max: 260 });
  const age = normalizeNumber(input.age, '年龄', { min: 1, max: 130 });

  if (!goalType) {
    throw new TypeError('请填写目标类型');
  }

  if (env.useMockDb) {
    const key = getProfileKey(access.targetMember.familyCode, access.targetMember.memberCode);
    const current = mockProfiles.get(key);
    const now = new Date().toISOString();
    mockProfiles.set(key, {
      family_code: access.targetMember.familyCode,
      member_code: access.targetMember.memberCode,
      height_cm: height ?? current?.height_cm ?? null,
      age: age ?? current?.age ?? null,
      goal_type: goalType,
      target_weight: targetWeight,
      start_weight: current?.start_weight ?? null,
      updated_by: access.currentMember.memberCode,
      created_at: current?.created_at || now,
      updated_at: now
    });
  } else {
    await query(
      `INSERT INTO ${PROFILE_TABLE}
         (family_code, member_code, height_cm, age, goal_type, target_weight, updated_by)
       VALUES (?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE
         height_cm = COALESCE(VALUES(height_cm), height_cm),
         age = COALESCE(VALUES(age), age),
         goal_type = VALUES(goal_type),
         target_weight = VALUES(target_weight),
         updated_by = VALUES(updated_by),
         updated_at = CURRENT_TIMESTAMP`,
      [
        access.targetMember.familyCode,
        access.targetMember.memberCode,
        height,
        age,
        goalType,
        targetWeight,
        access.currentMember.memberCode
      ]
    );
  }

  return { goalType, targetWeight };
}

async function getTrendByDevice(deviceId, familyCode, memberCode, options = {}) {
  const access = await assertDeviceCanAccessMember(deviceId, familyCode, memberCode);

  if (!access) {
    return null;
  }

  const trendOptions = typeof options === 'string' ? { type: options } : options || {};
  const startDate = normalizeTrendDate(trendOptions.startDate, '开始日期');
  const endDate = normalizeTrendDate(trendOptions.endDate, '结束日期');
  const [profiles, weights] = await Promise.all([
    listProfilesByFamily(access.targetMember.familyCode),
    listWeightsByFamily(access.targetMember.familyCode, [access.targetMember.memberCode])
  ]);
  const profileRow = profiles.find((row) => row.member_code === access.targetMember.memberCode);
  const profile = toProfile(profileRow);

  if (startDate || endDate) {
    if (!startDate || !endDate) {
      throw new TypeError('请同时填写开始日期和结束日期');
    }

    const weightMap = new Map(weights.map((row) => {
      const record = toWeightRecord(row, profile.height);
      return [record.recordDate, record];
    }));
    const points = buildDateRange(startDate, endDate).map((recordDate) => {
      const record = weightMap.get(recordDate);

      return {
        recordDate,
        record_date: recordDate,
        weight: record?.weight ?? null,
        bmi: record?.bmi ?? null,
        hasRecord: Boolean(record),
        has_record: Boolean(record)
      };
    });
    const summary = summarizeTrend(points);

    return {
      type: 'range',
      startDate,
      start_date: startDate,
      endDate,
      end_date: endDate,
      days: points.length,
      memberId: access.targetMember.memberCode,
      member_id: access.targetMember.memberCode,
      height: profile.height,
      targetWeight: profile.targetWeight,
      startWeight: profile.startWeight,
      labels: summary.labels,
      displayedHistory: points.map((point) => point.weight),
      summary,
      points
    };
  }

  const normalizedType = normalizeText(trendOptions.type) === 'month' ? 'month' : 'week';
  const limit = normalizedType === 'month' ? 31 : 7;
  const points = weights.slice(-limit).map((row) => toWeightRecord(row, profile.height));
  const summary = summarizeTrend(points);

  return {
    type: normalizedType,
    days: points.length,
    memberId: access.targetMember.memberCode,
    member_id: access.targetMember.memberCode,
    height: profile.height,
    targetWeight: profile.targetWeight,
    startWeight: profile.startWeight,
    labels: summary.labels,
    displayedHistory: points.map((point) => point.weight),
    summary,
    points
  };
}

function normalizeGoalKey(goalType) {
  const text = normalizeText(goalType).toLowerCase();

  if (text.includes('增肌') || text.includes('塑形') || text.includes('muscle')) {
    return 'muscle_gain';
  }

  if (text.includes('减脂') || text.includes('减重') || text.includes('fat') || text.includes('loss')) {
    return 'fat_loss';
  }

  return 'healthy';
}

async function getRecommendationsByDevice(deviceId, familyCode, memberCode, goalType) {
  const detail = await getMemberDetailByDevice(deviceId, familyCode, memberCode);

  if (!detail) {
    return null;
  }

  const key = normalizeGoalKey(goalType || detail.goalType);
  return RECOMMENDATIONS[key];
}

module.exports = {
  listMembersByDevice,
  getMemberDetailByDevice,
  recordWeightByDevice,
  updateGoalByDevice,
  getTrendByDevice,
  getRecommendationsByDevice
};
