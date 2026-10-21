/**
 * @file engine.js
 * @description Core AI processing engine featuring Multimodal (Vision) support,
 *              Multi-Key Rotation and Fallback strategies.
 *              Integrates Google Gemini (Primary) and Pollinations (Fallback) endpoints.
 * @author OWL ABE
 * @version 3.1.0
 * @license MIT
 */

const axios = require('axios');
const { BOT_CONFIG } = require('../../config');

/**
 * Sends a prompt (and optional image) to AI models with multi-key rotation and fallbacks.
 * 
 * @param {string} prompt - Text prompt
 * @param {Buffer|string|null} imageBuffer - Optional image buffer or base64 string
 * @param {string} mimeType - Optional mimeType (e.g. image/jpeg, image/png)
 * @returns {Promise<string|null>}
 */
async function callAI(prompt, imageBuffer = null, mimeType = 'image/jpeg') {
    let result = null;
    const { GEMINI_API_KEYS } = BOT_CONFIG;

    // --- PHASE 1: PRIMARY ENGINE (GOOGLE GEMINI MULTIMODAL) ---
    if (Array.isArray(GEMINI_API_KEYS) && GEMINI_API_KEYS.length > 0) {
        for (const apiKey of GEMINI_API_KEYS) {
            if (!apiKey || apiKey === 'YOUR_GEMINI_API_KEY') continue;
            
            const models = ['gemini-2.5-flash-lite', 'gemini-2.5-flash', 'gemini-1.5-flash'];
            
            for (const model of models) {
                try {
                    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
                    
                    const parts = [{ text: prompt }];
                    if (imageBuffer) {
                        const base64Data = Buffer.isBuffer(imageBuffer) 
                            ? imageBuffer.toString('base64') 
                            : imageBuffer;
                        parts.push({
                            inlineData: {
                                mimeType: mimeType || 'image/jpeg',
                                data: base64Data
                            }
                        });
                    }

                    const payload = {
                        contents: [{ parts }],
                        generationConfig: { 
                            temperature: 0.85, 
                            topP: 0.95, 
                            maxOutputTokens: 4096 
                        }
                    };

                    const { data } = await axios.post(url, payload, { 
                        headers: { 'Content-Type': 'application/json' }, 
                        timeout: 35000 
                    });

                    result = data?.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (result) return result.trim();
                } catch (error) {
                    const status = error.response?.status || error.message;
                    console.warn(`[AI Engine] Gemini ${model} (Key: ...${apiKey.slice(-4)}) execution failed: ${status}`);
                    if (error.response?.status === 400 && !imageBuffer) continue; 
                }
            }
        }
    }

    // --- PHASE 2: FALLBACK ENGINE (POLLINATIONS POST API - Text Only) ---
    if (!result && !imageBuffer) {
        try {
            console.warn('[AI Engine] Primary engine failed. Triggering fallback: Pollinations (POST)');
            const payload = {
                messages: [{ role: 'user', content: prompt }],
                model: 'openai',
                seed: Math.floor(Math.random() * 100000)
            };

            const { data } = await axios.post('https://text.pollinations.ai/', payload, { 
                headers: { 'Content-Type': 'application/json' }, 
                timeout: 45000 
            });

            const responseText = typeof data === 'string' ? data : data?.choices?.[0]?.message?.content;
            if (responseText?.trim()) return responseText.trim();
        } catch (error) {
            console.error(`[AI Engine] Fallback POST failed: ${error.message}`);
        }
    }

    // --- PHASE 3: TERTIARY FALLBACK (POLLINATIONS GET API - Text Only) ---
    if (!result && !imageBuffer) {
        try {
            console.warn('[AI Engine] Secondary engine failed. Triggering tertiary fallback: Pollinations (GET)');
            const encodedPrompt = encodeURIComponent(prompt);
            const { data } = await axios.get(`https://text.pollinations.ai/${encodedPrompt}?model=openai&seed=${Date.now()}`, { 
                timeout: 45000 
            });

            if (data && typeof data === 'string' && data.trim()) return data.trim();
        } catch (error) {
            console.error(`[AI Engine] Tertiary GET failed: ${error.message}`);
        }
    }

    return null;
}

module.exports = { 
    callAI 
};
