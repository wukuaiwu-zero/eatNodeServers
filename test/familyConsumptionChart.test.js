const assert = require('node:assert/strict');
const test = require('node:test');

const {
  buildDailySeries,
  getConsumptionChartRanges,
  normalizeCalendarDate,
  normalizeChartRows
} = require('../src/services/familyConsumption.service');

test('builds current Beijing month with future days set to null', () => {
  const { month } = getConsumptionChartRanges(new Date('2026-08-04T02:00:00.000Z'));
  const series = buildDailySeries(month.startDate, month.endDate, '2026-08-04', new Map([
    ['2026-08-01', 12.5],
    ['2026-08-03', 20]
  ]));

  assert.equal(series.length, 31);
  assert.deepEqual(series.slice(0, 5), [
    { date: '2026-08-01', value: 12.5 },
    { date: '2026-08-02', value: 0 },
    { date: '2026-08-03', value: 20 },
    { date: '2026-08-04', value: 0 },
    { date: '2026-08-05', value: null }
  ]);
  assert.deepEqual(series.at(-1), { date: '2026-08-31', value: null });
});

test('builds the Monday to Sunday Beijing week with future days set to null', () => {
  const { week } = getConsumptionChartRanges(new Date('2026-08-04T02:00:00.000Z'));
  const series = buildDailySeries(week.startDate, week.endDate, '2026-08-04', new Map([
    ['2026-08-03', 8]
  ]));

  assert.deepEqual(series, [
    { date: '2026-08-03', value: 8 },
    { date: '2026-08-04', value: 0 },
    { date: '2026-08-05', value: null },
    { date: '2026-08-06', value: null },
    { date: '2026-08-07', value: null },
    { date: '2026-08-08', value: null },
    { date: '2026-08-09', value: null }
  ]);
});

test('normalizes category aggregate values for the daily drill-down chart', () => {
  assert.deepEqual(normalizeChartRows([
    { type: '蔬菜', value: '18.50' },
    { type: null, value: '2' }
  ]), [
    { type: '蔬菜', value: 18.5 },
    { type: '未分类', value: 2 }
  ]);
});

test('rejects invalid drill-down dates', () => {
  assert.throws(
    () => normalizeCalendarDate('2026-02-30'),
    { message: '日期格式不正确' }
  );
});
