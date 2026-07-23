const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/schema.ts', 'utf8');
content = content.replace(/pendahuluan: \{ type: Type\.STRING, description: 'Bab Pendahuluan yang memuat latar belakang kajian atau tugas secara komprehensif\. Susun narasinya dengan rapi\.' \},/, 
`judul_laporan: { type: Type.STRING, description: 'Judul laporan singkat dan padat yang digenerate secara otomatis berdasarkan konteks pameran/acara/praktikum JIKA belum ada judul yang diberikan (misalnya jika konteks menceritakan pameran INOTEKAI, buat judul terkait itu).' },
          pendahuluan: { type: Type.STRING, description: 'Bab Pendahuluan yang memuat latar belakang kajian atau tugas secara komprehensif. Susun narasinya dengan rapi.' },`);
fs.writeFileSync('src/lib/ai/schema.ts', content);
