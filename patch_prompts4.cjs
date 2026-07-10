const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const targetImageRule = `- JAWAB SEMUA SOAL: Anda WAJIB memikirkan dan menuliskan jawaban yang tepat untuk semua soal Pre-Test dan Post-Test di object \\\`answers\\\`. JANGAN dibiarkan kosong atau hanya mengulang soalnya saja.`;
const newImageRule = `- JAWAB SEMUA SOAL: Anda WAJIB memikirkan dan menuliskan jawaban yang tepat untuk semua soal Pre-Test dan Post-Test di object \\\`answers\\\`. JANGAN dibiarkan kosong atau hanya mengulang soalnya saja.
- ANTI-STACKING GAMBAR (DILARANG MENUMPUK GAMBAR): JANGAN PERNAH menumpuk 2 gambar atau lebih secara berurutan tanpa teks penjelasan di antaranya! SETIAP 1 screenshot WAJIB diikuti oleh paragraf observasi visual yang spesifik sebelum gambar berikutnya muncul.`;

const targetFormatRule = `- DILARANG KERAS MENGGUNAKAN LISTING/BULLETS PADA LANGKAH KERJA: Untuk bagian Langkah Kerja dan Analisis, WAJIB ditulis dalam bentuk PARAGRAF NARATIF (cerita proses) yang terdiri dari 2-4 paragraf. DILARANG KERAS menggunakan format bullet points (1, 2, 3) atau list.`;
const newFormatRule = `- DILARANG KERAS MENGGUNAKAN LISTING/BULLETS DI SELURUH LAPORAN: Untuk bagian Langkah Kerja, Analisis, hingga JAWABAN POST-TEST dan penjelasan eksperimen, SEMUANYA WAJIB ditulis dalam bentuk PARAGRAF NARATIF (cerita komparatif). DILARANG KERAS menggunakan format bullet points (•, -, 1, 2, 3) atau list bertingkat untuk menjabarkan arsitektur/parameter.
           - ANTI-DUPLIKASI KETAT (NO REDUNDANCY): DILARANG KERAS mencetak/menghasilkan paragraf yang persis sama dua kali. Pastikan Langkah Kerja dan Ulasan Praktikum hanya dieksekusi satu kali per dokumen!`;

code = code.replace(targetImageRule, newImageRule);
code = code.replace(targetFormatRule, newFormatRule);

fs.writeFileSync('src/lib/ai/prompts.ts', code);
console.log("Patched prompts.ts with anti-stacking and global anti-bullet rules");
