/* ============================================================
   deepseek.js — Wrapper DeepSeek API + Prompt Builder
   ============================================================ */

const DeepSeek = (() => {

  const ENDPOINT = 'https://api.deepseek.com/chat/completions';
  const MODEL = 'deepseek-chat';

  // ============ SYSTEM PROMPT ============
  const SYSTEM_PROMPT = `Kamu adalah penulis skenario video YouTube profesional spesialis konten edukasi (sejarah, agama, sains, politik).

TUGAS:
Buat storyboard lengkap berdasarkan judul yang diberikan user.
Riset sendiri topik tersebut, susun kronologi, dan bagi jadi scene.

KETENTUAN OUTPUT:
1. Bahasa Indonesia yang menarik & mengalir
2. Hanya gunakan fakta yang terdokumentasi
3. Setiap scene 5-6 detik
4. Variasikan diksi, jangan repetitif
5. Akhiri dengan refleksi/pelajaran moral
6. Output HARUS JSON valid, tanpa teks tambahan

FORMAT JSON (WAJIB array, bukan object):
[
  {
    "scene": 1,
    "start": 0,
    "end": 5,
    "narasi": "narasi bahasa Indonesia",
    "visual": "deskripsi visual detail",
    "tokoh": "nama tokoh yang muncul atau '-'",
    "emosi": "mood emosi scene",
    "keyword_video": ["keyword1", "keyword2"],
    "keyword_gambar": "prompt untuk AI image generator dalam bahasa Inggris"
  }
]

PENTING: Output harus berupa JSON object dengan key "scenes" yang berisi array di atas.`;

  // ============ STYLE MAPPER ============
  const STYLE_PROMPT = {
    'Realistis': 'cinematic photography, photorealistic, dramatic lighting, 8k, highly detailed, film grain',
    'Ilustrasi': 'digital illustration, vibrant colors, detailed line art, flat shading, concept art',
    'Sketsa': 'pencil sketch, hand-drawn, monochrome, detailed crosshatching, sketchbook style',
    'Anime': 'studio ghibli style, anime illustration, soft colors, detailed background, cel shaded',
    'Watercolor': 'watercolor painting, soft brush strokes, pastel colors, artistic, paper texture'
  };

  // ============ BUILD USER PROMPT ============
  function buildUserPrompt(opts) {
    const { judul, format, durasi, genre, style, konteks, jumlahScene, batchInfo } = opts;
    const styleDesc = STYLE_PROMPT[style] || STYLE_PROMPT['Realistis'];
    let prompt = `Judul: ${judul}
Format: ${format} (Long = 16:9 horizontal, Shorts = 9:16 vertikal)
Durasi: ${durasi} menit
Genre: ${genre}
Style Gambar: ${style} — ${styleDesc}
Konteks Tambahan: ${konteks || 'tidak ada'}

Buat ${jumlahScene} scene.`;

    if (batchInfo) {
      prompt += `

INI BAGIAN ${batchInfo.current} DARI ${batchInfo.total}.
Lanjutkan dari scene ke-${batchInfo.startScene} sampai scene ke-${batchInfo.endScene}.
Mulai dengan "scene": ${batchInfo.startScene}, dan akhiri dengan "scene": ${batchInfo.endScene}.`;
    }

    prompt += `

Ingat: output HARUS JSON object dengan key "scenes" berisi array.`;
    return prompt;
  }

  // ============ HELPER: estimate scene count ============
  function estimateScenes(durasiMenit) {
    // 5-6 detik per scene → rata-rata 5.5 detik
    return Math.round((durasiMenit * 60) / 5.5);
  }

  // ============ HELPERS ============
  function getApiKey() {
    try {
      const raw = localStorage.getItem('sl_api_keys');
      if (!raw) return '';
      const keys = JSON.parse(raw);
      return keys.deepseek || '';
    } catch (e) { return ''; }
  }

  function extractJSON(text) {
    if (!text) return null;
    let cleaned = text.trim();
    // Hapus markdown code fences kalau ada
    cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
    try {
      return JSON.parse(cleaned);
    } catch (e) {
      // Cari array JSON pertama
      const m = cleaned.match(/\[[\s\S]*\]/);
      if (m) {
        try { return JSON.parse(m[0]); } catch (e2) {}
      }
      const m2 = cleaned.match(/\{[\s\S]*\}/);
      if (m2) {
        try { return JSON.parse(m2[0]); } catch (e2) {}
      }
      return null;
    }
  }

  function normalizeScenes(parsed) {
    if (!parsed) return [];
    // Kalau object dengan key scenes
    if (parsed.scenes && Array.isArray(parsed.scenes)) return parsed.scenes;
    // Kalau array langsung
    if (Array.isArray(parsed)) return parsed;
    // Kalau object single scene
    if (parsed.scene && parsed.narasi) return [parsed];
    return [];
  }


  // ============ CALL API (single batch) ============
  async function callAPI(userPrompt) {
    const apiKey = getApiKey();
    if (!apiKey) {
      throw new Error('DeepSeek API key belum diisi. Buka Settings dulu.');
    }

    const body = {
      model: MODEL,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt }
      ],
      temperature: 0.7,
      max_tokens: 8000,
      response_format: { type: 'json_object' }
    };

    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer ' + apiKey
      },
      body: JSON.stringify(body)
    });

    if (!res.ok) {
      let errMsg = `DeepSeek error (${res.status})`;
      try {
        const errData = await res.json();
        if (errData.error && errData.error.message) errMsg += ': ' + errData.error.message;
      } catch (e) {}
      throw new Error(errMsg);
    }

    const data = await res.json();
    const content = data.choices && data.choices[0] && data.choices[0].message
      ? data.choices[0].message.content
      : '';

    const parsed = extractJSON(content);
    const scenes = normalizeScenes(parsed);

    if (!scenes.length) {
      throw new Error('DeepSeek tidak mengembalikan scene valid.');
    }
    return scenes;
  }

  // ============ GENERATE STORYBOARD (with batch handling) ============
  async function generateStoryboard(opts, onProgress) {
    const totalScenes = estimateScenes(opts.durasi);
    const BATCH_SIZE = 50;
    const batches = [];
    for (let i = 0; i < totalScenes; i += BATCH_SIZE) {
      batches.push({
        start: i + 1,
        end: Math.min(i + BATCH_SIZE, totalScenes),
        count: Math.min(BATCH_SIZE, totalScenes - i)
      });
    }

    const allScenes = [];
    const totalBatches = batches.length;

    for (let b = 0; b < totalBatches; b++) {
      const batch = batches[b];
      if (onProgress) {
        onProgress({
          batch: b + 1,
          totalBatches: totalBatches,
          startScene: batch.start,
          endScene: batch.end,
          countSoFar: allScenes.length
        });
      }

      const batchInfo = totalBatches > 1
        ? { current: b + 1, total: totalBatches, startScene: batch.start, endScene: batch.end }
        : null;

      const userPrompt = buildUserPrompt({
        judul: opts.judul,
        format: opts.format,
        durasi: opts.durasi,
        genre: opts.genre,
        style: opts.style,
        konteks: opts.konteks,
        jumlahScene: batch.count,
        batchInfo: batchInfo
      });

      const scenes = await callAPI(userPrompt);
      allScenes.push(...scenes);
    }

    // Re-number scene & re-timestamp biar konsisten
    const fixedScenes = allScenes.map((s, idx) => {
      const startSec = idx * 5;
      const endSec = startSec + 5;
      return {
        scene: idx + 1,
        start: startSec,
        end: endSec,
        narasi: s.narasi || '',
        visual: s.visual || '',
        tokoh: s.tokoh || '-',
        emosi: s.emosi || '',
        keyword_video: Array.isArray(s.keyword_video) ? s.keyword_video.slice(0, 3) : [],
        keyword_gambar: s.keyword_gambar || ''
      };
    });

    return fixedScenes;
  }


  // ============ PUBLIC API ============
  return {
    generateStoryboard,
    estimateScenes,
    buildUserPrompt,
    STYLE_PROMPT,
    // expose helper untuk testing
    _extractJSON: extractJSON,
    _normalizeScenes: normalizeScenes
  };

})();

// Expose global untuk dipakai app.js
window.DeepSeek = DeepSeek;
