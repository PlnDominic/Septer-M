import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateArrival, allShippingOptions, shippingOptions, shippingCost } from '../dist/index.js';

// 2026-11-30 is a Monday.
const at = (day, h = 10, month = 10) => new Date(2026, month, day, h, 0);
const ymd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const range = (r) => [ymd(r.from), ymd(r.to)];

test('Monday morning, 2-4 working days -> Wed to Fri', () => {
  assert.deepEqual(range(estimateArrival(at(30), 2, 4)), ['2026-12-02', '2026-12-04']);
});
test('after the 1pm cutoff dispatch moves to the next working day', () => {
  assert.deepEqual(range(estimateArrival(at(30, 14), 2, 4)), ['2026-12-03', '2026-12-07']);
});
test('exactly at the cutoff counts as after it', () => {
  assert.deepEqual(range(estimateArrival(at(30, 13), 1, 1)), ['2026-12-02', '2026-12-02']);
});
test('express before cutoff arrives next working day', () => {
  assert.deepEqual(range(estimateArrival(at(30, 9), 1, 1)), ['2026-12-01', '2026-12-01']);
});
test('Friday morning express arrives Monday', () => {
  assert.deepEqual(range(estimateArrival(at(27, 9), 1, 1)), ['2026-11-30', '2026-11-30']);
});
test('weekend orders are dispatched Monday', () => {
  assert.deepEqual(range(estimateArrival(at(28, 11), 1, 2)), ['2026-12-01', '2026-12-02']); // Saturday
  assert.deepEqual(range(estimateArrival(at(29, 11), 1, 2)), ['2026-12-01', '2026-12-02']); // Sunday
});
test('crosses month and year ends', () => {
  assert.deepEqual(range(estimateArrival(new Date(2026, 11, 30, 9, 0), 2, 4)), ['2027-01-01', '2027-01-05']);
});
test('never returns a weekend date', () => {
  for (let h = 0; h < 24; h += 5) for (let d = 1; d <= 28; d++) {
    const r = estimateArrival(at(d, h), 1, 5);
    for (const x of [r.from, r.to]) assert.ok(x.getDay() !== 0 && x.getDay() !== 6, ymd(x));
    assert.ok(r.from <= r.to);
  }
});
test('does not mutate its input', () => {
  const now = at(30); const copy = new Date(now);
  estimateArrival(now, 2, 4);
  assert.equal(now.getTime(), copy.getTime());
});
test('every shipping option has a sensible delivery window', () => {
  for (const region of ['UK', 'GH']) for (const o of allShippingOptions(region)) assert.ok(o.minDays >= 1 && o.maxDays >= o.minDays, o.id);
  assert.deepEqual(allShippingOptions('GH').map((o) => o.id), ['gh-accra', 'gh-regional']);
});
test('shipping rules are unchanged by the refactor', () => {
  assert.deepEqual(shippingOptions('UK').map((o) => o.id), ['uk-standard', 'uk-express']);
  assert.equal(shippingOptions('GH', 'Greater Accra')[0].id, 'gh-accra');
  assert.equal(shippingOptions('GH', 'Ashanti')[0].id, 'gh-regional');
  const [std, express] = shippingOptions('UK');
  assert.equal(shippingCost(std, 3999), 395);
  assert.equal(shippingCost(std, 4000), 0);
  assert.equal(shippingCost(express, 99999), 695);
});
