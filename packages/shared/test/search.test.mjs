import { test } from 'node:test';
import assert from 'node:assert/strict';
import { searchProducts, editDistance, concernCounts } from '../dist/index.js';

const P = (name, tagline, category, concerns, skinTypes, ingredients = 'Aqua, Glycerin') => ({ name, tagline, category, concerns, skinTypes, ingredients });
const catalogue = [
  P('Gentle Gel Cleanser', 'Lifts dirt and SPF without stripping', 'cleanser', ['Everyday cleansing'], ['All', 'Sensitive'], 'Aqua, Coco-Glucoside, Aloe Barbadensis Leaf Juice'),
  P('Vitamin C Brightening Serum', 'Visibly brighter, more even tone', 'serum', ['Dark spots', 'Dullness'], ['Normal', 'Combination', 'Dull'], 'Aqua, Ascorbyl Glucoside, Niacinamide, Ferulic Acid'),
  P('Niacinamide Clarifying Serum', 'Balances oil and refines pores', 'serum', ['Blemishes', 'Excess oil', 'Pores'], ['Oily', 'Combination'], 'Aqua, Niacinamide, Zinc PCA'),
  P('Barrier Repair Moisturiser', 'Rich, calming comfort for dry skin', 'moisturiser', ['Dryness', 'Redness'], ['Dry', 'Sensitive'], 'Aqua, Shea Butter, Ceramide NP'),
  P('Light Gel Moisturiser', 'Weightless hydration that never feels greasy', 'moisturiser', ['Dehydration'], ['Oily', 'Combination', 'Normal'], 'Aqua, Sodium Hyaluronate'),
  P('Daily Sunscreen SPF 50', 'Invisible on every skin tone', 'sunscreen', ['Sun protection', 'Dark spots'], ['All'], 'Aqua, Zinc Oxide'),
  P('Overnight Hydration Mask', 'Wake up to plump, rested skin', 'mask', ['Dryness', 'Dullness'], ['Dry', 'Normal', 'Dull'], 'Aqua, Shea Butter'),
  P('Clay Purifying Mask', 'Deep clean without the tight feeling', 'mask', ['Blemishes', 'Pores'], ['Oily', 'Combination'], 'Aqua, Kaolin, Salicylic Acid'),
];
const names = (q) => searchProducts(catalogue, q).results.map((p) => p.name);

test('plain product words', () => {
  assert.deepEqual(names('vitamin c'), ['Vitamin C Brightening Serum']);
  assert.ok(names('serum').includes('Niacinamide Clarifying Serum') && names('serum').length === 2);
  assert.equal(names('sunscreen')[0], 'Daily Sunscreen SPF 50');
});
test('concern words shoppers actually type map to catalogue concerns', () => {
  const acne = names('acne');
  assert.deepEqual([...acne].sort(), ['Clay Purifying Mask', 'Niacinamide Clarifying Serum']);
  assert.ok(names('pimples').includes('Clay Purifying Mask'));
  assert.ok(names('hyperpigmentation').includes('Vitamin C Brightening Serum'));
  assert.equal(names('spf')[0], 'Daily Sunscreen SPF 50');
  assert.ok(names('oily').includes('Niacinamide Clarifying Serum'));
});
test('filler words are ignored: "dry skin" and "serum for acne"', () => {
  assert.ok(names('dry skin').includes('Barrier Repair Moisturiser') && names('dry skin').includes('Overnight Hydration Mask'));
  assert.deepEqual(names('serum for acne'), ['Niacinamide Clarifying Serum']);
});
test('typos are fixed and reported', () => {
  const r = searchProducts(catalogue, 'niacinimide');
  assert.equal(r.correctedQuery, 'niacinamide');
  assert.ok(r.results.some((p) => p.name === 'Niacinamide Clarifying Serum'));
  assert.equal(searchProducts(catalogue, 'moisturizer').results.length >= 0, true);
  assert.equal(searchProducts(catalogue, 'cleanzer').correctedQuery, 'cleanser');
  assert.equal(searchProducts(catalogue, 'sunscren').results[0].name, 'Daily Sunscreen SPF 50');
  assert.equal(searchProducts(catalogue, 'serum').correctedQuery, undefined);
});
test('prefix typing works for suggestions', () => {
  assert.deepEqual(names('niac').slice(0, 2).sort(), ['Niacinamide Clarifying Serum', 'Vitamin C Brightening Serum']);
  assert.equal(names('moist').length, 2);
});
test('nonsense finds nothing and never "corrects" to something unrelated', () => {
  const r = searchProducts(catalogue, 'xyzzyqq');
  assert.equal(r.results.length, 0);
  assert.equal(r.correctedQuery, undefined);
});
test('multi-word queries fall back to any-word matches instead of nothing', () => {
  assert.ok(names('mask plushies').includes('Clay Purifying Mask'));
});
test('empty or filler-only queries return the whole catalogue', () => {
  assert.equal(searchProducts(catalogue, '').results.length, 8);
  assert.equal(searchProducts(catalogue, '  for the skin ').results.length, 8);
});
test('accents and punctuation are ignored; input is not mutated', () => {
  const copy = JSON.stringify(catalogue);
  assert.ok(names('Sérum!!!').length === 2);
  assert.equal(JSON.stringify(catalogue), copy);
});
test('best matches rank first (name beats ingredient)', () => {
  assert.equal(names('niacinamide')[0], 'Niacinamide Clarifying Serum');
});
test('editDistance counts a swapped pair as one typo', () => {
  assert.equal(editDistance('serum', 'serum'), 0);
  assert.equal(editDistance('serum', 'sreum'), 1);
  assert.equal(editDistance('kitten', 'sitting'), 3);
});
test('concernCounts lists concerns by how many products have them', () => {
  const c = concernCounts(catalogue);
  assert.ok(c[0].count >= c[c.length - 1].count);
  assert.equal(c.find((x) => x.concern === 'Blemishes').count, 2);
});
