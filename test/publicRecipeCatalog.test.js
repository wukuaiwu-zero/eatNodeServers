const assert = require('node:assert/strict');
const test = require('node:test');

const {
  findByName,
  listRecipes,
  mergePoolDishes,
  mergeRecipes
} = require('../src/services/publicRecipeCatalog.service');

test('loads the four public recipes', () => {
  const recipes = listRecipes();
  assert.deepEqual(recipes.map((recipe) => recipe.name), [
    '皮蛋擂椒茄子拌面',
    '清蒸鱼（万能公式）',
    '蒜蓉粉丝虾滑煲',
    '蒸蛋羹（万能公式）'
  ]);
  assert.equal(recipes[0].id, 'public_pidan_qiezi_mian');
  assert.equal(recipes[0].type, '做饭');
  assert.equal(recipes[0].steps.length, 12);
  assert.equal(findByName('蒸蛋羹（万能公式）').ingredients[0].name, '鸡蛋');
});

test('merges public recipes without duplicating a family recipe of the same name', () => {
  const merged = mergeRecipes([
    { id: 'home_1', recipeId: 'home_1', name: '蒸蛋羹（万能公式）', source: 'family' }
  ], [], 'fam_1');

  assert.equal(merged.length, 4);
  assert.equal(merged.filter((recipe) => recipe.name === '蒸蛋羹（万能公式）').length, 1);
  assert.equal(merged.find((recipe) => recipe.name === '蒸蛋羹（万能公式）').id, 'home_1');
  assert.equal(merged.find((recipe) => recipe.id === 'public_qingzheng_yu').source, 'public');
});

test('hides a public dish and drops legacy copied defaults', () => {
  const dishes = mergePoolDishes([
    { dishId: 'default_dish_1', name: '番茄炒蛋', deleted: false, type: '做饭' },
    { dishId: 'public_zhengdan_geng', name: '蒸蛋羹（万能公式）', deleted: true, type: '做饭', manualWeight: 1, paused: false },
    { dishId: 'dish_home', name: '奶奶的红烧肉', deleted: false, type: '做饭', manualWeight: 2, paused: false }
  ], { familyCode: 'fam_1' });

  assert.deepEqual(dishes.map((dish) => dish.name), [
    '皮蛋擂椒茄子拌面',
    '清蒸鱼（万能公式）',
    '蒜蓉粉丝虾滑煲',
    '奶奶的红烧肉'
  ]);
  assert.equal(dishes[0].source, 'public');
  assert.equal(dishes[0].recipe.steps.length > 0, true);
  assert.equal(dishes.at(-1).source, 'family');
});
