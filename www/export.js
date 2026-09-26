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

  // ============ EXPORT TXT (narasi saja) ============
  function toTXT(project) {
    let out = `# ${project.judul}\n`;
    out += `Format: ${project.format} | Durasi: ${project.durasi} menit | Genre: ${project.genre}\n`;
    out += `Generated: ${new Date(project.updatedAt || Date.now()).toLocaleString('id-ID')}\n`;
    out += `\n${'='.repeat(60)}\n\n`;

    project.scenes.forEach(s => {
      out += `[Scene ${s.scene}] ${secToTimestamp(s.start)} - ${secToTimestamp(s.end)}\n`;
      out += `${s.narasi}\n\n`;
    });

    return out;
  }

  // ============ EXPORT CSV (lengkap) ============
  function toCSV(project) {
    const header = ['scene', 'start', 'end', 'narasi', 'visual', 'tokoh', 'emosi', 'keyword_video', 'keyword_gambar'];
    const rows = [header.join(',')];

    project.scenes.forEach(s => {
      rows.push([
        s.scene,
        secToTimestamp(s.start),
        secToTimestamp(s.end),
        csvEscape(s.narasi),
        csvEscape(s.visual),
        csvEscape(s.tokoh),
        csvEscape(s.emosi),
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
    toTXT, toCSV, toJSON, toSRT,
    _secToTimestamp: secToTimestamp,
    _secToSrtTime: secToSrtTime
  };

})();

window.Exporter = Exporter;
