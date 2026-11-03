const assert = require('node:assert/strict');
const test = require('node:test');

const {
  decorateShoppingItems,
  nameKey,
  normalizeAnchor,
  summarizeAnchors
} = require('../src/services/familyAnchorPrice.service');

test('name key ignores case and repeated spaces', () => {
  assert.equal(nameKey('  牛奶  '), '牛奶');
  assert.equal(nameKey('Milk  Tea'), nameKey('milk tea'));
});

test('default anchor is the price shown for a plain shopping name', () => {
  const summary = summarizeAnchors([
    { anchorId: 'a1', name: '牛奶', tag: null, anchorPrice: 12 },
    { anchorId: 'a2', name: '牛奶', tag: '伊利', anchorPrice: 10 },
    { anchorId: 'a3', name: '牛奶', tag: '盒马', anchorPrice: 15 }
  ]);

  assert.equal(summary.anchorPrice, 12);
  assert.equal(summary.anchorMin, 10);
  assert.equal(summary.anchorMax, 15);
  assert.equal(summary.anchorCount, 3);
  assert.equal(summary.matches[0].tag, null);
});

test('a single tagged anchor is used when there is no default', () => {
  const summary = summarizeAnchors([
    { anchorId: 'a2', name: '五花肉', tag: '菜市场', anchorPrice: 28 }
  ]);

  assert.equal(summary.anchorPrice, 28);
  assert.equal(summary.anchorCount, 1);
});

test('multiple tagged anchors without a default expose a range only', () => {
  const summary = summarizeAnchors([
    { anchorId: 'a2', name: '五花肉', tag: '菜市场', anchorPrice: 28 },
    { anchorId: 'a3', name: '五花肉', tag: '超市', anchorPrice: 45.5 }
  ]);

  assert.equal(summary.anchorPrice, null);
  assert.equal(summary.anchorMin, 28);
  assert.equal(summary.anchorMax, 45.5);
});

test('an explicit tag matches only that anchor', () => {
  const summary = summarizeAnchors([
    { anchorId: 'a1', name: '牛奶', tag: null, anchorPrice: 12 },
    { anchorId: 'a2', name: '牛奶', tag: '伊利', anchorPrice: 10 }
  ], { tag: '伊利' });

  assert.equal(summary.anchorPrice, 10);
  assert.equal(summary.anchorCount, 1);
  assert.equal(summary.matches[0].anchorId, 'a2');
});

test('shopping items pick anchors by normalized name', () => {
  const [milk, meat, egg] = decorateShoppingItems([
    { id: '1', name: ' 牛奶 ' },
    { id: '2', name: '五花肉' },
    { id: '3', name: '鸡蛋' }
  ], [
    { anchorId: 'a1', name: '牛奶', tag: null, anchorPrice: 12 },
    { anchorId: 'a2', name: '五花肉', tag: '菜市场', anchorPrice: 28 },
    { anchorId: 'a3', name: '五花肉', tag: '超市', anchorPrice: 45 }
  ]);

  assert.equal(milk.anchor.anchorPrice, 12);
  assert.equal(meat.anchor.anchorPrice, null);
  assert.deepEqual([meat.anchor.anchorMin, meat.anchor.anchorMax], [28, 45]);
  assert.equal(egg.anchor, null);
});

test('anchor price must be a non-negative number', () => {
  const anchor = normalizeAnchor({ name: '牛奶', anchorPrice: '12.50' });
  assert.equal(anchor.anchorPrice, 12.5);
  assert.equal(anchor.tag, null);
  assert.equal(anchor.tagKey, '');

  assert.throws(() => normalizeAnchor({ name: '牛奶', price: '12元' }), /锚定价格请填写数字/);
  assert.throws(() => normalizeAnchor({ name: '', anchorPrice: 1 }), /物件名称不能为空/);
});
