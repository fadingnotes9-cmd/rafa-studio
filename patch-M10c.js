const fs = require('fs');
let s = fs.readFileSync('deepseek.js','utf8');

// 1. Ganti definisi konstanta (BLOB → STICKMAN dengan outfit rule)
const startMarker = 'const BLOB_CHARACTER = {';
const startIdx = s.indexOf(startMarker);
if (startIdx === -1) { console.log('MISS: konstanta BLOB'); process.exit(1); }
const endIdx = s.indexOf('};', startIdx);
if (endIdx === -1) { console.log('MISS: end konstanta'); process.exit(1); }

const newConst = `const STICKMAN_CHARACTER = {
    base: 'simple stickman character, white round head with thick black outline, 2 small black dot eyes, simple curved smile line, stick body (single thick black line), stick arms (thick black lines), stick legs (thick black lines), clean minimal cartoon style',
    exprMap: 'ekspresi wajah stickman HARUS mengikuti emosi scene: kaget (mata jadi 2 titik besar, mulut jadi O), sedih (mata jadi lengkung turun, mulut melengkung ke bawah), senang (mata melengkung senyum, senyum lebar), takut (mata kecil titik, mulut zigzag), bingung (1 mata lebih kecil, mulut garis miring), marah (mata tajam, mulut garis datar tebal), mikir (mata lihat ke atas, tangan menyentuh dagu)',
    outfitRule: 'OUTFIT/PAKAIAN STICKMAN WAJIB MENYESUAIKAN TOPIK VIDEO. Tentukan 1 outfit utama di awal (dari judul + konteks + genre), LALU PAKAI OUTFIT ITU SAMA PERSIS di SEMUA SCENE video ini. Outfit TIDAK BOLEH berubah antar scene dalam 1 video. Contoh: video "Perang Badar" pakai outfit "white Arabian robe with turban and small sword" di semua 60 scene. Video "Fisika Kuantum" pakai outfit "white lab coat with glasses" di semua scene. Kalau topik abstrak, AI tentukan outfit netral (kaos kasual atau lab coat sederhana) dan pakai konsisten.',
    props: 'Selain outfit utama, stickman boleh pegang property yang relevan dengan aksi scene (contoh: topik kopi → pegang mug kopi; topik olahraga → pegang bola; topik sains → pegang mikroskop). Property BOLEH berubah tiap scene, TAPI outfit utama WAJIB SAMA di semua scene.',
    otherChars: 'Kalau scene butuh karakter LAIN (manusia, ilmuwan, tokoh sejarah), gambar sebagai karakter 2D flat biasa (simple cartoon human, flat 2D style, thick outline, tanpa detail rumit). JANGAN gambar karakter lain dengan style stickman. HANYA stickman utama yang berbentuk stickman.'
  }`;

s = s.substring(0, startIdx) + newConst + s.substring(endIdx + 2);
console.log('OK  : konstanta → STICKMAN_CHARACTER');

// 2. Ganti semua referensi BLOB_CHARACTER → STICKMAN_CHARACTER
s = s.split('BLOB_CHARACTER').join('STICKMAN_CHARACTER');
console.log('OK  : referensi renamed');

fs.writeFileSync('deepseek.js', s);
console.log('Tulis: deepseek.js');
