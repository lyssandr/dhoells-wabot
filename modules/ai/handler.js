/**
 * @file handler.js
 * @description Professional AI Command Handlers for conversation, voice notes,
 *              text synthesis, and vision analysis.
 * @author OWL ABE
 * @version 3.2.0
 * @license MIT
 */

const fs = require('fs');
const path = require('path');
const { callAI } = require('./engine');
const { generateTikTokTTS } = require('./tts');
const { downloadMediaMessage } = require('@whiskeysockets/baileys');

/**
 * Base personality for Claryn AI.
 */
const BASE_PERSONA = `Nama kamu adalah Claryn, AI Assistant yang cerdas, ramah, berwawasan luas, dan solutif.
Karakter: komunikatif, lugas, solutif, dan profesional namun tetap bersahabat.
Gunakan Bahasa Indonesia yang natural, tertata rapi, dan mudah dipahami.
Berikan jawaban langsung ke inti pertanyaan secara jelas, akurat, dan berbobot tanpa bertele-tele.`;

const MEMORY_FILE = path.join(__dirname, '../../database/memories.json');
let userMemories = new Map();

// Load persistent memory on startup
if (fs.existsSync(MEMORY_FILE)) {
    try {
        const raw = fs.readFileSync(MEMORY_FILE, 'utf8');
        const parsed = JSON.parse(raw);
        userMemories = new Map(Object.entries(parsed));
    } catch (e) { 
        console.error('[Memory] Gagal membaca riwayat memori:', e.message); 
    }
}

/**
 * Saves current user memories to disk.
 */
function saveMemory() {
    try {
        const obj = Object.fromEntries(userMemories);
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(obj, null, 2));
    } catch (e) { 
        console.error('[Memory] Gagal menyimpan memori:', e.message); 
    }
}

/**
 * Identifies the user in context.
 */
function getUserLine(pushName, sender) {
    const name = pushName || sender.split('@')[0];
    return `Pengguna: ${name}`;
}

/**
 * Builds contextualized prompts with time and role awareness.
 */
function buildPrompt(mode, text, pushName, sender, historyText = '') {
    const userLine = getUserLine(pushName, sender);
    
    // Inject Realtime Date & Time (WIB / UTC+7)
    const now = new Date();
    const wibTime = new Date(now.getTime() + (7 * 60 * 60 * 1000) + (now.getTimezoneOffset() * 60 * 1000));
    const days = ['Minggu', 'Senin', 'Selasa', 'Rabu', 'Kamis', 'Jumat', 'Sabtu'];
    const months = ['Januari', 'Februari', 'Maret', 'April', 'Mei', 'Juni', 'Juli', 'Agustus', 'September', 'Oktober', 'November', 'Desember'];
    
    const timeString = `WAKTU SISTEM: ${days[wibTime.getDay()]}, ${wibTime.getDate()} ${months[wibTime.getMonth()]} ${wibTime.getFullYear()}, ${wibTime.getHours().toString().padStart(2, '0')}:${wibTime.getMinutes().toString().padStart(2, '0')} WIB.`;
    const context = `${BASE_PERSONA}

${userLine}
${timeString}

`;

    const MODE_PROMPTS = {
        ai: `${context}Jawab pesan berikut secara solutif, terstruktur, dan jelas sesuai topik bahasan.

${historyText}Pesan dari ${pushName || 'User'}:
${text}`,
        aivn: `${context}Jawab pesan berikut secara ringkas untuk dibacakan via Voice Note audio (maksimal 2-3 kalimat, bahasa lisan yang luwes, tanpa simbol/emoji atau tanda baca visual aneh).

${historyText}Pesan dari ${pushName || 'User'}:
${text}`,
        rephrase: `${context}Parafrase teks berikut agar lebih natural, mengalir, dan mudah dipahami tanpa mengubah maksud aslinya. Berikan langsung hasil parafrase tanpa pengantar.

Teks:
${text}`,
        rangkum: `${context}Buat ringkasan padat dan jelas dari teks berikut dengan poin-poin utama yang esensial. Berikan langsung hasil ringkasan.

Teks:
${text}`,
        puitis: `${context}Tulis ulang teks berikut dalam gaya bahasa puitis dan estetis dengan pilihan diksi yang bernas. Berikan langsung hasilnya.

Teks:
${text}`,
        formal: `${context}Tulis ulang teks berikut dalam ragam bahasa baku, profesional, dan akademik yang presisi. Berikan langsung hasilnya.

Teks:
${text}`,
        santai: `${context}Tulis ulang teks berikut dalam gaya percakapan santai, akrab, dan luwes khas obrolan harian yang sopan tanpa kata kasar. Berikan langsung hasilnya.

Teks:
${text}`,
        eli5: `${context}Jelaskan konsep berikut dengan sangat sederhana dan analogi konkret yang mudah dipahami anak kecil/orang awam. Berikan langsung penjelasannya.

Teks:
${text}`,
        terjemah: `${context}Terjemahkan teks berikut secara akurat dan kontekstual (Deteksi otomatis: Indonesia <-> Inggris atau bahasa internasional lainnya). Berikan langsung hasil terjemahannya.

Teks:
${text}`
    };

    return (MODE_PROMPTS[mode] || MODE_PROMPTS.ai);
}

// Command formatting maps
const MODE_MAP = { 
    rephrase: 'rephrase', parafrase: 'rephrase', humanize: 'rephrase', 
    rangkum: 'rangkum', summary: 'rangkum', 
    puitis: 'puitis', 
    formal: 'formal', 
    santai: 'santai', 
    eli5: 'eli5', 
    terjemah: 'terjemah', translate: 'terjemah' 
};

const MODE_LABELS = { 
    rephrase: '🔄 PARAFRASE', 
    rangkum: '📋 RANGKUMAN', 
    puitis: '🌸 PUITIS', 
    formal: '👔 FORMAL', 
    santai: '☕ SANTAI', 
    eli5: '💡 ELI5', 
    terjemah: '🌐 TERJEMAHAN' 
};

/**
 * Handles standard AI chat & Multimodal Vision analysis.
 */
async function handleAi(sock, sender, msg, participant, textMessage) {
    let inputText = textMessage;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!inputText && contextInfo?.quotedMessage) {
        inputText = contextInfo.quotedMessage.conversation 
            || contextInfo.quotedMessage.extendedTextMessage?.text 
            || contextInfo.quotedMessage.imageMessage?.caption 
            || '';
    }

    // Support Vision (analisis gambar langsung atau di-quote)
    let imageBuffer = null;
    let mimeType = 'image/jpeg';
    const isImageDirect = msg.message?.imageMessage;
    const isImageQuoted = contextInfo?.quotedMessage?.imageMessage;
    
    if (isImageDirect) {
        try {
            imageBuffer = await downloadMediaMessage(msg, 'buffer', {});
            mimeType = msg.message.imageMessage.mimetype || 'image/jpeg';
        } catch (e) {
            console.error('[AI Vision] Gagal download gambar langsung:', e.message);
        }
    } else if (isImageQuoted) {
        try {
            const quotedMsgObj = { message: contextInfo.quotedMessage };
            imageBuffer = await downloadMediaMessage(quotedMsgObj, 'buffer', {});
            mimeType = contextInfo.quotedMessage.imageMessage.mimetype || 'image/jpeg';
        } catch (e) {
            console.error('[AI Vision] Gagal download gambar yang di-quote:', e.message);
        }
    }

    if (!inputText && imageBuffer) {
        inputText = 'Deskripsikan dan jelaskan isi gambar ini secara informatif.';
    }
    
    if (!inputText && !imageBuffer) { 
        await sock.sendMessage(sender, { 
            text: `📌 *.claryn <pertanyaan/gambar>*

Contoh:
▸ *.claryn bagaimana cara kerja internet?*
▸ Kirim/balas gambar dengan caption *.claryn jelaskan gambar ini*` 
        }, { quoted: msg }); 
        return; 
    }

    await sock.sendMessage(sender, { text: '✨ _Claryn sedang memproses tanggapan..._' }, { quoted: msg });
    const pushName = msg?.pushName || null;

    let historyArr = userMemories.get(sender) || [];
    let historyText = '';
    if (historyArr.length > 0) {
        historyText = `[Riwayat Percakapan Sebelumnya]\n` + historyArr.map(x => `${x.role}: ${x.msg}`).join('\n') + "\n\n";
    }

    try { 
        const response = await callAI(buildPrompt('ai', inputText, pushName, sender, historyText), imageBuffer, mimeType); 
        if (!response) { 
            await sock.sendMessage(sender, { 
                text: '❌ Layanan AI sedang tidak dapat merespons. Silakan coba kembali beberapa saat lagi.' 
            }, { quoted: msg }); 
            return; 
        } 
        
        // Memory rolling window (max 30 exchanges)
        historyArr.push({ role: pushName || 'User', msg: inputText });
        historyArr.push({ role: 'Claryn', msg: response });
        if (historyArr.length > 60) historyArr = historyArr.slice(historyArr.length - 60);
        
        userMemories.set(sender, historyArr);
        saveMemory();

        await sock.sendMessage(sender, { text: `╭━━━〔 *✨ Claryn AI* 〕━━━

${response}` }, { quoted: msg }); 
    } catch (e) { 
        console.error('[AI Handler Error]', e.message);
        await sock.sendMessage(sender, { text: '❌ Terjadi kendala saat memproses permintaan AI.' }, { quoted: msg }); 
    }
}

/**
 * Handles AI chat and responds with a Voice Note (PTT).
 */
async function handleAiVn(sock, sender, msg, participant, textMessage) {
    let inputText = textMessage;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!inputText && contextInfo?.quotedMessage) {
        inputText = contextInfo.quotedMessage.conversation 
            || contextInfo.quotedMessage.extendedTextMessage?.text 
            || '';
    }
    
    if (!inputText) { 
        await sock.sendMessage(sender, { 
            text: `📌 *.clarynvn <pesan>*

Contoh:
▸ *.clarynvn ceritakan fakta menarik tentang sains hari ini*` 
        }, { quoted: msg }); 
        return; 
    }

    await sock.sendMessage(sender, { text: '🎙️ _Claryn sedang merekam suara..._' }, { quoted: msg });
    const pushName = msg?.pushName || null;

    let historyArr = userMemories.get(sender) || [];
    let historyText = '';
    if (historyArr.length > 0) {
        historyText = `[Riwayat Percakapan Sebelumnya]\n` + historyArr.map(x => `${x.role}: ${x.msg}`).join('\n') + "\n\n";
    }

    try { 
        const response = await callAI(buildPrompt('aivn', inputText, pushName, sender, historyText)); 
        if (!response) { 
            await sock.sendMessage(sender, { text: '❌ Layanan AI tidak dapat menghasilkan respons.' }, { quoted: msg }); 
            return; 
        } 
        
        historyArr.push({ role: pushName || 'User', msg: inputText });
        historyArr.push({ role: 'Claryn', msg: response });
        if (historyArr.length > 60) historyArr = historyArr.slice(historyArr.length - 60);
        userMemories.set(sender, historyArr);
        saveMemory();

        const audioBuffer = await generateTikTokTTS(response);
        if (audioBuffer) {
            await sock.sendMessage(sender, { audio: audioBuffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, { quoted: msg }); 
        } else {
            await sock.sendMessage(sender, { text: `╭━━━〔 *✨ Claryn AI (Voice Fallback)* 〕━━━

${response}` }, { quoted: msg }); 
        }
    } catch (e) { 
        console.error('[AI VN Handler Error]', e.message);
        await sock.sendMessage(sender, { text: '❌ Terjadi kendala saat menghasilkan voice note.' }, { quoted: msg }); 
    }
}

/**
 * Handles text synthesis modes (rephrase, summarize, translate, etc.).
 */
async function handleRephrase(sock, sender, msg, participant, textMessage, command) {
    let inputText = textMessage;
    const contextInfo = msg.message?.extendedTextMessage?.contextInfo;
    if (!inputText && contextInfo?.quotedMessage) {
        inputText = contextInfo.quotedMessage.conversation 
            || contextInfo.quotedMessage.extendedTextMessage?.text 
            || '';
    }
    
    if (!inputText) { 
        await sock.sendMessage(sender, { 
            text: `📌 *.${command} <teks>* atau balas pesan yang ingin diproses dengan *.${command}*` 
        }, { quoted: msg }); 
        return; 
    }

    const mode = MODE_MAP[command] || 'rephrase'; 
    const label = MODE_LABELS[mode];
    await sock.sendMessage(sender, { text: `⏳ _Sedang memproses ${label.toLowerCase()}..._` }, { quoted: msg });
    
    const pushName = msg?.pushName || null;
    
    try { 
        const response = await callAI(buildPrompt(mode, inputText, pushName, sender)); 
        if (!response) { 
            await sock.sendMessage(sender, { text: '❌ Layanan pemrosesan teks tidak tersedia saat ini.' }, { quoted: msg }); 
            return; 
        } 
        await sock.sendMessage(sender, { text: `╭━━━〔 *${label}* 〕━━━

${response}` }, { quoted: msg }); 
    } catch (e) { 
        console.error('[Rephrase Handler Error]', e.message);
        await sock.sendMessage(sender, { text: '❌ Gagal memproses teks.' }, { quoted: msg }); 
    }
}

module.exports = { 
    handleAi, 
    handleAiVn, 
    handleRephrase 
};
