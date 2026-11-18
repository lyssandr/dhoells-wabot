// Smoke test: teks menu bisa dibangun tanpa socket WhatsApp.
// Dijalankan di direktori kerja sementara, karena modul utility membuat
// database/ dan temp_audio/ di process.cwd() saat di-require.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'wabot-test-')));

const test = require('node:test');
const assert = require('node:assert/strict');
const { buildMainMenuText, buildHelpListText, normalizeMenuCategory } = require('../modules/utility/help');

test('buildMainMenuText menghasilkan teks menu utama', () => {
    const text = buildMainMenuText('628123456789@s.whatsapp.net');
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 100);
    assert.match(text, /MENU UTAMA/);
});

test('buildHelpListText menghasilkan daftar bantuan', () => {
    const text = buildHelpListText();
    assert.equal(typeof text, 'string');
    assert.ok(text.length > 50);
});

test('normalizeMenuCategory mengenali kategori yang valid', () => {
    assert.equal(normalizeMenuCategory('rpg'), 'rpg');
    assert.equal(normalizeMenuCategory('  RPG  '), 'rpg');
});
