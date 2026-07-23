const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const targetStr = `    : ctx.isResume
    ? 'PENTING: Ini adalah format LAPORAN RESUME. DOKUMEN INI TIDAK MENGGUNAKAN FORMAT BAB (TIDAK ADA BAB I, BAB II, BAB III). Anda WAJIB membuat pengantar singkat/abstrak ke dalam field \`pendahuluan\`. Kemudian, gunakan field \`cellAnalyses\` untuk memaparkan poin-poin penting, dokumentasi, analisis acara, fitur produk/pameran, dll secara dinamis. Jawab dengan paragraf yang rapi dan profesional.'`;

const replaceStr = `    : ctx.isResume
    ? 'PENTING: Ini adalah format LAPORAN RESUME. DOKUMEN INI TIDAK MENGGUNAKAN FORMAT BAB (TIDAK ADA BAB I, BAB II, BAB III). Anda WAJIB membuat pengantar/abstrak ke dalam field \`pendahuluan\`. KHUSUS UNTUK RESUME: Lakukan ekstraksi SEMUA TEKS dan INFORMASI dari gambar poster/modul secara SANGAT MENDETAIL dan LENGKAP (Poin per poin jika diperlukan). Gunakan field \`cellAnalyses\` untuk memaparkan poin-poin tersebut secara komprehensif. JANGAN MERINGKAS terlalu pendek, tulis sepanjang dan selengkap mungkin sesuai konten di gambar. Jawab dengan paragraf yang rapi dan profesional.'`;

code = code.replace(targetStr, replaceStr);
fs.writeFileSync('src/lib/ai/prompts.ts', code);
console.log("Patched prompts.ts successfully");
