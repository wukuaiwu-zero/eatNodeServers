const familyRecipeService = require('../services/familyRecipe.service');

const FAMILY_CODE_MAX_LENGTH = 100;
const MEMBER_CODE_MAX_LENGTH = 100;

function normalizeFamilyCode(familyCode) {
  return typeof familyCode === 'string' ? familyCode.trim() : '';
}

function getInput(req, key) {
  return req.body?.[key] ?? req.query?.[key] ?? req.params?.[key];
}

function normalizeMemberCode(memberCode) {
  return typeof memberCode === 'string' ? memberCode.trim() : '';
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

function validateMemberCode(memberCode) {
  if (!memberCode) {
    return 'memberCode is required';
  }

  if (memberCode.length > MEMBER_CODE_MAX_LENGTH) {
    return `memberCode must be ${MEMBER_CODE_MAX_LENGTH} characters or fewer`;
  }

  return null;
}

async function uploadFamilyRecipe(req, res, next) {
  try {
    const memberCode = normalizeMemberCode(getInput(req, 'memberCode') || getInput(req, 'membercode'));
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const memberCodeError = validateMemberCode(memberCode);
    const familyCodeError = validateFamilyCode(familyCode);

    if (memberCodeError) {
      return res.status(400).json({ message: memberCodeError });
    }

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    if (req.body.recipeJson === undefined || req.body.recipeJson === null) {
      return res.status(400).json({ message: 'recipeJson is required' });
    }

    const data = await familyRecipeService.upsertFamilyRecipeByMember(
      memberCode,
      familyCode,
      req.body.recipeJson
    );
    return res.json({ data });
  } catch (error) {
    if (error instanceof SyntaxError) {
      return res.status(400).json({ message: 'recipeJson must be valid JSON' });
    }

    return next(error);
  }
}

async function joinFamily(req, res, next) {
  try {
    const memberCode = normalizeMemberCode(getInput(req, 'memberCode') || getInput(req, 'membercode'));
    const familyCode = normalizeFamilyCode(getInput(req, 'familyCode') || getInput(req, 'familycode'));
    const memberCodeError = validateMemberCode(memberCode);
    const familyCodeError = validateFamilyCode(familyCode);

    if (memberCodeError) {
      return res.status(400).json({ message: memberCodeError });
    }

    if (familyCodeError) {
      return res.status(400).json({ message: familyCodeError });
    }

    const member = await familyRecipeService.joinFamily(memberCode, familyCode);
    return res.json({ data: member });
  } catch (error) {
    return next(error);
  }
}

async function getFamilyRecipeByMember(req, res, next) {
  try {
    const memberCode = normalizeMemberCode(getInput(req, 'memberCode') || getInput(req, 'membercode'));
    const memberCodeError = validateMemberCode(memberCode);

    if (memberCodeError) {
      return res.status(400).json({ message: memberCodeError });
    }

    const data = await familyRecipeService.getFamilyRecipeByMember(memberCode);

    if (!data) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    if (!data.recipe) {
      return res.status(404).json({ message: 'Family recipe not found' });
    }

    return res.json({ data });
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

    const recipe = await familyRecipeService.getFamilyRecipeByCode(familyCode);

    if (!recipe) {
      return res.status(404).json({ message: 'Family recipe not found' });
    }

    return res.json({ data: recipe });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  uploadFamilyRecipe,
  joinFamily,
  getFamilyRecipeByMember,
  getFamilyRecipe
};
