import assert from 'node:assert/strict';
import { test } from 'node:test';

import { isThemeId, resolveThemeId } from './tokens';

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
