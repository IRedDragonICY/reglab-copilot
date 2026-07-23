const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

content = content.replace(/const kuliahLead = ctx\.isKuliah[\s\S]*?: 'Ini adalah format LAPORAN PRAKTIKUM\.';/, `const kuliahLead = ctx.isKuliah
    ? 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field \`pendahuluan\` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.'
    : ctx.isResume
    ? 'PENTING: Ini adalah format LAPORAN RESUME. DOKUMEN INI TIDAK MENGGUNAKAN FORMAT BAB (TIDAK ADA BAB I, BAB II, BAB III). Anda WAJIB membuat pengantar singkat/abstrak ke dalam field \`pendahuluan\`. Kemudian, gunakan field \`cellAnalyses\` untuk memaparkan poin-poin penting, dokumentasi, analisis acara, fitur produk/pameran, dll secara dinamis. Jawab dengan paragraf yang rapi dan profesional.'
    : 'Ini adalah format LAPORAN PRAKTIKUM.';`);

fs.writeFileSync('src/lib/ai/prompts.ts', content);
