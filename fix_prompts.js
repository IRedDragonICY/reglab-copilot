const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const target = `    ? 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field \`pendahuluan\` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.'`;

const replacement = `    ? (isEventResume 
        ? 'PENTING: Ini adalah format LAPORAN RESUME ACARA/PAMERAN (Kuliah). Anda WAJIB membuat narasi BAB I PENDAHULUAN yang menceritakan latar belakang, tema acara, dan tujuan pameran berdasarkan teks di dalam gambar poster atau Modul Context. Pada bagian implementasi (BAB II), buat entri \`cellAnalyses\` yang mendeskripsikan dokumentasi kehadiran Anda dan rincian inovasi/karya yang dipamerkan (baca poster INOTEKAI dengan teliti, seperti latar belakang, fitur, tujuan, keunggulan, Raspberry Pi, dsb untuk dijabarkan di explanation). Jawab dengan lengkap!'
        : 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field \`pendahuluan\` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.')`;

content = content.replace(target, replacement);
fs.writeFileSync('src/lib/ai/prompts.ts', content);
