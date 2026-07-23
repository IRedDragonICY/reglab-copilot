const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const oldPrompt = `    ? (isEventResume 
        ? 'PENTING: Ini adalah format LAPORAN RESUME ACARA/PAMERAN (Kuliah). Anda WAJIB membuat narasi BAB I PENDAHULUAN yang menceritakan latar belakang, tema acara, dan tujuan pameran berdasarkan teks di dalam gambar poster atau Modul Context. Pada bagian implementasi (BAB II), buat entri \`cellAnalyses\` yang mendeskripsikan dokumentasi kehadiran Anda dan rincian inovasi/karya yang dipamerkan (baca poster INOTEKAI dengan teliti, seperti latar belakang, fitur, tujuan, keunggulan, Raspberry Pi, dsb untuk dijabarkan di explanation). Jawab dengan lengkap!'
        : 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field \`pendahuluan\` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.')
    : 'Ini adalah format LAPORAN PRAKTIKUM.';`;

const newPrompt = `    ? 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field \`pendahuluan\` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.'
    : ctx.isResume
    ? 'PENTING: Ini adalah format LAPORAN RESUME. DOKUMEN INI TIDAK MENGGUNAKAN FORMAT BAB (TIDAK ADA BAB I, BAB II, BAB III). Anda WAJIB membuat pengantar singkat/abstrak ke dalam field \`pendahuluan\`. Kemudian, gunakan field \`cellAnalyses\` untuk memaparkan poin-poin penting, dokumentasi, analisis acara, fitur produk/pameran, dll secara dinamis. Jawab dengan paragraf yang rapi dan profesional.'
    : 'Ini adalah format LAPORAN PRAKTIKUM.';`;

content = content.replace(oldPrompt, newPrompt);
fs.writeFileSync('src/lib/ai/prompts.ts', content);
