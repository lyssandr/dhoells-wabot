// Smoke test: handler education menolak orang asing (Owner/Admin only).
// Ini mengunci perilaku yang diminta pada review PR #2.
// Dijalankan di direktori kerja sementara, karena modul utility membuat
// database/ dan temp_audio/ di process.cwd() saat di-require.
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
process.chdir(fs.mkdtempSync(path.join(os.tmpdir(), 'wabot-test-')));

const test = require('node:test');
const assert = require('node:assert/strict');
const { handleJadwal } = require('../modules/education/jadwal');
const { handleFisika } = require('../modules/education/fisika');
const { handleMatkul } = require('../modules/education/matkul');

function mockSock() {
    const sent = [];
    return {
        sent,
        sendMessage: async (_jid, content) => {
            sent.push(content.text || '');
        },
    };
}

const stranger = '628999999999@s.whatsapp.net';
const sender = '628999999999@s.whatsapp.net';
const msg = {};

test('jadwal menolak orang asing', async () => {
    const sock = mockSock();
    await handleJadwal(sock, sender, msg, stranger, '');
    assert.equal(sock.sent.length, 1);
    assert.match(sock.sent[0], /Owner\/Admin Bot/);
});

test('fisika menolak orang asing', async () => {
    const sock = mockSock();
    await handleFisika(sock, sender, msg, stranger, '');
    assert.equal(sock.sent.length, 1);
    assert.match(sock.sent[0], /Owner\/Admin Bot/);
});

test('matkul menolak orang asing', async () => {
    const sock = mockSock();
    await handleMatkul(sock, sender, msg, stranger, '');
    assert.equal(sock.sent.length, 1);
    assert.match(sock.sent[0], /Owner\/Admin Bot/);
});
