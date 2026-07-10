const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

code = code.replace(
  /- Untuk Post-Test, kaitkan setiap screenshot ke nomor soal Post-Test tertentu dan jelaskan bagian mana dari soal yang dijawab oleh screenshot tersebut\./g,
  `- Untuk Post-Test, kaitkan setiap screenshot ke nomor soal Post-Test tertentu dan jelaskan bagian mana dari soal yang dijawab oleh screenshot tersebut.
        - WAJIB MENGANALISIS DIAGRAM / FLOWCHART / DRAWIO: Jika gambar berisi flowchart, drawio, bagan, atau skema manual, Anda TETAP WAJIB membaca dan menjabarkan alurnya ke teks penjelasan. JANGAN menolak membaca diagram!
        - JAWAB SEMUA SOAL: Anda WAJIB memikirkan dan menuliskan jawaban yang tepat untuk semua soal Pre-Test dan Post-Test di object \`answers\`. JANGAN dibiarkan kosong atau hanya mengulang soalnya saja.`
);

fs.writeFileSync('src/lib/ai/prompts.ts', code);
