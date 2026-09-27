/* ============================================================
   app.js — Main Logic (Form, State, Render, Nav)
   ============================================================ */

(function () {

  const state = {
    currentProject: null,
    isGenerating: false,
    abortGenerate: false
  };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const els = {
    navBtns: $$('.nav-btn'),
    pages: $$('.page'),
    form: $('#generate-form'),
    btnGenerate: $('#btn-generate'),
    judul: $('#judul'),
    konteks: $('#konteks'),
    genre: $('#genre'),
    progressSub: $('#progress-sub'),
    progressBar: $('#progress-bar'),
    progressPct: $('#progress-pct'),
    stepList: $('#step-list'),
    btnCancel: $('#btn-cancel'),
    sbJudul: $('#sb-judul'),
    sbMeta: $('#sb-meta'),
    sceneList: $('#scene-list'),
    btnBackInput: $('#btn-back-input'),
    btnSaveProject: $('#btn-save-project'),
    btnExport: $('#btn-export'),
    projectsList: $('#projects-list'),
    projectsEmpty: $('#projects-empty'),
    btnRefreshProjects: $('#btn-refresh-projects'),
    keyDeepseek: $('#key-deepseek'),
    keyPexels: $('#key-pexels'),
    keyPixabay: $('#key-pixabay'),
    defaultStyle: $('#default-style'),
    btnSaveKeys: $('#btn-save-keys'),
    saveStatus: $('#save-status'),
    modalExport: $('#modal-export'),
    modalExportClose: $('#modal-export-close'),
    toast: $('#toast')
  };

  function showPage(name) {
    els.pages.forEach(p => p.classList.remove('active'));
    els.navBtns.forEach(b => b.classList.remove('active'));
    const page = document.getElementById('page-' + name);
    if (page) page.classList.add('active');
    const btn = document.querySelector(`.nav-btn[data-page="${name}"]`);
    if (btn) btn.classList.add('active');
    if (name === 'projects') renderProjectsList();
    if (name === 'settings') loadSettingsForm();
  }

  els.navBtns.forEach(btn => {
    btn.addEventListener('click', () => showPage(btn.dataset.page));
  });

  let toastTimer = null;
  function showToast(msg, type) {
    els.toast.textContent = msg;
    els.toast.className = 'toast show' + (type ? ' ' + type : '');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('show'), 2800);
  }

  function getRadioValue(name) {
    const el = document.querySelector(`input[name="${name}"]:checked`);
    return el ? el.value : '';
  }

  function secToTimestamp(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
  }

  // ============ PROGRESS UI ============
  function setProgress(pct, subText) {
    const p = Math.max(0, Math.min(100, Math.round(pct)));
    els.progressBar.style.width = p + '%';
    els.progressPct.textContent = p + '%';
    if (subText) els.progressSub.textContent = subText;
  }

  function setStep(step, status) {
    const li = els.stepList.querySelector(`.step[data-step="${step}"]`);
    if (!li) return;
    li.classList.remove('active', 'done');
    if (status === 'active') li.classList.add('active');
    if (status === 'done') li.classList.add('done');
  }

  function resetSteps() {
    els.stepList.querySelectorAll('.step').forEach(li => {
      li.classList.remove('active', 'done');
    });
    setProgress(0, 'Mohon tunggu, ini bisa memakan 1-2 menit');
  }

  // ============ FORM SUBMIT ============
  els.form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (state.isGenerating) return;

    const judul = els.judul.value.trim();
    if (!judul) {
      showToast('Judul wajib diisi', 'error');
      els.judul.focus();
      return;
    }

    const keys = Store.getApiKeys();
    if (!keys.deepseek) {
      showToast('DeepSeek API key belum diisi. Buka Settings.', 'error');
      showPage('settings');
      return;
    }

    const durasiRaw = getRadioValue('durasi') || 'auto';
    const opts = {
      judul: judul,
      format: getRadioValue('format') || 'Long',
      durasi: durasiRaw === 'auto' ? 'auto' : parseInt(durasiRaw, 10),
      genre: els.genre.value,
      style: getRadioValue('style') || 'Realistis',
      konteks: els.konteks.value.trim(),
      includeVideo: !!document.getElementById('include-video')?.checked
    };

    state.isGenerating = true;
    state.abortGenerate = false;
    els.btnGenerate.disabled = true;

    showPage('progress');
    resetSteps();

    try {
      // STEP 1: DeepSeek - riset + buat script
      setStep(1, 'active');
      setProgress(5, 'Meriset cerita dan menyusun kronologi...');

      const scenes = await DeepSeek.generateStoryboard(opts, (info) => {
        if (info.isAuto) {
          setProgress(30, 'AI meriset & menyusun storyboard (mode Auto)...');
        } else {
          const pct = 10 + (info.batch / info.totalBatches) * 40;
          setProgress(pct, `Batch ${info.batch}/${info.totalBatches} — scene ${info.startScene}-${info.endScene}...`);
        }
      });

      if (state.abortGenerate) throw new Error('Dibatalkan oleh user');

      setStep(1, 'done');
      setStep(2, 'done');
      setProgress(55, `${scenes.length} scene selesai dibuat`);

      // STEP 2: Media (Pexels + Pixabay)
      setStep(3, 'active');
      setProgress(58, 'Mencari video & foto dari Pexels + Pixabay...');

      const mediaResults = await Media.fetchAllMedia(scenes, opts.format, (info) => {
        const pct = 58 + (info.done / info.total) * 25;
        setProgress(pct, `Mencari media... ${info.done}/${info.total}`);
      });

      if (state.abortGenerate) throw new Error('Dibatalkan oleh user');

      // Sisipkan media ke scenes
      scenes.forEach((s, i) => {
        const m = mediaResults[i] || { videos: [], photos: [], primary: null };
        s.video_urls = [...m.videos, ...m.photos];
        s.media_primary = m.primary;
      });
      setStep(3, 'done');

      // STEP 3: Pollinations AI Images
      setStep(4, 'active');
      setProgress(85, 'Menggenerate gambar AI...');

      scenes.forEach((s) => {
        s.ai_image_url = Media.buildPollinationsUrl(
          s.keyword_gambar || s.visual || s.narasi,
          opts.style,
          opts.format
        );
      });
      setStep(4, 'done');

      // STEP 4: Done
      setStep(5, 'done');
      setProgress(100, 'Selesai!');

      // Simpan sebagai current project
      state.currentProject = {
        id: null,
        judul: opts.judul,
        format: opts.format,
        durasi: opts.durasi,
        genre: opts.genre,
        style: opts.style,
        konteks: opts.konteks,
        scenes: scenes
      };

      // Render storyboard
      setTimeout(() => {
        renderStoryboard(state.currentProject);
        showPage('storyboard');
        showToast(`✅ Storyboard selesai! ${scenes.length} scene`, 'success');
      }, 500);

    } catch (err) {
      console.error(err);
      showToast('❌ ' + err.message, 'error');
      showPage('input');
    } finally {
      state.isGenerating = false;
      els.btnGenerate.disabled = false;
    }
  });

  // ============ CANCEL ============
  els.btnCancel.addEventListener('click', () => {
    state.abortGenerate = true;
    showToast('Membatalkan...', 'error');
  });

  // ============ RENDER STORYBOARD ============
  function formatDuration(sec) {
    const m = Math.floor(sec / 60);
    const s = Math.round(sec % 60);
    if (m === 0) return s + 's';
    if (s === 0) return m + 'm';
    return m + 'm ' + s + 's';
  }

  function renderStoryboard(project) {
    els.sbJudul.textContent = project.judul;
    const sceneCount = project.scenes.length;
    const lastScene = project.scenes[sceneCount - 1];
    const totalSec = lastScene ? lastScene.end : 0;

    let durasiLabel;
    if (project.durasi === 'auto') {
      durasiLabel = 'Auto (~' + formatDuration(totalSec) + ')';
    } else {
      durasiLabel = project.durasi + ' menit';
    }
    const vidIcon = project.scenes[0] && project.scenes[0].prompt_video && project.scenes[0].prompt_video !== '-' ? ' 🎬' : '';
    els.sbMeta.textContent = `${project.format} · ${durasiLabel} · ${project.genre} · ${project.style} · ${sceneCount} scene${vidIcon}`;

    els.sceneList.innerHTML = '';
    project.scenes.forEach((s, idx) => {
      els.sceneList.appendChild(buildSceneCard(s, idx));
    });
  }

  function buildPromptCards(scene) {
    const items = [
      { key: "image", icon: "🎨", label: "Universal", val: scene.prompt_image },
      { key: "midjourney", icon: "🖼️", label: "Midjourney", val: scene.prompt_midjourney },
      { key: "dalle", icon: "🌌", label: "DALL-E 3", val: scene.prompt_dalle },
      { key: "sd", icon: "⚙️", label: "Stable Diffusion", val: scene.prompt_sd }
    ];
    if (scene.prompt_video && scene.prompt_video !== "-") {
      items.push({ key: "video", icon: "🎬", label: "Video (Runway/Kling)", val: scene.prompt_video });
    }

    const cards = items.filter(it => it.val && it.val !== "-").map(it => {
      const safeVal = escapeHtml(it.val);
      const extra = it.key === "sd" && scene.prompt_sd_negative
        ? `<div class="prompt-neg"><strong>Negative:</strong> ${escapeHtml(scene.prompt_sd_negative)}</div>`
        : "";
      return `
        <div class="prompt-card">
          <div class="prompt-header">
            <span class="prompt-icon">${it.icon}</span>
            <span class="prompt-label">${it.label}</span>
            <button class="prompt-copy" data-copy-key="${it.key}" data-copy-val="${safeVal}" title="Copy">📋</button>
          </div>
          <div class="prompt-text">${safeVal}</div>
          ${extra}
        </div>
      `;
    }).join("");

    return `<details class="prompt-section">
      <summary class="prompt-summary">🎯 Prompt Siap Pakai (${items.filter(i => i.val && i.val !== "-").length})</summary>
      <div class="prompt-list">${cards}</div>
    </details>`;
  }

  function buildSceneCard(scene, idx) {
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.dataset.sceneIdx = idx;

    const startStr = secToTimestamp(scene.start);
    const endStr = secToTimestamp(scene.end);
    const dur = scene.durasi_ideal || 5;

    const babakBadge = scene.babak
      ? `<span class="scene-babak">${escapeHtml(scene.babak.toUpperCase())}</span>`
      : '';

    const piBadge = scene.pattern_interrupt
      ? '<span class="scene-badge-pi" title="Pattern interrupt">⚡</span>'
      : '';

    const imgUrl = scene.ai_image_url || '';
    const imgTag = imgUrl
      ? `<img class="scene-img" src="${escapeHtml(imgUrl)}" alt="Scene ${scene.scene}" loading="lazy"
          data-retry="0" data-max-retry="2"
          onerror="window._rafaImgRetry && window._rafaImgRetry(this);">`
      : '<div class="scene-img" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;">Tidak ada gambar</div>';

    // Section: onscreen_text
    const onscreenHtml = scene.onscreen_text
      ? `<div class="scene-onscreen">📺 <strong>Onscreen:</strong> ${escapeHtml(scene.onscreen_text)}</div>`
      : '';

    // Section: sensory
    const sensoryHtml = scene.sensory_detail
      ? `<div class="scene-row"><span class="row-label">👁️ Sensorik:</span> ${escapeHtml(scene.sensory_detail)}</div>`
      : '';

    // Section: analogy
    const analogyHtml = (scene.analogy && scene.analogy !== '-')
      ? `<div class="scene-row"><span class="row-label">💡 Analogi:</span> ${escapeHtml(scene.analogy)}</div>`
      : '';

    // Section: open_loop / cliffhanger
    let teaseHtml = '';
    if (scene.open_loop && scene.open_loop !== '-') {
      teaseHtml += `<div class="scene-row scene-openloop"><span class="row-label">🔗 Open Loop:</span> ${escapeHtml(scene.open_loop)}</div>`;
    }
    if (scene.cliffhanger && scene.cliffhanger !== '-') {
      teaseHtml += `<div class="scene-row scene-cliffhanger"><span class="row-label">⏸️ Cliffhanger:</span> ${escapeHtml(scene.cliffhanger)}</div>`;
    }

    // Section: broll
    const brollHtml = (scene.broll && scene.broll.length)
      ? `<div class="scene-broll"><div class="broll-label">🎞️ B-Roll:</div><ul class="broll-list">${scene.broll.map(b => `<li>${escapeHtml(b)}</li>`).join('')}</ul></div>`
      : '';

    // Section: fakta kunci
    const faktaHtml = (scene.fakta_kunci && scene.fakta_kunci !== '-')
      ? `<div class="scene-fakta"><span class="fakta-label">🔍 Fakta Kunci:</span> ${escapeHtml(scene.fakta_kunci)} <span class="fakta-sumber">(${escapeHtml(scene.sumber_hint || '-')})</span></div>`
      : '';

    // Section: production cues
    const cuesHtml = `
      <div class="scene-cues">
        <span class="cue" title="Mood">🎭 ${escapeHtml(scene.mood || '-')}</span>
        <span class="cue" title="SFX">🔊 ${escapeHtml(scene.sfx || '-')}</span>
        <span class="cue" title="Transisi">🎬 ${escapeHtml(scene.transisi || 'cut to')}</span>
        <span class="cue" title="Durasi">⏱️ ${dur}s</span>
      </div>
    `;

    // Keywords
    const keywords = (scene.keyword_video || []).map(k =>
      `<span class="keyword">${escapeHtml(k)}</span>`
    ).join('');

    // Media preview
    const videoUrls = scene.video_urls || [];
    let mediaPreview = '';
    if (videoUrls.length) {
      const thumbs = videoUrls.slice(0, 5).map((m, i) => {
        const thumbUrl = m.thumb || '';
        const tag = m.type === 'video' ? '🎬' : '📷';
        return `<div class="media-thumb" data-idx="${i}" title="${escapeHtml(m.source)}">
          <img src="${escapeHtml(thumbUrl)}" alt="media ${i+1}" loading="lazy" onerror="this.style.opacity=0.2;">
          <span class="media-tag">${tag}</span>
        </div>`;
      }).join('');
      mediaPreview = `
        <div class="scene-media">
          <div class="scene-media-label">Media Preview (${videoUrls.length})</div>
          <div class="media-thumbs">${thumbs}</div>
        </div>
      `;
    } else {
      mediaPreview = '<div class="scene-media-empty">Tidak ada media ditemukan</div>';
    }

    card.innerHTML = `
      <div class="scene-header">
        <div class="scene-header-left">
          <span class="scene-num">Scene ${scene.scene}</span>
          ${babakBadge}
          ${piBadge}
        </div>
        <span class="scene-time">${startStr} - ${endStr}</span>
      </div>
      <div class="scene-body">
        ${imgTag}
        <div class="scene-narasi">${escapeHtml(scene.narasi)}</div>
        ${onscreenHtml}
        <div class="scene-meta"><strong>Visual:</strong> ${escapeHtml(scene.visual)}</div>
        <div class="scene-meta"><strong>Tokoh:</strong> ${escapeHtml(scene.tokoh)} · <strong>Emosi:</strong> ${escapeHtml(scene.emosi)}</div>
        ${sensoryHtml}
        ${analogyHtml}
        ${teaseHtml}
        ${brollHtml}
        ${cuesHtml}
        ${faktaHtml}
        <div class="scene-keywords">${keywords}</div>
        ${mediaPreview}
        ${buildPromptCards(scene)}
        <div class="scene-actions">
          <button class="btn btn-secondary btn-small" data-act="copy">📋 Copy Narasi</button>
          <button class="btn btn-secondary btn-small" data-act="regen-img">🔄 Ganti Gambar</button>
          <button class="btn btn-secondary btn-small" data-act="download-img">⬇️ Download Gambar</button>
        </div>
      </div>
    `;

    card.addEventListener('click', (e) => {
      const actBtn = e.target.closest('[data-act]');
      if (actBtn) {
        const act = actBtn.dataset.act;
        if (act === 'copy') copyNarasi(scene);
        if (act === 'regen-img') regenImage(idx);
        if (act === 'download-img') downloadImage(scene, idx);
        return;
      }
      const thumb = e.target.closest('.media-thumb');
      if (thumb) {
        const m = (scene.video_urls || [])[parseInt(thumb.dataset.idx, 10)];
        if (m && m.page) window.open(m.page, '_blank');
      }
    });

    return card;
  }

  function copyNarasi(scene) {
    const text = scene.narasi || '';
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(
        () => showToast('✅ Narasi dicopy', 'success'),
        () => showToast('Gagal copy', 'error')
      );
    } else {
      showToast('Clipboard tidak didukung', 'error');
    }
  }

  function regenImage(idx) {
    if (!state.currentProject) return;
    const s = state.currentProject.scenes[idx];
    const style = state.currentProject.style;
    const format = state.currentProject.format;
    s.ai_image_url = Media.buildPollinationsUrl(
      s.keyword_gambar || s.visual || s.narasi,
      style,
      format
    );
    renderStoryboard(state.currentProject);
    showToast('🔄 Gambar di-generate ulang', 'success');
  }

  async function downloadImage(scene, idx) {
    if (!scene.ai_image_url) {
      showToast('Tidak ada gambar untuk di-download', 'error');
      return;
    }
    showToast('⏳ Mengunduh gambar...', '');

    const filename = `rafa-scene-${String(scene.scene).padStart(2, '0')}.jpg`;

    // === Native Capacitor (Android) ===
    if (window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.Filesystem) {
      try {
        const Fs = window.Capacitor.Plugins.Filesystem;
        const Share = window.Capacitor.Plugins.Share;

        // Fetch gambar jadi base64
        const res = await fetch(scene.ai_image_url);
        if (!res.ok) throw new Error('Gagal fetch gambar');
        const blob = await res.blob();
        const base64 = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onloadend = () => {
            // Hilangkan prefix "data:image/jpeg;base64,"
            const result = reader.result;
            resolve(result.split(',')[1]);
          };
          reader.onerror = reject;
          reader.readAsDataURL(blob);
        });

        // Auto-save ke Pictures (langsung muncul di Galeri)
        let savedToGallery = false;
        try {
          await Fs.writeFile({
            path: filename,
            data: base64,
            directory: 'EXTERNAL_STORAGE',
            recursive: true
          });
          savedToGallery = true;
        } catch (e1) {
          console.warn('Save ke EXTERNAL_STORAGE gagal, coba DOCUMENTS:', e1);
        }

        if (!savedToGallery) {
          await Fs.writeFile({
            path: filename,
            data: base64,
            directory: 'DOCUMENTS',
            recursive: true
          });
        }

        // Share dialog (opsional, ke WhatsApp/Galeri/dll)
        if (Share && Share.share) {
          const cached = await Fs.writeFile({
            path: filename,
            data: base64,
            directory: 'CACHE'
          });
          await Share.share({
            title: filename,
            text: 'Scene ' + scene.scene,
            url: cached.uri,
            dialogTitle: 'Simpan atau bagikan gambar'
          });
        }

        showToast('✅ Gambar tersimpan di Galeri', 'success');
        return;
      } catch (e) {
        console.warn('Native download gagal, fallback ke web:', e);
      }
    }

    // === Web Fallback ===
    try {
      const res = await fetch(scene.ai_image_url);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      showToast('✅ Gambar didownload', 'success');
    } catch (err) {
      console.error(err);
      showToast('Gagal download: ' + err.message, 'error');
    }
  }

  // ============ PROJECTS LIST ============
  function renderProjectsList() {
    const all = Store.getAllProjects();
    els.projectsList.innerHTML = '';

    if (!all.length) {
      els.projectsEmpty.style.display = 'block';
      return;
    }
    els.projectsEmpty.style.display = 'none';

    all.forEach(p => {
      const item = document.createElement('div');
      item.className = 'project-item';
      item.dataset.id = p.id;

      const date = new Date(p.updatedAt || p.createdAt || Date.now());
      const dateStr = date.toLocaleString('id-ID', {
        day: '2-digit', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit'
      });
      const sceneCount = (p.scenes || []).length;

      const durasiLabel = p.durasi === 'auto'
        ? 'Auto'
        : p.durasi + ' menit';
      item.innerHTML = `
        <h4>${escapeHtml(p.judul)}</h4>
        <p>${escapeHtml(p.format)} · ${durasiLabel} · ${escapeHtml(p.genre)} · ${sceneCount} scene</p>
        <p>${dateStr}</p>
      `;

      let pressTimer = null;
      let longPressed = false;

      item.addEventListener('click', () => {
        if (longPressed) { longPressed = false; return; }
        openProject(p.id);
      });

      item.addEventListener('touchstart', () => {
        pressTimer = setTimeout(() => {
          longPressed = true;
          if (confirm(`Hapus project "${p.judul}"?`)) {
            Store.deleteProject(p.id);
            renderProjectsList();
            showToast('Project dihapus', 'success');
          }
        }, 700);
      }, { passive: true });

      item.addEventListener('touchend', () => clearTimeout(pressTimer));
      item.addEventListener('touchmove', () => clearTimeout(pressTimer));
      item.addEventListener('mousedown', () => {
        pressTimer = setTimeout(() => {
          longPressed = true;
          if (confirm(`Hapus project "${p.judul}"?`)) {
            Store.deleteProject(p.id);
            renderProjectsList();
            showToast('Project dihapus', 'success');
          }
        }, 700);
      });
      item.addEventListener('mouseup', () => clearTimeout(pressTimer));
      item.addEventListener('mouseleave', () => clearTimeout(pressTimer));

      els.projectsList.appendChild(item);
    });
  }

  function openProject(id) {
    const p = Store.getProject(id);
    if (!p) { showToast('Project tidak ditemukan', 'error'); return; }
    state.currentProject = JSON.parse(JSON.stringify(p));
    renderStoryboard(state.currentProject);
    showPage('storyboard');
    showToast('📂 Project dibuka', 'success');
  }

  els.btnRefreshProjects.addEventListener('click', () => {
    renderProjectsList();
    showToast('Diperbarui', 'success');
  });

  // ============ SETTINGS ============
  function loadSettingsForm() {
    const keys = Store.getApiKeys();
    const defs = Store.getDefaults();
    els.keyDeepseek.value = keys.deepseek || '';
    els.keyPexels.value = keys.pexels || '';
    els.keyPixabay.value = keys.pixabay || '';
    els.defaultStyle.value = defs.style || 'Realistis';
    els.saveStatus.textContent = '';
  }

  els.btnSaveKeys.addEventListener('click', () => {
    Store.saveApiKeys({
      deepseek: els.keyDeepseek.value.trim(),
      pexels: els.keyPexels.value.trim(),
      pixabay: els.keyPixabay.value.trim()
    });
    Store.saveDefaults({ style: els.defaultStyle.value, bahasa: 'Indonesia' });
    els.saveStatus.textContent = '✅ Settings tersimpan';
    showToast('✅ Settings tersimpan', 'success');
    setTimeout(() => { els.saveStatus.textContent = ''; }, 2500);
  });

  // ============ EXPORT MODAL ============
  els.btnExport.addEventListener('click', () => {
    if (!state.currentProject) {
      showToast('Belum ada storyboard', 'error');
      return;
    }
    els.modalExport.classList.add('show');
  });

  els.modalExportClose.addEventListener('click', () => {
    els.modalExport.classList.remove('show');
  });

  els.modalExport.addEventListener('click', (e) => {
    if (e.target === els.modalExport) els.modalExport.classList.remove('show');
  });

  document.querySelectorAll('[data-export]').forEach(btn => {
    btn.addEventListener('click', async () => {
      if (!state.currentProject) return;
      const origText = btn.textContent;
      btn.disabled = true;
      btn.textContent = '⏳ Exporting...';
      try {
        await Exporter.exportProject(state.currentProject, btn.dataset.export);
        showToast(`✅ Export ${btn.dataset.export.toUpperCase()} siap`, 'success');
        els.modalExport.classList.remove('show');
      } catch (err) {
        console.error(err);
        showToast('❌ ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = origText;
      }
    });
  });

  // ============ SAVE PROJECT (FAB) ============
  els.btnSaveProject.addEventListener('click', () => {
    if (!state.currentProject) {
      showToast('Belum ada storyboard', 'error');
      return;
    }
    const saved = Store.saveProject(state.currentProject);
    state.currentProject.id = saved.id;
    showToast('💾 Project tersimpan', 'success');
  });

  // ============ BACK TO INPUT ============
  els.btnBackInput.addEventListener('click', () => {
    if (state.isGenerating) return;
    state.currentProject = null;
    els.form.reset();
    const vidEl = document.getElementById('include-video');
    if (vidEl) vidEl.checked = false;
    showPage('input');
  });

  // ============ PROMPT COPY HANDLER ============
  document.addEventListener("click", (e) => {
    const btn = e.target.closest("[data-copy-key]");
    if (!btn) return;
    e.stopPropagation();
    const val = btn.dataset.copyVal || "";
    if (!val) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(val).then(
        () => showToast("✅ Prompt dicopy", "success"),
        () => showToast("Gagal copy", "error")
      );
    } else {
      showToast("Clipboard tidak didukung", "error");
    }
  });

  // ============ IMAGE RETRY HANDLER ============
  window._rafaImgRetry = function(imgEl) {
    const retry = parseInt(imgEl.dataset.retry || '0', 10);
    const maxRetry = parseInt(imgEl.dataset.maxRetry || '2', 10);
    if (retry >= maxRetry) {
      imgEl.style.background = '#e2e8f0';
      imgEl.alt = 'Gagal memuat gambar';
      imgEl.onerror = null;
      return;
    }
    imgEl.dataset.retry = String(retry + 1);
    // Delay lalu reload dengan cache-bust (seed random baru dari URL)
    setTimeout(() => {
      const base = imgEl.src.split('&_r=')[0];
      imgEl.src = base + '&_r=' + Math.random();
    }, 1500 * (retry + 1));
  };

  // ============ INIT ============
  function init() {
    // Set default style dari settings kalau ada
    const defs = Store.getDefaults();
    const styleRadio = document.querySelector(`input[name="style"][value="${defs.style}"]`);
    if (styleRadio) styleRadio.checked = true;

    // Welcome toast
    setTimeout(() => showToast('Selamat datang di Rafa Studio', ''), 500);
  }

  init();

})();
