const fs = require('fs');
let s = fs.readFileSync('deepseek.js','utf8');
let miss = [];

// 1. Tambah handler 'outline' di callAPI (setelah handler 'clips')
{
  const before = s;
  s = s.replace(
    /(if \(resultKey === 'clips'\) \{[\s\S]*?return clips;\n    \})/,
    '$1\n    if (resultKey === \'outline\') return parsed;'
  );
  if (s === before) miss.push('tambah handler outline');
  else console.log('OK  : tambah handler outline');
}

// 2. Tambah fungsi generateOutline sebelum generateStoryboard
{
  const before = s;
  const fn = `
  // ============ GENERATE OUTLINE (untuk Long Auto multi-batch) ============
  async function generateOutline(opts, totalScenes) {
    const sys = 'Kamu adalah perencana storyboard video YouTube. Tugasmu HANYA membuat outline struktur + deskripsi karakter utama. Balas dengan JSON object saja, tanpa markdown.';
    const usr = \`Judul: \${opts.judul}
Format: Long
Genre: \${opts.genre}
Durasi: Auto (~\${totalScenes} scene)

Buat outline \${totalScenes} scene. Format JSON:
{
  "karakter_utama": "deskripsi detail karakter utama KALAU cerita butuh karakter berulang (contoh: 'Rafa, pria 25 tahun, rambut hitam pendek rapi, kemeja biru lengan panjang, ekspresi ramah'). Kalau tidak butuh karakter tetap, isi '-'",
  "outline": [
    { "scene": 1, "babak": "hook", "poin": "1 frasa utama maks 12 kata" }
  ]
}

ATURAN STRUKTUR BABAK:
- 10% awal: hook + intro
- 60% tengah: body (subtopik WAJIB BERBEDA satu sama lain, JANGAN ada topik yang diulang)
- 15% berikutnya: climax
- 10% berikutnya: refleksi
- 5% akhir: cta

Setiap subtopik di body WAJIB unik. Balas HANYA JSON object.\`;
    return await callAPI(sys, usr, 'outline');
  }

  // ============ GENERATE STORYBOARD ============`;
  s = s.replace('  // ============ GENERATE STORYBOARD ============', fn);
  if (s === before) miss.push('tambah fungsi generateOutline');
  else console.log('OK  : tambah fungsi generateOutline');
}

if (miss.length) { console.log('\nMISS:'); miss.forEach(m => console.log('  -', m)); process.exit(1); }
fs.writeFileSync('deepseek.js', s);
console.log('\nTulis: deepseek.js');
