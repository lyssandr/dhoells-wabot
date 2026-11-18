// Smoke test: config bisa dimuat dan package.json konsisten.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { BOT_CONFIG } = require('../config');

test('config memuat BOT_CONFIG dengan nilai yang diharapkan', () => {
    assert.equal(typeof BOT_CONFIG.TEMP_DIR, 'string');
    assert.ok(BOT_CONFIG.TEMP_DIR.length > 0);
    assert.ok(Array.isArray(BOT_CONFIG.GEMINI_API_KEYS));
    assert.ok(BOT_CONFIG.GEMINI_API_KEYS.length > 0);
    assert.equal(typeof BOT_CONFIG.DAILY_COOLDOWN, 'number');
});

test('package.json punya script test dan engines Node >= 22', () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'package.json'), 'utf8'));
    assert.equal(pkg.scripts.test, 'node --test');
    assert.match(pkg.engines.node, />=\s*22/);
});
