const assert = require('assert');
const {
  typeBoost,
  recencyEatBoost,
  recencyDrawBoost,
  freshBoost,
  defaultBoost,
  manualBoost,
  favoriteBoost,
  commonBoost,
  difficultyTimeBoost,
  inventoryBoost,
  expiryBoost,
  tasteBoost,
  healthBoost,
  intentBoost,
  weatherBoost,
  consumptionTypeBoost,
  parseDurationMinutes,
  getDifficultyBucket,
  weightedSampleWithoutReplacement,
  hitAvoid,
  clamp
} = require('../src/services/familyRecipePoolDraw.service')._internals;

function testRecencyEatBoost() {
  assert.strictEqual(recencyEatBoost(0).value, 0.25);
  assert.strictEqual(recencyEatBoost(2).value, 0.55);
  assert.strictEqual(recencyEatBoost(5).value, 0.75);
  assert.strictEqual(recencyEatBoost(10).value, 0.9);
  assert.strictEqual(recencyEatBoost(20).value, 1.05);
  assert.strictEqual(recencyEatBoost(undefined).value, 1.05);
}

function testTypeBoost() {
  assert.strictEqual(
    typeBoost('外卖', { isWorkday: true, hour: 21, intent: 'normal' }).value,
    1.45
  );
  assert.strictEqual(
    typeBoost('做饭', { isWorkday: false, hour: 12, intent: 'normal' }).value,
    1.25
  );
  assert.strictEqual(
    typeBoost('做饭', { isWorkday: true, hour: 21, intent: 'quick' }).value,
    0.75
  );
}

function testFreshAndDefault() {
  assert.strictEqual(defaultBoost(true).value, 0.85);
  assert.strictEqual(defaultBoost(false).value, 1);
  assert.strictEqual(freshBoost('2026-11-02', '2026-11-03').value, 1.25);
  assert.strictEqual(freshBoost('2026-10-01', '2026-11-03').value, 1);
}

function testManualFavoriteCommon() {
  assert.strictEqual(manualBoost(2).value, 2);
  assert.strictEqual(manualBoost(9).value, 3);
  assert.strictEqual(favoriteBoost({ favorite: true }).value, 1.35);
  assert.strictEqual(favoriteBoost(null).value, 1);
  assert.strictEqual(
    commonBoost('番茄炒蛋', '晚餐', { 晚餐: ['番茄炒蛋'], 午餐: [] }).value,
    1.2
  );
  assert.strictEqual(
    commonBoost('番茄炒蛋', '早餐', { 晚餐: ['番茄炒蛋'], 午餐: [] }).value,
    1.05
  );
}

function testDifficultyAndDuration() {
  assert.strictEqual(parseDurationMinutes('20分钟'), 20);
  assert.strictEqual(parseDurationMinutes('1小时'), 60);
  assert.strictEqual(getDifficultyBucket({ difficulty: '简单', duration: '40分钟' }), 'easy');
  assert.strictEqual(getDifficultyBucket({ difficulty: '', duration: '50分钟' }), 'hard');
  assert.strictEqual(
    difficultyTimeBoost({ difficulty: '简单', duration: '15分钟' }, {
      intent: 'quick',
      isWorkday: true,
      hour: 20
    }).value,
    1.3
  );
  assert.strictEqual(
    difficultyTimeBoost({ difficulty: '难', duration: '60分钟' }, {
      intent: 'normal',
      isWorkday: true,
      hour: 20
    }).value,
    0.55
  );
}

function testInventoryAndExpiry() {
  const inventory = new Map([
    ['猪里脊', { name: '猪里脊', expireDate: '2026-11-04' }],
    ['青椒', { name: '青椒', expireDate: null }]
  ].map(([name, value]) => [name.toLowerCase(), value]));
  const recipe = {
    ingredients: [
      { name: '猪里脊', isSeasoning: false },
      { name: '青椒', isSeasoning: false },
      { name: '生抽', isSeasoning: true }
    ]
  };

  assert.strictEqual(inventoryBoost(recipe, inventory).value, 1.35);
  assert.strictEqual(expiryBoost(recipe, inventory, '2026-11-03', 'normal').value, 1.5);
  assert.strictEqual(expiryBoost(recipe, inventory, '2026-11-03', 'clear_fridge').value, 1.8);

  const poorRecipe = {
    ingredients: [
      { name: '牛腩', isSeasoning: false },
      { name: '土豆', isSeasoning: false }
    ]
  };
  assert.strictEqual(inventoryBoost(poorRecipe, inventory).value, 0.7);
}

function testHitAvoid() {
  assert.strictEqual(hitAvoid('香菜牛肉', [], ['香菜']), true);
  assert.strictEqual(hitAvoid('番茄炒蛋', [{ name: '香菜' }], ['香菜']), true);
  assert.strictEqual(hitAvoid('番茄炒蛋', [{ name: '鸡蛋' }], ['香菜']), false);
}

function testP2Boosts() {
  assert.strictEqual(recencyDrawBoost({ skips: 3 }).value, 0.5);
  assert.strictEqual(recencyDrawBoost({ skips: 0, drawnPending: true }).value, 0.8);
  assert.strictEqual(tasteBoost('清淡番茄炒蛋', { category: '家常菜' }, ['清淡']).value, 1.15);
  assert.strictEqual(healthBoost('油炸鸡翅', { category: '小吃' }, '减脂').value, 0.75);
  assert.strictEqual(healthBoost('鸡胸肉沙拉', { category: '轻食' }, '减脂').value, 1.2);
  assert.strictEqual(healthBoost('牛肉饭', { category: '主食', ingredients: [{ name: '牛肉' }] }, '增肌').value, 1.15);
  assert.strictEqual(intentBoost('healthy', 1.2).value, 1.1);
  assert.strictEqual(weatherBoost('凉拌黄瓜', { category: '凉菜' }, 'hot').value, 1.2);
  assert.strictEqual(weatherBoost('番茄蛋汤', { category: '汤羹' }, 'rain').value, 1.15);
  assert.strictEqual(consumptionTypeBoost('做饭', true).value, 1.2);
  assert.strictEqual(consumptionTypeBoost('外卖', true).value, 0.7);
  assert.strictEqual(consumptionTypeBoost('做饭', false).value, 1);
}

function testWeightedSample() {
  const items = [
    { score: 1, name: 'a' },
    { score: 1, name: 'b' },
    { score: 1, name: 'c' }
  ];
  const picked = weightedSampleWithoutReplacement(items, 2);
  assert.strictEqual(picked.length, 2);
  assert.strictEqual(new Set(picked.map((item) => item.name)).size, 2);
  assert.strictEqual(clamp(100, 0.05, 8), 8);
  assert.strictEqual(clamp(0.01, 0.05, 8), 0.05);
}

testRecencyEatBoost();
testTypeBoost();
testFreshAndDefault();
testManualFavoriteCommon();
testDifficultyAndDuration();
testInventoryAndExpiry();
testHitAvoid();
testP2Boosts();
testWeightedSample();

console.log('familyRecipePoolDraw.test.js passed');
