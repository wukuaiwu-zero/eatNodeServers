const familyRecipeService = require('../services/familyRecipe.service');
const familyShoppingService = require('../services/familyShopping.service');
const familyIngredientService = require('../services/familyIngredient.service');
const familyShoppingCategoryService = require('../services/familyShoppingCategory.service');
const familyIngredientCategoryService = require('../services/familyIngredientCategory.service');
const familyRecipeCategoryService = require('../services/familyRecipeCategory.service');
const familyRecipePoolService = require('../services/familyRecipePool.service');
const deviceService = require('../services/device.service');
const { getDeviceCredentials } = require('../utils/request');

// 聚合接口给前端做“进入应用后一把拉齐数据”用。
// 它不负责写入，只根据匿名设备身份找到家庭，再拼出家庭菜谱、购物清单、食材库。

async function getFamilyJsonData(req, res, next) {
  try {
    const { deviceId, deviceSecret } = getDeviceCredentials(req);
    const device = await deviceService.authenticateDevice(deviceId, deviceSecret);

    const member = await familyRecipeService.getFamilyMemberByDevice(device.deviceId);

    if (!member) {
      // 这里返回 404 的原因通常是数据库里还没有 family_members 记录。
      // 解决方式：先上传一次家庭菜谱/购物清单/食材库，或执行 mock seed。
      return res.status(404).json({ message: '家庭成员不存在' });
    }

    // 这三个查询都用 member.familyCode，而不是让前端传 familyCode。
    // 这样可以避免用户拿着别人的 familyCode 直接读到别的家庭数据。
    const recipe = await familyRecipeService.getFamilyRecipeByCode(member.familyCode);
    const shoppingList = await familyShoppingService.listItemsByFamily(member.familyCode);
    const ingredientLibrary = await familyIngredientService.listItemsByFamily(member.familyCode);
    const shoppingCategories = await familyShoppingCategoryService.listCategoriesByFamily(member.familyCode);
    const ingredientCategories = await familyIngredientCategoryService.listCategoriesByFamily(member.familyCode);
    const recipeCategories = await familyRecipeCategoryService.listCategoriesByFamily(member.familyCode);
    const recipePoolItems = await familyRecipePoolService.listDishesByFamily(member.familyCode);

    // 返回字段明确拆成三块：
    // - familyRecipe：兼容旧字段，值为 { recipes: [...] }。
    // - familyRecipes：字段化后的菜谱数组。
    // - shoppingList：购物清单 item 数组。
    // - ingredientLibrary：食材库 item 数组。
    // 三者不要混在一起，给后续不同业务逻辑留空间。
    return res.json({
      data: {
        familyRecipe: recipe ? recipe.recipeJson : null,
        familyRecipes: recipe ? recipe.recipes : [],
        shoppingList,
        ingredientLibrary,
        shoppingCategories,
        ingredientCategories,
        recipeCategories,
        recipePoolItems
      }
    });
  } catch (error) {
    return next(error);
  }
}

module.exports = {
  getFamilyJsonData
};
