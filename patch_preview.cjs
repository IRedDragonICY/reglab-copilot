const fs = require('fs');
let content = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

content = content.replace(
  /\{metadata\.reportType === 'kuliah' \? 'LAPORAN KULIAH' : 'LAPORAN PRAKTIKUM'\}/g,
  "{metadata.reportType === 'resume' ? 'LAPORAN RESUME' : metadata.reportType === 'kuliah' ? 'LAPORAN KULIAH' : 'LAPORAN PRAKTIKUM'}"
);

content = content.replace(
  /\{metadata\.mataPraktikum \|\| \(metadata\.reportType === 'kuliah' \? '\[Mata Kuliah\]' : '\[Mata Praktikum\]'\)\}/g,
  "{metadata.mataPraktikum || (metadata.reportType === 'resume' ? '[Acara / Topik]' : metadata.reportType === 'kuliah' ? '[Mata Kuliah]' : '[Mata Praktikum]')}"
);

content = content.replace(
  /\{metadata\.reportType === 'kuliah' \? 'Topik' : 'Materi'\}/g,
  "{metadata.reportType === 'resume' ? 'Topik / Acara' : metadata.reportType === 'kuliah' ? 'Topik' : 'Materi'}"
);

content = content.replace(
  /\{metadata\.reportType === 'kuliah' \? \(/g,
  "{metadata.reportType !== 'praktikum' ? ("
);

content = content.replace(
  /metadata\.reportType !== 'kuliah' && \(/g,
  "metadata.reportType === 'praktikum' && ("
);

fs.writeFileSync('src/components/report-preview.tsx', content);
