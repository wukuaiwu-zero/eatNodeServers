const familyService = require('../services/family.service');
const familyRecipeService = require('../services/familyRecipe.service');

const FAMILY_CODE_MAX_LENGTH = 100;
const FAMILY_NAME_MAX_LENGTH = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
}

function normalizeNullableText(value) {
  if (value === undefined || value === null) {
    return null;
  }

  const normalized = normalizeText(value);
  return normalized || null;
}

function validateFamilyCode(familyCode) {
  if (!familyCode) {
    return 'familyCode is required';
  }

  if (familyCode.length > FAMILY_CODE_MAX_LENGTH) {
    return `familyCode must be ${FAMILY_CODE_MAX_LENGTH} characters or fewer`;
  }

  return null;
}

function validateFamilyName(familyName) {
  if (familyName && familyName.length > FAMILY_NAME_MAX_LENGTH) {
    return `familyName must be ${FAMILY_NAME_MAX_LENGTH} characters or fewer`;
  }

  return null;
}

async function createFamily(req, res, next) {
  try {
    const familyCode = normalizeText(req.body.familyCode);
    const familyName = normalizeNullableText(req.body.familyName);
    const familyCodeError = validateFamilyCode(familyCode);
    const familyNameError = validateFamilyName(familyName);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (familyNameError) {
      return res.status(400).json({ message: familyNameError });
    }

    const family = await familyService.createFamily(familyCode, familyName);
    return res.status(201).json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function getFamily(req, res, next) {
  try {
    const familyCode = normalizeText(req.params.familyCode);
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const family = await familyService.getFamilyByCode(familyCode);

    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function updateFamily(req, res, next) {
  try {
    const familyCode = normalizeText(req.params.familyCode);
    const familyName = normalizeNullableText(req.body.familyName);
    const familyCodeError = validateFamilyCode(familyCode);
    const familyNameError = validateFamilyName(familyName);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (familyNameError) {
      return res.status(400).json({ message: familyNameError });
    }

    const family = await familyService.updateFamily(familyCode, familyName);

    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function deleteFamily(req, res, next) {
  try {
    const familyCode = normalizeText(req.params.familyCode);
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const family = await familyService.deleteFamily(familyCode);

    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
    }

    return res.json({ data: family });
  } catch (error) {
    return next(error);
  }
}

async function listFamilyMembers(req, res, next) {
  try {
    const familyCode = normalizeText(req.params.familyCode);
    const familyCodeError = validateFamilyCode(familyCode);

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const family = await familyService.getFamilyByCode(familyCode);

    if (!family) {
      return res.status(404).json({ message: 'Family not found' });
    }

    const members = await familyRecipeService.listFamilyMembers(familyCode);
    return res.json({ data: members });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  createFamily,
  getFamily,
  updateFamily,
  deleteFamily,
  listFamilyMembers
};
