/**
 * Serviço de Tradução Gamer de Alta Performance (Powered by Gemini AI + MyMemory Fallback)
 * - Motor Primário: Google Gemini (gemini-3.5-flash-lite) com prompt gamer/MMORPG especializado
 * - Motor Secundário: MyMemory API (contingência)
 * - Cache LRU em memória para respostas instantâneas sem gastar cota
 */

const translationCache = new Map(); // hash -> { text, detectedLang, isSameLang }
const MAX_CACHE_SIZE = 2000;

let queue = [];
let isProcessing = false;

/**
 * Traduz texto entre PT e EN de forma contextual e precisa para MMORPG.
 */
async function translateText(text, targetLang = 'en', sourceLang = 'auto') {
  if (!text || typeof text !== 'string') return { text, detectedLang: 'unknown', isSameLang: true };
  const cleanText = text.trim();
  if (cleanText.length === 0) return { text, detectedLang: 'unknown', isSameLang: true };
  if (cleanText.length > 2500) return { text, detectedLang: 'unknown', isSameLang: true };

  // Ignora menções puras, links puros ou emojis isolados
  if (/^<@!?\d+>$/.test(cleanText)) return { text: cleanText, detectedLang: 'unknown', isSameLang: true };
  if (/^https?:\/\/\S+$/.test(cleanText)) return { text: cleanText, detectedLang: 'unknown', isSameLang: true };

  const cacheKey = `${sourceLang}_${targetLang}_${cleanText}`;
  if (translationCache.has(cacheKey)) {
    return translationCache.get(cacheKey);
  }

  return new Promise((resolve) => {
    queue.push({
      text: cleanText,
      targetLang,
      sourceLang,
      cacheKey,
      resolve
    });
    processQueue();
  });
}

/**
 * Motor Primário: Google Gemini AI (3.5 Flash Lite)
 */
async function tryGemini(text, targetLang) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error('GEMINI_API_KEY_NOT_FOUND');

  const targetDesc = targetLang.toLowerCase().startsWith('pt') ? 'Portuguese (PT-BR)' : 'English (US)';
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.5-flash-lite:generateContent?key=${apiKey}`;

  const payload = {
    systemInstruction: {
      parts: [
        {
          text: `You are an ultra-fast, real-time chat translator for a hardcore MMORPG Discord community (VAMPIR).
Translate the user input into natural, fluid ${targetDesc}.
Directives:
1. Preserve gamer terminology and slang (e.g. potar, raid, gank, build, stun, wipe, mak-ta, boss, tank, drop, farm, DPS).
2. Retain emojis, Discord mentions, markdown formatting, and punctuation exactly.
3. Output STRICTLY the raw translated text. DO NOT add quotes, markdown bullets, prefixes, notes, or explanations.`
        }
      ]
    },
    contents: [
      {
        parts: [
          { text: text }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2,
      maxOutputTokens: 1000
    }
  };

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(6000)
  });

  if (!res.ok) {
    const errText = await res.text().catch(() => '');
    throw new Error(`Gemini HTTP ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const rawResult = data.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!rawResult || !rawResult.trim()) {
    throw new Error('Gemini retornou texto vazio');
  }

  const translatedText = rawResult.trim();

  return {
    text: translatedText,
    detectedLang: targetLang === 'en' ? 'pt' : 'en',
    isSameLang: translatedText.toLowerCase() === text.toLowerCase()
  };
}

/**
 * Motor Secundário: MyMemory API (Fallback de emergência)
 */
async function tryMyMemory(text, targetLang, sourceLang) {
  const sLang = sourceLang === 'auto' ? (targetLang === 'en' ? 'pt' : 'en') : sourceLang;
  const langpair = `${sLang}|${targetLang}`;
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${encodeURIComponent(langpair)}`;

  const res = await fetch(url, {
    signal: AbortSignal.timeout(5000)
  });

  if (!res.ok) throw new Error(`MyMemory HTTP ${res.status}`);

  const data = await res.json();
  if (data?.responseData?.translatedText) {
    return {
      text: data.responseData.translatedText,
      detectedLang: sLang,
      isSameLang: false
    };
  }
  throw new Error('MyMemory resposta vazia');
}

async function processQueue() {
  if (isProcessing) return;
  if (queue.length === 0) return;

  isProcessing = true;

  while (queue.length > 0) {
    const item = queue.shift();
    let result = null;

    // 1. Tenta Gemini AI
    try {
      result = await tryGemini(item.text, item.targetLang);
    } catch (geminiErr) {
      // 2. Se Gemini falhar, cai para o MyMemory
      try {
        result = await tryMyMemory(item.text, item.targetLang, item.sourceLang);
      } catch (fallbackErr) {
        // 3. Se tudo falhar, mantém original com segurança
        result = {
          text: item.text,
          detectedLang: 'unknown',
          isSameLang: true
        };
      }
    }

    // Armazena no cache
    if (result && result.text) {
      if (translationCache.size >= MAX_CACHE_SIZE) {
        const firstKey = translationCache.keys().next().value;
        translationCache.delete(firstKey);
      }
      translationCache.set(item.cacheKey, result);
    }

    item.resolve(result);

    // Throttle suave de 150ms
    await new Promise(r => setTimeout(r, 150));
  }

  isProcessing = false;
}

module.exports = { translateText };
