const fs = require('fs');
let s = fs.readFileSync('deepseek.js','utf8');

// Cari blok konstanta STICKMAN_CHARACTER dan ganti isinya
const startMarker = 'const STICKMAN_CHARACTER = {';
const startIdx = s.indexOf(startMarker);
if (startIdx === -1) { console.log('MISS: konstanta'); process.exit(1); }

// Cari '};' pertama setelah start
const endIdx = s.indexOf('};', startIdx);
if (endIdx === -1) { console.log('MISS: end'); process.exit(1); }

const newConst = `const STICKMAN_CHARACTER = {
    base: 'simple stickman character, white round head with thick black outline, 2 small black dot eyes, simple curved smile line, stick body (single thick black line), stick arms (thick black lines), stick legs (thick black lines), clean minimal cartoon style',
    exprMap: 'ekspresi wajah stickman HARUS mengikuti emosi scene: kaget (mata jadi 2 titik besar, mulut jadi O), sedih (mata jadi lengkung turun, mulut melengkung ke bawah), senang (mata melengkung senyum, senyum lebar), takut (mata kecil titik, mulut zigzag), bingung (1 mata lebih kecil, mulut garis miring), marah (mata tajam, mulut garis datar tebal), mikir (mata lihat ke atas, tangan menyentuh dagu)',
    outfitRule: 'OUTFIT/PAKAIAN STICKMAN WAJIB MENYESUAIKAN TOPIK VIDEO. Tentukan 1 outfit utama di awal (dari judul + konteks + genre), LALU PAKAI OUTFIT ITU SAMA PERSIS di SEMUA SCENE video ini. Outfit TIDAK BOLEH berubah antar scene dalam 1 video. Contoh: video "Perang Badar" → outfit "white Arabian robe with turban and small sword" (dipakai di semua 60 scene). Video "Fisika Kuantum" → outfit "white lab coat with glasses" (dipakai di semua scene). Kalau topik abstrak/tidak jelas, AI tentukan outfit netral (mis. kaos kasual atau lab coat sederhana) dan pakai konsisten.',
    props: 'Selain outfit utama, stickman boleh pegang property yang relevan dengan aksi scene (contoh: topik kopi → stickman pegang mug kopi; topik olahraga → stickman pegang bola; topik sains → stickman pegang mikroskop). Property BOLEH berubah tiap scene, TAPI outfit utama WAJIB SAMA di semua scene.',
    otherChars: 'Kalau scene butuh karakter LAIN (manusia, ilmuwan, tokoh sejarah, dll), gambar sebagai karakter 2D flat biasa (simple cartoon human, flat 2D style, thick outline, tanpa detail rumit). JANGAN gambar karakter lain dengan style stickman. HANYA stickman utama yang berbentuk stickman.'
  }`;

const before = s;
s = s.substring(0, startIdx) + newConst + s.substring(endIdx + 2);
if (s === before) { console.log('MISS: replace'); process.exit(1); }
console.log('OK  : isi STICKMAN_CHARACTER diganti');

fs.writeFileSync('deepseek.js', s);
console.log('Tulis: deepseek.js');
