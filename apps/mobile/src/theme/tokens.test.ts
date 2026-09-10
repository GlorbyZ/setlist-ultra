import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isThemeId, resolveThemeId, THEMES, TYPE_SCALE } from './tokens';

test('system follows OS light and dark', () => {
  assert.equal(resolveThemeId('system', false), 'ultra-light');
  assert.equal(resolveThemeId('system', true), 'ultra-dark');
});

test('forced themes stay forced', () => {
  assert.equal(resolveThemeId('ultra-light', true), 'ultra-light');
  assert.equal(resolveThemeId('ultra-dark', false), 'ultra-dark');
  assert.equal(resolveThemeId('stage', true), 'stage');
});

test('theme ids include system', () => {
  assert.equal(isThemeId('system'), true);
  assert.equal(isThemeId('neon'), false);
});

test('type scale is bound on every theme', () => {
  for (const theme of Object.values(THEMES)) {
    assert.equal(theme.type.title.fontSize, TYPE_SCALE.title.fontSize);
    assert.equal(theme.type.chart.lineHeight, TYPE_SCALE.chart.lineHeight);
    assert.ok(theme.type.chart.lineHeight > theme.type.chart.fontSize);
  }
});
