const familyRecipeService = require('../services/familyRecipe.service');
const familyShoppingService = require('../services/familyShopping.service');
const familyIngredientService = require('../services/familyIngredient.service');

const MEMBER_CODE_MAX_LENGTH = 100;

// 聚合接口给前端做“进入应用后一把拉齐数据”用。
// 它不负责写入，只负责根据 memberCode 找到家庭，再把家庭菜谱、购物清单、食材库拼成一个响应。

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
      // 这里返回 404 的原因通常是数据库里还没有 family_members 记录。
      // 解决方式：先上传一次家庭菜谱/购物清单/食材库，或执行 mock seed。
      return res.status(404).json({ message: 'Family member not found' });
    }

    // 这三个查询都用 member.familyCode，而不是让前端传 familyCode。
    // 这样可以避免用户拿着别人的 familyCode 直接读到别的家庭数据。
    const recipe = await familyRecipeService.getFamilyRecipeByCode(member.familyCode);
    const shoppingList = await familyShoppingService.listItemsByFamily(member.familyCode);
    const ingredientLibrary = await familyIngredientService.listItemsByFamily(member.familyCode);

    // 返回字段明确拆成三块：
    // - familyRecipe：当前仍是整份 JSON。
    // - shoppingList：购物清单 item 数组。
    // - ingredientLibrary：食材库 item 数组。
    // 三者不要混在一起，给后续不同业务逻辑留空间。
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
