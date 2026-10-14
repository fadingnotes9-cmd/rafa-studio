const fs = require('fs');
let s = fs.readFileSync('deepseek.js','utf8');
let miss = [];

// Ganti blok header + aturan di buildSystemPrompt
{
  const startMarker = "      prompt += '\\n\\n=== MASKOT BLOB";
  const startIdx = s.indexOf(startMarker);
  if (startIdx === -1) { console.log('MISS: header'); process.exit(1); }
  
  // Cari akhir blok: baris setelah '11.' terakhir
  const endMarker = "      prompt += '11. Ikat kepala biru WAJIB selalu ada di setiap scene";
  const endIdx = s.indexOf(endMarker);
  if (endIdx === -1) {
    // Coba cari marker alternatif (kalau struktur sedikit beda)
    console.log('MISS: end marker 11');
    console.log('Debug — 30 baris setelah start:');
    console.log(s.substring(startIdx, startIdx + 1500));
    process.exit(1);
  }
  const endLineEnd = s.indexOf('\\n', endIdx) + 1;
  
  const newBlock = `      prompt += '\\n\\n=== KARAKTER STICKMAN — WAJIB KONSISTEN DI SEMUA SCENE ===\\n';
      prompt += STICKMAN_CHARACTER.base + '\\n\\n';
      prompt += 'ATURAN KARAKTER STICKMAN (WAJIB DIPATUHI):\\n';
      prompt += '1. Stickman WAJIB muncul di SETIAP scene yang menampilkan tokoh/karakter. Stickman adalah maskot utama channel.\\n';
      prompt += '2. ' + STICKMAN_CHARACTER.outfitRule + '\\n\\n';
      prompt += '3. ' + STICKMAN_CHARACTER.exprMap + '\\n\\n';
      prompt += '4. ' + STICKMAN_CHARACTER.props + '\\n\\n';
      prompt += '5. ' + STICKMAN_CHARACTER.otherChars + '\\n\\n';
      prompt += '6. field "tokoh" di scene: isi nama stickman (default "Rafa") kalau hanya stickman yang muncul. Kalau ada karakter lain, isi "Rafa, [nama karakter lain]".\\n';
      prompt += '7. field "prompt_image" WAJIB DIAWALI dengan base stickman PERSIS SAMA di setiap scene: "simple stickman character, white round head with thick black outline, 2 small black dot eyes, simple curved smile line, stick body, stick arms, stick legs, [OUTFIT_UTAMA_YANG_SAMA_DI_SEMUA_SCENE], " lalu lanjutkan dengan [ekspresi + property + aksi] + [background/karakter lain].\\n';
      prompt += '8. OUTFIT UTAMA WAJIB SAMA PERSIS di semua scene (jangan ganti baju/topi/aksesoris utama antar scene). HANYA ekspresi wajah + property tangan (benda yang dipegang) + aksi yang berubah.\\n';
      prompt += '9. Skala stickman di frame: medium shot standard, tinggi stickman sekitar 1/3-1/2 frame.\\n';
      prompt += '10. Kalau scene butuh karakter lain (manusia/tokoh), gambar dengan style flat 2D cartoon biasa dengan outline tebal.\\n';
      prompt += '11. JANGAN pernah hapus outfit utama stickman. JANGAN ubah proporsi kepala/badan. JANGAN ganti style ke bentuk lain.\\n';
`;
  
  const before = s;
  s = s.substring(0, startIdx) + newBlock + s.substring(endLineEnd);
  if (s === before) { console.log('MISS: replace block'); process.exit(1); }
  else console.log('OK  : update header + aturan stickman');
}

if (miss.length) { console.log('MISS:'); miss.forEach(m => console.log('  -', m)); process.exit(1); }
fs.writeFileSync('deepseek.js', s);
console.log('Tulis: deepseek.js');
