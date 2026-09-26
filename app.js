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

    const opts = {
      judul: judul,
      format: getRadioValue('format') || 'Long',
      durasi: parseInt(getRadioValue('durasi') || '1', 10),
      genre: els.genre.value,
      style: getRadioValue('style') || 'Realistis',
      konteks: els.konteks.value.trim()
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
        const pct = 10 + (info.batch / info.totalBatches) * 40;
        setProgress(pct, `Batch ${info.batch}/${info.totalBatches} — scene ${info.startScene}-${info.endScene}...`);
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
  function renderStoryboard(project) {
    els.sbJudul.textContent = project.judul;
    const durasiLabel = project.durasi + ' menit';
    const sceneCount = project.scenes.length;
    els.sbMeta.textContent = `${project.format} · ${durasiLabel} · ${project.genre} · ${project.style} · ${sceneCount} scene`;

    els.sceneList.innerHTML = '';
    project.scenes.forEach((s, idx) => {
      els.sceneList.appendChild(buildSceneCard(s, idx));
    });
  }

  function buildSceneCard(scene, idx) {
    const card = document.createElement('div');
    card.className = 'scene-card';
    card.dataset.sceneIdx = idx;

    const startStr = secToTimestamp(scene.start);
    const endStr = secToTimestamp(scene.end);
    const keywords = (scene.keyword_video || []).map(k =>
      `<span class="keyword">${escapeHtml(k)}</span>`
    ).join('');

    const imgUrl = scene.ai_image_url || '';
    const imgTag = imgUrl
      ? `<img class="scene-img" src="${escapeHtml(imgUrl)}" alt="Scene ${scene.scene}" loading="lazy" onerror="this.style.background='#e2e8f0';this.alt='Gagal memuat gambar';">`
      : `<div class="scene-img" style="display:flex;align-items:center;justify-content:center;color:#94a3b8;">Tidak ada gambar</div>`;

    // Preview media dari Pexels/Pixabay
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
      mediaPreview = `<div class="scene-media-empty">Tidak ada media ditemukan</div>`;
    }

    card.innerHTML = `
      <div class="scene-header">
        <span class="scene-num">Scene ${scene.scene}</span>
        <span class="scene-time">${startStr} - ${endStr}</span>
      </div>
      <div class="scene-body">
        ${imgTag}
        <div class="scene-narasi">${escapeHtml(scene.narasi)}</div>
        <div class="scene-meta"><strong>Visual:</strong> ${escapeHtml(scene.visual)}</div>
        <div class="scene-meta"><strong>Tokoh:</strong> ${escapeHtml(scene.tokoh)} · <strong>Emosi:</strong> ${escapeHtml(scene.emosi)}</div>
        <div class="scene-keywords">${keywords}</div>
        ${mediaPreview}
        <div class="scene-actions">
          <button class="btn btn-secondary btn-small" data-act="copy">📋 Copy Narasi</button>
          <button class="btn btn-secondary btn-small" data-act="regen-img">🔄 Ganti Gambar</button>
          <button class="btn btn-secondary btn-small" data-act="download-img">⬇️ Download Gambar</button>
        </div>
      </div>
    `;

    // Event delegation
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

  function downloadImage(scene, idx) {
    if (!scene.ai_image_url) {
      showToast('Tidak ada gambar untuk di-download', 'error');
      return;
    }
    showToast('Mengunduh gambar...', '');
    fetch(scene.ai_image_url)
      .then(r => r.blob())
      .then(blob => {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `scene-${scene.scene}.jpg`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 1000);
        showToast('✅ Gambar didownload', 'success');
      })
      .catch(err => {
        console.error(err);
        showToast('Gagal download: ' + err.message, 'error');
      });
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

      item.innerHTML = `
        <h4>${escapeHtml(p.judul)}</h4>
        <p>${escapeHtml(p.format)} · ${p.durasi} menit · ${escapeHtml(p.genre)} · ${sceneCount} scene</p>
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
    btn.addEventListener('click', () => {
      if (!state.currentProject) return;
      try {
        Exporter.exportProject(state.currentProject, btn.dataset.export);
        showToast(`✅ Export ${btn.dataset.export.toUpperCase()} berhasil`, 'success');
        els.modalExport.classList.remove('show');
      } catch (err) {
        console.error(err);
        showToast('❌ ' + err.message, 'error');
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
    showPage('input');
  });

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
