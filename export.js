/* ============================================================
   export.js — Export Storyboard (TXT/CSV/JSON/SRT)
   ============================================================ */

const Exporter = (() => {

  // ============ HELPERS ============
  function pad(n, len) {
    return String(n).padStart(len || 2, '0');
  }

  function secToTimestamp(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    return `${pad(h)}:${pad(m)}:${pad(s)}`;
  }

  function secToSrtTime(sec) {
    const h = Math.floor(sec / 3600);
    const m = Math.floor((sec % 3600) / 60);
    const s = Math.floor(sec % 60);
    const ms = Math.floor((sec - Math.floor(sec)) * 1000);
    return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
  }

  function csvEscape(val) {
    const s = String(val == null ? '' : val);
    if (s.includes(',') || s.includes('"') || s.includes('\n')) {
      return '"' + s.replace(/"/g, '""') + '"';
    }
    return s;
  }

  function downloadFile(filename, content, mime) {
    const blob = new Blob([content], { type: mime || 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function slugify(text) {
    return String(text || 'storyboard')
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 50) || 'storyboard';
  }

  // ============ EXPORT TXT (narasi saja, untuk TTS) ============
  function toTXT(project) {
    let out = project.judul + '\n';
    out += 'Format: ' + project.format + ' | Durasi: ' + (project.durasi === 'auto' ? 'Auto' : project.durasi + ' menit') + ' | Genre: ' + project.genre + '\n';
    out += 'Generated: ' + new Date(project.updatedAt || Date.now()).toLocaleString('id-ID') + '\n';
    out += '\n' + '='.repeat(60) + '\n\n';

    project.scenes.forEach(s => {
      out += s.narasi + '\n\n';
    });

    return out;
  }

  // ============ EXPORT TXT-FULL (script lengkap untuk shooting) ============
  function toScript(project) {
    let out = '═══════════════════════════════════════════════════════\n';
    out += '  ' + project.judul.toUpperCase() + '\n';
    out += '  Storyboard Script — Rafa Studio\n';
    out += '═══════════════════════════════════════════════════════\n\n';
    out += 'Format    : ' + project.format + '\n';
    out += 'Durasi    : ' + (project.durasi === 'auto' ? 'Auto' : project.durasi + ' menit') + '\n';
    out += 'Genre     : ' + project.genre + '\n';
    out += 'Style     : ' + project.style + '\n';
    out += 'Konteks   : ' + (project.konteks || '-') + '\n';
    out += 'Scenes    : ' + project.scenes.length + '\n';
    out += 'Generated : ' + new Date(project.updatedAt || Date.now()).toLocaleString('id-ID') + '\n\n';

    project.scenes.forEach(s => {
      out += '───────────────────────────────────────────────────────\n';
      out += 'SCENE ' + s.scene + '  [' + secToTimestamp(s.start) + ' - ' + secToTimestamp(s.end) + ']  ' + (s.babak ? '[' + s.babak.toUpperCase() + ']' : '') + '\n';
      out += '───────────────────────────────────────────────────────\n';
      if (s.pattern_interrupt) out += '⚡ Pattern Interrupt\n';
      out += '\n📢 NARASI:\n' + (s.narasi || '-') + '\n\n';
      if (s.onscreen_text) out += '📺 ONSCREEN TEXT: ' + s.onscreen_text + '\n\n';
      out += '🎨 VISUAL: ' + (s.visual || '-') + '\n';
      if (s.sensory_detail) out += '👁️  SENSORIK: ' + s.sensory_detail + '\n';
      if (s.analogy && s.analogy !== '-') out += '💡 ANALOGI: ' + s.analogy + '\n';
      out += '\n👤 TOKOH: ' + (s.tokoh || '-') + '\n';
      out += '🎭 EMOSI: ' + (s.emosi || '-') + '\n';
      out += '🎼 MOOD: ' + (s.mood || '-') + '\n';
      out += '🔊 SFX: ' + (s.sfx || '-') + '\n';
      out += '🎬 TRANSISI: ' + (s.transisi || 'cut to') + '\n';
      out += '⏱️  DURASI: ' + (s.durasi_ideal || 5) + 's\n';
      if (s.open_loop && s.open_loop !== '-') out += '\n🔗 OPEN LOOP: ' + s.open_loop + '\n';
      if (s.cliffhanger && s.cliffhanger !== '-') out += '⏸️  CLIFFHANGER: ' + s.cliffhanger + '\n';
      if (s.broll && s.broll.length) {
        out += '\n🎞️  B-ROLL:\n';
        s.broll.forEach(b => { out += '   ▸ ' + b + '\n'; });
      }
      if (s.fakta_kunci && s.fakta_kunci !== '-') out += '\n🔍 FAKTA KUNCI: ' + s.fakta_kunci + ' (' + (s.sumber_hint || '-') + ')\n';
      out += '\n🔎 KEYWORD VIDEO: ' + ((s.keyword_video || []).join(' | ') || '-') + '\n';
      out += '🖼️  PROMPT GAMBAR: ' + (s.keyword_gambar || '-') + '\n\n';
    });

    return out;
  }

  // ============ EXPORT CSV (lengkap, v2) ============
  function toCSV(project) {
    const header = ['scene', 'babak', 'start', 'end', 'durasi_ideal', 'narasi', 'onscreen_text', 'visual', 'sensory_detail', 'analogy', 'tokoh', 'emosi', 'mood', 'sfx', 'transisi', 'hook_type', 'open_loop', 'cliffhanger', 'pattern_interrupt', 'broll', 'fakta_kunci', 'sumber_hint', 'keyword_video', 'keyword_gambar'];
    const rows = [header.join(',')];

    project.scenes.forEach(s => {
      rows.push([
        s.scene,
        csvEscape(s.babak || ''),
        secToTimestamp(s.start),
        secToTimestamp(s.end),
        s.durasi_ideal || 5,
        csvEscape(s.narasi),
        csvEscape(s.onscreen_text || ''),
        csvEscape(s.visual),
        csvEscape(s.sensory_detail || ''),
        csvEscape(s.analogy || ''),
        csvEscape(s.tokoh),
        csvEscape(s.emosi),
        csvEscape(s.mood || ''),
        csvEscape(s.sfx || ''),
        csvEscape(s.transisi || ''),
        csvEscape(s.hook_type || ''),
        csvEscape(s.open_loop || ''),
        csvEscape(s.cliffhanger || ''),
        s.pattern_interrupt ? 'true' : 'false',
        csvEscape((s.broll || []).join(' | ')),
        csvEscape(s.fakta_kunci || ''),
        csvEscape(s.sumber_hint || ''),
        csvEscape((s.keyword_video || []).join(' | ')),
        csvEscape(s.keyword_gambar)
      ].join(','));
    });

    return rows.join('\n');
  }

  // ============ EXPORT JSON (backup lengkap) ============
  function toJSON(project) {
    return JSON.stringify({
      version: 1,
      exportedAt: Date.now(),
      project: project
    }, null, 2);
  }

  // ============ EXPORT SRT (subtitle) ============
  function toSRT(project) {
    let out = '';
    project.scenes.forEach((s, idx) => {
      out += `${idx + 1}\n`;
      out += `${secToSrtTime(s.start)} --> ${secToSrtTime(s.end)}\n`;
      out += `${s.narasi}\n\n`;
    });
    return out;
  }

  // ============ MAIN EXPORT ============
  function exportProject(project, format) {
    if (!project || !project.scenes) {
      throw new Error('Project tidak valid');
    }
    const slug = slugify(project.judul);
    const stamp = new Date().toISOString().slice(0, 10);

    switch (format) {
      case 'txt':
        downloadFile(`${slug}-${stamp}.txt`, toTXT(project));
        break;
      case 'csv':
        downloadFile(`${slug}-${stamp}.csv`, toCSV(project), 'text/csv;charset=utf-8');
        break;
      case 'json':
        downloadFile(`${slug}-${stamp}.json`, toJSON(project), 'application/json');
        break;
      case 'script':
        downloadFile(`${slug}-${stamp}-script.txt`, toScript(project));
        break;
      case 'srt':
        downloadFile(`${slug}-${stamp}.srt`, toSRT(project), 'text/plain;charset=utf-8');
        break;
      default:
        throw new Error('Format tidak dikenal: ' + format);
    }
  }

  // ============ PUBLIC API ============
  return {
    exportProject,
    toTXT, toScript, toCSV, toJSON, toSRT,
    _secToTimestamp: secToTimestamp,
    _secToSrtTime: secToSrtTime
  };

})();

window.Exporter = Exporter;
