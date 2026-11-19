// Smoke test: downloadImage menolak file yang melebihi batas ukuran.
// Dijalankan tanpa internet: server HTTP lokal yang menyajikan body besar.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const { downloadImage, MAX_DOWNLOAD_BYTES } = require('../modules/media/scraper');

function serve(body, headers = {}) {
    const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream', ...headers });
        res.end(body);
    });
    return new Promise((resolve) => {
        server.listen(0, '127.0.0.1', () => {
            resolve({ server, url: `http://127.0.0.1:${server.address().port}/file` });
        });
    });
}

test('batas default 16 MB', () => {
    assert.equal(MAX_DOWNLOAD_BYTES, 16 * 1024 * 1024);
});

test('downloadImage mengembalikan buffer untuk file kecil', async (t) => {
    const { server, url } = await serve(Buffer.from('hello'));
    t.after(() => server.close());
    const buf = await downloadImage(url);
    assert.equal(buf.toString(), 'hello');
});

test('downloadImage menolak body yang melebihi maxBytes (content-length)', async (t) => {
    const big = Buffer.alloc(2048, 'x');
    const { server, url } = await serve(big, { 'Content-Length': String(big.length) });
    t.after(() => server.close());
    await assert.rejects(
        downloadImage(url, { maxBytes: 1024 }),
        (err) => err.code === 'DOWNLOAD_TOO_LARGE'
    );
});

test('downloadImage menolak body yang melebihi maxBytes (chunked, tanpa content-length)', async (t) => {
    const server = http.createServer((_req, res) => {
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.write(Buffer.alloc(1500, 'y'));
        res.end();
    });
    await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
    t.after(() => server.close());
    const url = `http://127.0.0.1:${server.address().port}/file`;
    await assert.rejects(
        downloadImage(url, { maxBytes: 1024 }),
        (err) => err.code === 'DOWNLOAD_TOO_LARGE'
    );
});
