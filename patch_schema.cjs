const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/schema.ts', 'utf8');

code = code.replace(
  /answers: { type: Type\.ARRAY, description: 'Jawaban soal pre test', items: { type: Type\.STRING } },/g,
  `answers: { type: Type.ARRAY, description: 'Jawaban soal pre test. WAJIB DIISI DENGAN JAWABAN YANG TEPAT! Gunakan pengetahuan Anda untuk memecahkan/menjawab soal.', items: { type: Type.STRING } },`
);

code = code.replace(
  /answers: { type: Type\.ARRAY, description: 'Jawaban post test detail', items: { type: Type\.STRING } },/g,
  `answers: { type: Type.ARRAY, description: 'Jawaban post test / solusi detail. WAJIB DIISI! Jawab semua pertanyaan post test dengan pengetahuan Anda secara mendalam. Jika melibatkan flowchart/diagram, terjemahkan/jelaskan diagram tersebut.', items: { type: Type.STRING } },`
);

fs.writeFileSync('src/lib/ai/schema.ts', code);
