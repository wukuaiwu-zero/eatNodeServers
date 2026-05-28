const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const familyRecipeService = require('../services/familyRecipe.service');
const familyService = require('../services/family.service');
const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');
const { paginateDataList } = require('../utils/pagination');

const FAMILY_CODE_MAX_LENGTH = 100;
const RECIPE_ID_MAX_LENGTH = 100;
const MAX_COVER_IMAGE_BYTES = 4 * 1024 * 1024;
const COVER_UPLOAD_DIR = path.join(__dirname, '../../public/uploads/recipe-covers');
const IMAGE_TYPES = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif'
};

function normalizeFamilyCode(familyCode) {
  return typeof familyCode === 'string' ? familyCode.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
}

function validateFamilyCode(familyCode) {
  if (!familyCode) {
    return '请选择家庭';
  }

  if (familyCode.length > FAMILY_CODE_MAX_LENGTH) {
    return `家庭码太长了，不能超过 ${FAMILY_CODE_MAX_LENGTH} 个字符`;
  }

  return null;
}

function validateRecipeId(recipeId) {
  if (!recipeId) {
    return '请填写菜谱 ID';
  }

  if (recipeId.length > RECIPE_ID_MAX_LENGTH) {
    return `菜谱 ID 太长了，不能超过 ${RECIPE_ID_MAX_LENGTH} 个字符`;
  }

  return null;
}

function normalizeImageInput(req) {
  const raw = getInput(req, 'imageBase64') || getInput(req, 'imageData') || getInput(req, 'coverImage');

  if (!raw || typeof raw !== 'string') {
    throw new TypeError('请上传封面图片');
  }

  const dataUrlMatch = raw.match(/^data:(image\/(?:jpeg|png|webp|gif));base64,(.+)$/);
  const mimeType = dataUrlMatch ? dataUrlMatch[1] : normalizeFamilyCode(getInput(req, 'mimeType'));
  const base64 = dataUrlMatch ? dataUrlMatch[2] : raw;
  const ext = IMAGE_TYPES[mimeType];

  if (!ext) {
    throw new TypeError('封面图片格式不支持');
  }

  const buffer = Buffer.from(base64, 'base64');

  if (!buffer.length) {
    throw new TypeError('封面图片不能为空');
  }

  if (buffer.length > MAX_COVER_IMAGE_BYTES) {
    throw new TypeError('封面图片不能超过 4MB');
  }

  return {
    buffer,
    ext
  };
}

function saveCoverImage(familyCode, image) {
  const familyDir = path.join(COVER_UPLOAD_DIR, familyCode);
  fs.mkdirSync(familyDir, { recursive: true });

  const filename = `${Date.now().toString(36)}_${crypto.randomBytes(6).toString('hex')}.${image.ext}`;
  const filePath = path.join(familyDir, filename);
  fs.writeFileSync(filePath, image.buffer);

  return `/uploads/recipe-covers/${familyCode}/${filename}`;
}

function toRecipeListResponse(recipe, fallbackFamilyCode = '') {
  if (!recipe) {
    return {
      familyCode: fallbackFamilyCode,
      recipeList: []
    };
  }

  return {
    familyCode: recipe.familyCode,
    recipeList: recipe.recipes || []
  };
}

function withRecipeListResponse(data) {
  if (!data) {
    return data;
  }

  const { recipe, ...rest } = data;
  return {
    ...rest,
    ...toRecipeListResponse(recipe, data.member?.familyCode)
  };
}

async function uploadFamilyRecipe(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (req.body.recipeJson === undefined || req.body.recipeJson === null) {
      return res.status(400).json({ message: '请填写家庭菜谱数据' });
    }

    const data = await familyRecipeService.upsertFamilyRecipeByDevice(
      device.deviceId,
      familyCode,
      req.body.recipeJson,
      {
        coverUrl: getInput(req, 'coverUrl') || getInput(req, 'cover_url')
      }
    );
    return res.json({ data: withRecipeListResponse(data) });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '菜谱数据格式不正确' });
    }

    return next(error);
  }
}

async function uploadFamilyRecipeCover(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const image = normalizeImageInput(req);
    const coverUrl = saveCoverImage(familyCode, image);

    return res.json({
      data: {
        familyCode,
        coverUrl
      }
    });
  } catch (error) {
    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function handleFamilyRecipeItemUpsert(req, res, next, mode) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const recipeItem = req.body.recipeItemJson || req.body.recipeJson || req.body.recipe;
    const familyCodeError = validateFamilyCode(familyCode);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (recipeItem === undefined || recipeItem === null) {
      return res.status(400).json({ message: '请填写菜谱数据' });
    }

    const data = await familyRecipeService.upsertFamilyRecipeItemByDevice(
      device.deviceId,
      familyCode,
      recipeItem,
      {
        coverUrl: getInput(req, 'coverUrl') || getInput(req, 'cover_url'),
        mode
      }
    );

    return res.json({ data: withRecipeListResponse(data) });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: '菜谱数据格式不正确' });
    }

    if (error instanceof TypeError) {
      return res.status(400).json({ message: error.message });
    }

    return next(error);
  }
}

async function saveFamilyRecipeItem(req, res, next) {
  return handleFamilyRecipeItemUpsert(req, res, next, 'create');
}

async function updateFamilyRecipeItem(req, res, next) {
  return handleFamilyRecipeItemUpsert(req, res, next, 'update');
}

async function getFamilyRecipeItem(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const recipeId = normalizeFamilyCode(
      getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'recipeId')
    );
    const familyCodeError = validateFamilyCode(familyCode);
    const recipeIdError = validateRecipeId(recipeId);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || recipeIdError) {
      return res.status(400).json({ message: familyCodeError || recipeIdError });
    }

    const data = await familyRecipeService.getFamilyRecipeItemByDevice(
      device.deviceId,
      familyCode,
      recipeId
    );

    if (!data) {
      return res.status(404).json({ message: '菜谱不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function deleteFamilyRecipeItem(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const recipeId = normalizeFamilyCode(
      getInput(req, 'id') || getInput(req, '_id') || getInput(req, 'recipeId')
    );
    const familyCodeError = validateFamilyCode(familyCode);
    const recipeIdError = validateRecipeId(recipeId);
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (familyCodeError || recipeIdError) {
      return res.status(400).json({ message: familyCodeError || recipeIdError });
    }

    const data = await familyRecipeService.deleteFamilyRecipeItemByDevice(
      device.deviceId,
      familyCode,
      recipeId
    );

    if (!data) {
      return res.status(404).json({ message: '菜谱不存在' });
    }

    return res.json({ data });
  } catch (error) {
    return next(error);
  }
}

async function joinFamily(req, res, next) {
  try {
    const inviteCode = normalizeFamilyCode(getInput(req, 'inviteCode') || getInput(req, 'invitecode'));
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    if (!inviteCode) {
      return res.status(400).json({ message: '请输入邀请码' });
    }

    const member = await familyRecipeService.joinFamilyByInvite(device.deviceId, inviteCode);
    await familyRecipeService.ensureHomeFamilyForDevice(device.deviceId);
    const familySummary = await familyRecipeService.getFamilySummaryByDevice(device.deviceId);
    return res.json({
      data: {
        member,
        familyCodeList: familySummary.familyCodeList,
        families: familySummary.families
      }
    });
  } catch (error) {
    return next(error);
  }
}

async function getFamilyRecipeByMember(req, res, next) {
  try {
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    const data = await familyRecipeService.getFamilyRecipeByDevice(device.deviceId);

    if (!data) {
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    return res.json({ data: paginateDataList(req, withRecipeListResponse(data), 'recipeList') });
  } catch (error) {
    return next(error);
  }
}

async function getFamilyRecipe(req, res, next) {
  try {
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);
    await familyService.assertDeviceCanAccessFamily(device.deviceId, familyCode);

    const recipe = await familyRecipeService.getFamilyRecipeByCode(familyCode);

    return res.json({ data: paginateDataList(req, toRecipeListResponse(recipe, familyCode), 'recipeList') });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadFamilyRecipe,
  uploadFamilyRecipeCover,
  saveFamilyRecipeItem,
  updateFamilyRecipeItem,
  getFamilyRecipeItem,
  deleteFamilyRecipeItem,
  joinFamily,
  getFamilyRecipeByMember,
  getFamilyRecipe
};
