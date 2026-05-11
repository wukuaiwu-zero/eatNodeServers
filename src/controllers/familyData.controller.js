const familyRecipeService = require('../services/familyRecipe.service');
const familyShoppingService = require('../services/familyShopping.service');
const familyIngredientService = require('../services/familyIngredient.service');

const MEMBER_CODE_MAX_LENGTH = 100;

function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : '';
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

async function getFamilyJsonData(req, res, next) {
  try {
    const memberCode = normalizeText(req.params.memberCode);
    const memberCodeError = validateMemberCode(memberCode);

    if (memberCodeError) {
      return res.status(400).json({ message: memberCodeError });
    }

    const member = await familyRecipeService.getFamilyMemberByCode(memberCode);

    if (!member) {
      return res.status(404).json({ message: 'Family member not found' });
    }

    const recipe = await familyRecipeService.getFamilyRecipeByCode(member.familyCode);
    const shoppingList = await familyShoppingService.listItemsByFamily(member.familyCode);
    const ingredientLibrary = await familyIngredientService.listItemsByFamily(member.familyCode);

    return res.json({
      data: {
        familyRecipe: recipe ? recipe.recipeJson : null,
        shoppingList,
        ingredientLibrary
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getFamilyJsonData
};
