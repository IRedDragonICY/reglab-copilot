const fs = require('fs');
let content = fs.readFileSync('src/components/settings-panel.tsx', 'utf8');

// The issue is that I used a regex that didn't match the exact text. 
// Let's replace instances of `{metadata.reportType !== 'kuliah' && (` one by one based on context.

content = content.replace(
  /\{metadata\.reportType !== 'kuliah' && \(\s*<div className="space-y-2">\s*<Label className="text-\[#a0a0a0\]">Pertemuan Ke-/,
  "{metadata.reportType === 'praktikum' && (\n          <div className=\"space-y-2\">\n            <Label className=\"text-[#a0a0a0]\">Pertemuan Ke-"
);

content = content.replace(
  /\{metadata\.reportType !== 'kuliah' && \(\s*<div className="space-y-2">\s*<Label className="text-\[#a0a0a0\]">Laboratorium/,
  "{metadata.reportType === 'praktikum' && (\n            <div className=\"space-y-2\">\n              <Label className=\"text-[#a0a0a0]\">Laboratorium"
);

content = content.replace(
  /\{metadata\.reportType !== 'kuliah' && \(\s*<div className="space-y-2">\s*<Label className="text-\[#a0a0a0\]">Soal\/Jawaban Pre Test/,
  "{metadata.reportType === 'praktikum' && (\n          <div className=\"space-y-2\">\n            <Label className=\"text-[#a0a0a0]\">Soal/Jawaban Pre Test"
);

fs.writeFileSync('src/components/settings-panel.tsx', content);
