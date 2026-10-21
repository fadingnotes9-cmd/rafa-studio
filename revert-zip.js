const fs = require('fs');
let miss = [];

// 1. Bersihkan index.html
{
  let s = fs.readFileSync('index.html','utf8');
  const before = s;
  // Hapus CDN JSZip & FileSaver
  s = s.replace(/<!-- Library ZIP & FileSaver -->\n\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/jszip.*?<\/script>\n\s*<script src="https:\/\/cdnjs\.cloudflare\.com\/ajax\/libs\/FileSaver.*?<\/script>\n/g, '');
  // Hapus tombol ZIP
  s = s.replace(/<button class="btn btn-primary" id="btn-export-zip".*?<\/button>\n\s*/g, '');
  
  if (s === before) miss.push('index.html bersih'); else { fs.writeFileSync('index.html', s); console.log('OK  : index.html dibersihkan dari ZIP'); }
}

// 2. Bersihkan export.js
{
  let s = fs.readFileSync('export.js','utf8');
  const before = s;
  // Hapus fungsi exportAssetsZip
  const start = s.indexOf('  // ============ EXPORT ASET ZIP (CAPCUT) ============');
  if (start !== -1) {
    const end = s.indexOf('  return {', start);
    if (end !== -1) {
      s = s.substring(0, start) + s.substring(end);
    }
  }
  // Hapus dari return object
  s = s.replace('exportAssetsZip,', '');
  
  if (s === before) miss.push('export.js bersih'); else { fs.writeFileSync('export.js', s); console.log('OK  : export.js dibersihkan dari ZIP'); }
}

// 3. Bersihkan app.js
{
  let s = fs.readFileSync('app.js','utf8');
  const before = s;
  // Hapus event listener tombol ZIP
  const start = s.indexOf('  const btnExportZip = document.getElementById(\'btn-export-zip\');');
  if (start !== -1) {
    const end = s.indexOf('  els.modalExportClose.addEventListener', start);
    if (end !== -1) {
      s = s.substring(0, start) + s.substring(end);
    }
  }
  
  if (s === before) miss.push('app.js bersih'); else { fs.writeFileSync('app.js', s); console.log('OK  : app.js dibersihkan dari ZIP'); }
}

if (miss.length) { console.log('❌ MISS:', miss); process.exit(1); }
console.log('✅ Semua file bersih dari fitur ZIP');
