const deviceService = require('../services/device.service');
const familyHealthService = require('../services/familyHealth.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const MEMBER_ID_MAX_LENGTH = 100;

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

function getFamilyCode(req) {
  return normalizeText(getInput(req, 'familyCode') || getInput(req, 'familycode') || getInput(req, 'family_code'));
}

function getMemberId(req) {
  return normalizeText(getInput(req, 'memberId') || getInput(req, 'member_id'));
}

async function authenticate(req) {
  const { deviceId, deviceSecret } = getDeviceCredentials(req);
  return deviceService.authenticateDevice(deviceId, deviceSecret);
}

function sendSuccess(res, data) {
  return res.json({ success: true, data });
}

function sendMemberMissing(res) {
  return res.status(403).json({ success: false, message: '当前设备还没有加入这个家庭' });
}

function validateFamilyAndMember(req, memberRequired = false) {
  const familyCode = getFamilyCode(req);
  const memberId = getMemberId(req);
  const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
  const memberIdError = memberRequired ? validateText(memberId, '成员 ID', MEMBER_ID_MAX_LENGTH) : null;

  return { familyCode, memberId, error: familyCodeError || memberIdError };
}

function handleError(error, res, next) {
  if (error instanceof SyntaxError) {
    return res.status(400).json({ success: false, message: '健康数据格式不正确' });
  }

  if (error instanceof TypeError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  if (error.statusCode) {
    return res.status(error.statusCode).json({ success: false, message: error.message });
  }

  return next(error);
}

async function listMembers(req, res, next) {
  try {
    const { familyCode, error } = validateFamilyAndMember(req);
    const device = await authenticate(req);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const data = await familyHealthService.listMembersByDevice(device.deviceId, familyCode);

    if (!data) {
      return sendMemberMissing(res);
    }

    return sendSuccess(res, data);
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getMember(req, res, next) {
  try {
    const { familyCode, memberId, error } = validateFamilyAndMember(req, true);
    const device = await authenticate(req);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const data = await familyHealthService.getMemberDetailByDevice(device.deviceId, familyCode, memberId);

    if (!data) {
      return sendMemberMissing(res);
    }

    return sendSuccess(res, data);
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function recordWeight(req, res, next) {
  try {
    const { familyCode, memberId, error } = validateFamilyAndMember(req, true);
    const device = await authenticate(req);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const data = await familyHealthService.recordWeightByDevice(device.deviceId, familyCode, memberId, req.body || {});

    if (!data) {
      return sendMemberMissing(res);
    }

    return sendSuccess(res, data);
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function updateGoal(req, res, next) {
  try {
    const { familyCode, memberId, error } = validateFamilyAndMember(req, true);
    const device = await authenticate(req);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const data = await familyHealthService.updateGoalByDevice(device.deviceId, familyCode, memberId, req.body || {});

    if (!data) {
      return sendMemberMissing(res);
    }

    return sendSuccess(res, data);
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getTrend(req, res, next) {
  try {
    const { familyCode, memberId, error } = validateFamilyAndMember(req, true);
    const device = await authenticate(req);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const data = await familyHealthService.getTrendByDevice(
      device.deviceId,
      familyCode,
      memberId,
      getInput(req, 'type')
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return sendSuccess(res, data);
  } catch (error) {
    return handleError(error, res, next);
  }
}

async function getRecommendations(req, res, next) {
  try {
    const { familyCode, memberId, error } = validateFamilyAndMember(req, true);
    const device = await authenticate(req);

    if (error) {
      return res.status(400).json({ success: false, message: error });
    }

    const data = await familyHealthService.getRecommendationsByDevice(
      device.deviceId,
      familyCode,
      memberId,
      getInput(req, 'goalType') || getInput(req, 'goal_type')
    );

    if (!data) {
      return sendMemberMissing(res);
    }

    return sendSuccess(res, data);
  } catch (error) {
    return handleError(error, res, next);
  }
}

module.exports = {
  listMembers,
  getMember,
  recordWeight,
  updateGoal,
  getTrend,
  getRecommendations
};
