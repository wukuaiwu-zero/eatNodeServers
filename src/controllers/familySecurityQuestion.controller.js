const deviceService = require('../services/device.service');
const familySecurityQuestionService = require('../services/familySecurityQuestion.service');
const { getDeviceCredentials } = require('../utils/request');

const FAMILY_CODE_MAX_LENGTH = 100;
const TEXT_MAX_LENGTH = 255;

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

async function setQuestion(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const question = normalizeText(getInput(req, 'question'));
    const answer = normalizeText(getInput(req, 'answer'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const questionError = validateText(question, '密保问题', TEXT_MAX_LENGTH);
    const answerError = validateText(answer, '密保答案', TEXT_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || questionError || answerError) {
      return res.status(400).json({ message: familyCodeError || questionError || answerError });
    }

    const data = await familySecurityQuestionService.setQuestionByDevice(
      device.deviceId,
      familyCode,
      question,
      answer
    );

    if (!data) {
      return res.status(403).json({ message: '当前设备还没有加入这个家庭' });
    }

    return res.json({ data });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function getQuestion(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const data = await familySecurityQuestionService.getPublicQuestion(familyCode);
    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function recoverFamily(req, res, next) {
  try {
    const familyCode = getFamilyCode(req);
    const answer = normalizeText(getInput(req, 'answer'));
    const familyCodeError = validateText(familyCode, '家庭码', FAMILY_CODE_MAX_LENGTH);
    const answerError = validateText(answer, '密保答案', TEXT_MAX_LENGTH);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || answerError) {
      return res.status(400).json({ message: familyCodeError || answerError });
    }

    const data = await familySecurityQuestionService.recoverFamilyByAnswer(
      device.deviceId,
      familyCode,
      answer
    );

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  setQuestion,
  getQuestion,
  recoverFamily
};
