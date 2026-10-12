/* ============================================================
   media.js — Pexels + Pixabay + Pollinations AI
   ============================================================ */

const Media = (() => {

  const PEXELS_PHOTO = 'https://api.pexels.com/v1/search';
  const PEXELS_VIDEO = 'https://api.pexels.com/videos/search';
  const PIXABAY_PHOTO = 'https://pixabay.com/api/';
  const PIXABAY_VIDEO = 'https://pixabay.com/api/videos/';
  const POLLINATIONS = 'https://image.pollinations.ai/prompt/';

  // ============ API KEY HELPERS ============
  function getKeys() {
    try {
      const raw = localStorage.getItem('sl_api_keys');
      return raw ? JSON.parse(raw) : {};
    } catch (e) {
      return {};
    }
  }

  // ============ POLLINATIONS AI IMAGE ============
  function buildPollinationsUrl(prompt, style, format) {
    // Style suffix
    const styleSuffix = DeepSeek.STYLE_PROMPT[style] || DeepSeek.STYLE_PROMPT['Realistis'];
    const fullPrompt = `${prompt}, ${styleSuffix}`;

    // Encode prompt untuk URL
    const encoded = encodeURIComponent(fullPrompt).replace(/%20/g, '+');

    // Ukuran berdasarkan format
    const width = format === 'Shorts' ? 720 : 1024;
    const height = format === 'Shorts' ? 1280 : 576;

    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      model: 'flux',
      nologo: 'true',
      seed: String(Math.floor(Math.random() * 999999))
    });

    return `${POLLINATIONS}${encoded}?${params.toString()}`;
  }

  // ============ PEXELS (PHOTOS) ============
  async function searchPexelsPhotos(keyword, format) {
    const keys = getKeys();
    if (!keys.pexels) return [];

    const orientation = format === 'Shorts' ? 'portrait' : 'landscape';
    const url = `${PEXELS_PHOTO}?query=${encodeURIComponent(keyword)}&per_page=5&orientation=${orientation}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': keys.pexels }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.photos || []).map(p => ({
        source: 'pexels',
        type: 'photo',
        url: p.src.large,
        thumb: p.src.medium,
        page: p.url
      }));
    } catch (e) {
      console.warn('Pexels photos error:', e);
      return [];
    }
  }

  // ============ PEXELS (VIDEOS) ============
  async function searchPexelsVideos(keyword, format) {
    const keys = getKeys();
    if (!keys.pexels) return [];

    const orientation = format === 'Shorts' ? 'portrait' : 'landscape';
    const url = `${PEXELS_VIDEO}?query=${encodeURIComponent(keyword)}&per_page=5&orientation=${orientation}`;

    try {
      const res = await fetch(url, {
        headers: { 'Authorization': keys.pexels }
      });
      if (!res.ok) return [];
      const data = await res.json();
      return (data.videos || []).map(v => {
        // Pilih file video kualitas SD/HD
        const file = (v.video_files || []).find(f => f.quality === 'sd' || f.quality === 'hd')
          || (v.video_files || [])[0];
        return {
          source: 'pexels',
          type: 'video',
          url: file ? file.link : '',
          thumb: v.image,
          page: v.url,
          duration: v.duration
        };
      }).filter(v => v.url);
    } catch (e) {
      console.warn('Pexels videos error:', e);
      return [];
    }
  }


  // ============ PIXABAY (PHOTOS) ============
  async function searchPixabayPhotos(keyword, format) {
    const keys = getKeys();
    if (!keys.pixabay) return [];

    const orientation = format === 'Shorts' ? 'vertical' : 'horizontal';
    const url = `${PIXABAY_PHOTO}?key=${keys.pixabay}&q=${encodeURIComponent(keyword)}&per_page=5&image_type=photo&orientation=${orientation}&safesearch=true`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.hits || []).map(p => ({
        source: 'pixabay',
        type: 'photo',
        url: p.largeImageURL || p.webformatURL,
        thumb: p.previewURL,
        page: p.pageURL
      }));
    } catch (e) {
      console.warn('Pixabay photos error:', e);
      return [];
    }
  }

  // ============ PIXABAY (VIDEOS) ============
  async function searchPixabayVideos(keyword) {
    const keys = getKeys();
    if (!keys.pixabay) return [];

    const url = `${PIXABAY_VIDEO}?key=${keys.pixabay}&q=${encodeURIComponent(keyword)}&per_page=5&safesearch=true`;

    try {
      const res = await fetch(url);
      if (!res.ok) return [];
      const data = await res.json();
      return (data.hits || []).map(v => ({
        source: 'pixabay',
        type: 'video',
        url: v.videos && v.videos.medium ? v.videos.medium.url : (v.videos && v.videos.small ? v.videos.small.url : ''),
        thumb: `https://i.vimeocdn.com/video/${v.picture_id}_295x166.jpg`,
        page: v.pageURL,
        duration: v.duration
      })).filter(v => v.url);
    } catch (e) {
      console.warn('Pixabay videos error:', e);
      return [];
    }
  }

  // ============ ORCHESTRATOR: fetch all media for a scene ============
  async function fetchSceneMedia(scene, format) {
    const keywords = scene.keyword_video || [];
    const kw1 = keywords[0] || scene.visual || scene.narasi || 'history';
    const kw2 = keywords[1] || kw1;

    // Cari dari semua sumber paralel
    const [pexelsPhotos1, pexelsVideos1, pixabayPhotos1, pixabayVideos1,
           pexelsPhotos2, pexelsVideos2, pixabayPhotos2, pixabayVideos2] = await Promise.all([
      searchPexelsPhotos(kw1, format),
      searchPexelsVideos(kw1, format),
      searchPixabayPhotos(kw1, format),
      searchPixabayVideos(kw1),
      searchPexelsPhotos(kw2, format),
      searchPexelsVideos(kw2, format),
      searchPixabayPhotos(kw2, format),
      searchPixabayVideos(kw2)
    ]);

    // Gabung & dedupe by URL
    const allMedia = [
      ...pexelsVideos1, ...pixabayVideos1, ...pexelsPhotos1, ...pixabayPhotos1,
      ...pexelsVideos2, ...pixabayVideos2, ...pexelsPhotos2, ...pixabayPhotos2
    ];
    const seen = new Set();
    const unique = allMedia.filter(m => {
      if (!m.url || seen.has(m.url)) return false;
      seen.add(m.url);
      return true;
    });

    // Ambil max 5 untuk preview
    const videos = unique.filter(m => m.type === 'video').slice(0, 5);
    const photos = unique.filter(m => m.type === 'photo').slice(0, 5);

    return {
      videos,
      photos,
      primary: videos[0] || photos[0] || null
    };
  }


  // ============ BATCH: fetch media untuk banyak scene ============
  async function fetchAllMedia(scenes, format, onProgress) {
    const total = scenes.length;
    const results = new Array(total);
    const CONCURRENCY = 3; // hindari rate limit

    for (let i = 0; i < total; i += CONCURRENCY) {
      const chunk = scenes.slice(i, i + CONCURRENCY);
      const chunkResults = await Promise.all(
        chunk.map(s => fetchSceneMedia(s, format))
      );
      for (let j = 0; j < chunkResults.length; j++) {
        results[i + j] = chunkResults[j];
      }
      if (onProgress) {
        onProgress({ done: Math.min(i + CONCURRENCY, total), total });
      }
    }

    return results;
  }

  // ============ FETCH ARTICLE (via r.jina.ai proxy) ============
  async function fetchArticle(url) {
    if (!url || !/^https?:\/\//i.test(url)) {
      throw new Error('URL tidak valid. Harus mulai dengan http:// atau https://');
    }
    const proxyUrl = 'https://r.jina.ai/' + url;

    try {
      const res = await fetch(proxyUrl, {
        headers: { 'Accept': 'text/plain' }
      });
      if (!res.ok) {
        throw new Error('Gagal fetch artikel (' + res.status + ')');
      }
      const text = await res.text();
      // r.jina.ai return markdown. Ambil 8000 char pertama (cukup untuk analisis)
      const trimmed = text.trim();
      // Coba extract judul dari "Title: ..." di awal
      let judul = '';
      const titleMatch = trimmed.match(/^Title:\s*(.+)$/m);
      if (titleMatch) judul = titleMatch[1].trim();

      const konten = trimmed.slice(0, 8000);

      return {
        url: url,
        judul: judul || 'Artikel dari ' + new URL(url).hostname,
        konten: konten
      };
    } catch (e) {
      console.error('fetchArticle error:', e);
      throw new Error('Gagal ambil artikel: ' + e.message);
    }
  }

  // ============ VISUALOGI: IMAGE URL BUILDER (16:9) ============
  function buildVisualogiImageUrl(prompt, opts) {
    opts = opts || {};
    const width = opts.width || 1280;
    const height = opts.height || 720;
    const seed = opts.seed || Math.floor(Math.random() * 999999);
    const encoded = encodeURIComponent(prompt).replace(/%20/g, '+');
    const params = new URLSearchParams({
      width: String(width),
      height: String(height),
      model: 'flux',
      nologo: 'true',
      seed: String(seed)
    });
    return `${POLLINATIONS}${encoded}?${params.toString()}`;
  }

  // Preload 1 gambar (return Promise true/false)
  function preloadImage(url, timeoutMs) {
    return new Promise((resolve) => {
      const img = new Image();
      let settled = false;
      const timer = setTimeout(() => {
        if (!settled) { settled = true; resolve(false); }
      }, timeoutMs || 45000);
      img.onload = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(true);
      };
      img.onerror = () => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        resolve(false);
      };
      img.src = url;
    });
  }

  // ============ CLOUDFLARE WORKERS AI (Flux Schnell) ============
  const CF_MODEL = '@cf/black-forest-labs/flux-1-schnell';
  const CF_ENDPOINT_BASE = 'https://api.cloudflare.com/client/v4/accounts/';

  function hasCloudflareKeys() {
    const keys = getKeys();
    return !!(keys.cloudflare_id && keys.cloudflare_token);
  }

  // Pre-clean prompt — hilangkan kata yang sering trigger NSFW false positive
  function sanitizePrompt(prompt) {
    if (!prompt) return '';
    let p = prompt;
    // Ganti kata yang sering trigger NSFW
    const replacements = {
      '\\bbody\\b': 'figure',
      '\\bnaked\\b': 'plain',
      '\\bbare\\b': 'simple',
      '\\bstomach\\b': 'torso area',
      '\\bbelly\\b': 'middle area',
      '\\bchest\\b': 'upper torso',
      '\\bskin\\b': 'surface',
      '\\bflesh\\b': 'tissue',
      '\\bblood\\b': 'red color',
      '\\bdead\\b': 'still',
      '\\bdeath\\b': 'ending',
      '\\bkilling\\b': 'action',
      '\\bkill\\b': 'stop',
      '\\bviolence\\b': 'intensity'
    };
    Object.keys(replacements).forEach(k => {
      p = p.replace(new RegExp(k, 'gi'), replacements[k]);
    });
    return p;
  }

  async function generateCloudflareImage(prompt, opts) {
    opts = opts || {};
    const keys = getKeys();
    if (!keys.cloudflare_id || !keys.cloudflare_token) {
      throw new Error('Cloudflare Account ID atau API Token belum diisi di Settings');
    }

    const url = CF_ENDPOINT_BASE + keys.cloudflare_id + '/ai/run/' + CF_MODEL;
    const attempt = opts._attempt || 1;

    // Prompt yang berbeda-beda per attempt
    let finalPrompt = sanitizePrompt(prompt);
    if (attempt === 1) {
      finalPrompt = finalPrompt;
    } else if (attempt === 2) {
      finalPrompt = 'clean educational illustration, ' + finalPrompt + ', simple cartoon style, family friendly, safe for work';
    } else if (attempt >= 3) {
      finalPrompt = 'minimalist flat icon illustration, ' + finalPrompt.split(',')[0] + ', educational graphic design, clean vector art';
    }

    const body = {
      prompt: finalPrompt,
      steps: 4
    };
    if (opts.seed) body.seed = opts.seed;

    let res;
    try {
      res = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': 'Bearer ' + keys.cloudflare_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(body)
      });
    } catch (e) {
      // Network error — retry max 2x dengan delay
      if (attempt < 3) {
        await new Promise(r => setTimeout(r, 1500 * attempt));
        return generateCloudflareImage(prompt, { ...opts, _attempt: attempt + 1 });
      }
      throw new Error('Network error: ' + e.message);
    }

    if (!res.ok) {
      let errMsg = 'Cloudflare (' + res.status + ')';
      let isNSFW = false;
      let isRateLimit = false;

      try {
        const errData = await res.json();
        if (errData.errors && errData.errors[0]) {
          const em = errData.errors[0].message || '';
          errMsg += ': ' + em.slice(0, 100);
          if (em.toLowerCase().includes('nsfw')) isNSFW = true;
          if (em.toLowerCase().includes('rate') || em.toLowerCase().includes('too many')) isRateLimit = true;
        }
      } catch (e) {
        try {
          const txt = await res.text();
          errMsg += ': ' + txt.slice(0, 100);
          if (txt.toLowerCase().includes('nsfw')) isNSFW = true;
          if (txt.toLowerCase().includes('rate')) isRateLimit = true;
        } catch (e2) {}
      }

      // Retry NSFW dengan prompt berbeda (max 3 attempt)
      if (isNSFW && attempt < 3) {
        console.warn('[CF] NSFW attempt ' + attempt + ' — retry dengan prompt diperhalus');
        await new Promise(r => setTimeout(r, 800));
        return generateCloudflareImage(prompt, { ...opts, _attempt: attempt + 1, seed: Math.floor(Math.random() * 999999) });
      }

      // Retry rate limit dengan delay lebih lama
      if (isRateLimit && attempt < 3) {
        console.warn('[CF] Rate limit — tunggu 5 detik...');
        await new Promise(r => setTimeout(r, 5000));
        return generateCloudflareImage(prompt, { ...opts, _attempt: attempt + 1 });
      }

      throw new Error(errMsg);
    }

    const blob = await res.blob();
    const dataUrl = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = () => reject(new Error('FileReader error'));
      reader.readAsDataURL(blob);
    });

    return dataUrl;
  }

  // ============ PUBLIC API ============
  return {
    buildPollinationsUrl,
    searchPexelsPhotos,
    searchPexelsVideos,
    searchPixabayPhotos,
    searchPixabayVideos,
    fetchSceneMedia,
    fetchAllMedia,
    fetchArticle,
    buildVisualogiImageUrl,
    preloadImage,
    generateCloudflareImage,
    hasCloudflareKeys
  };

})();

window.Media = Media;
