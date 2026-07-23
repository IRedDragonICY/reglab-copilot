const fs = require('fs');
let code = fs.readFileSync('src/components/settings-panel.tsx', 'utf8');

code = code.replace(
  /{metadata\.reportType !== 'kuliah' && \(\s*<div className="space-y-2">\s*<Label className="text-\[#a0a0a0\]">Post-Test \/ Tugas \(Termasuk Bukti Google Form\)<\/Label>/g,
  "{metadata.reportType === 'praktikum' && (\n          <div className=\"space-y-2\">\n            <Label className=\"text-[#a0a0a0]\">Post-Test / Tugas (Termasuk Bukti Google Form)</Label>"
);

code = code.replace(
  /{metadata\.reportType !== 'kuliah' && \(\s*<div className="space-y-2 pt-2">\s*<Label className="text-\[#a0a0a0\]">Feedback \/ Ulasan Praktikum \(Opsional\)<\/Label>/g,
  "{metadata.reportType === 'praktikum' && (\n          <div className=\"space-y-2 pt-2\">\n            <Label className=\"text-[#a0a0a0]\">Feedback / Ulasan Praktikum (Opsional)</Label>"
);

const startIndex = code.indexOf('<div className="space-y-2">\n          <Label className="text-[#a0a0a0]">File Kode / Notebook Pembahasan</Label>');
const endIndex = code.indexOf('<ImageUploader images={implImages} onChange={setImplImages} label="Unggah Tangkapan Layar" />');

if (startIndex !== -1 && endIndex !== -1) {
    const middlePart = code.substring(startIndex, endIndex);
    const newMiddle = middlePart
        .replace('<Label className="text-[#a0a0a0]">File Kode / Notebook Pembahasan</Label>', 
                 '{metadata.reportType !== "resume" && (<>\n          <Label className="text-[#a0a0a0]">File Kode / Notebook Pembahasan</Label>')
        + '\n          </>)}';
    
    // also replace Unggah Tangkapan Layar
    const newEnd = '{metadata.reportType === "resume" ? <ImageUploader images={implImages} onChange={setImplImages} label="Unggah Foto/Poster/Kegiatan (Klik, Tarik, atau Ctrl+V)" /> : <ImageUploader images={implImages} onChange={setImplImages} label="Unggah Tangkapan Layar" />}';

    code = code.substring(0, startIndex) + newMiddle + '\n          ' + newEnd + '\n' + code.substring(endIndex + '<ImageUploader images={implImages} onChange={setImplImages} label="Unggah Tangkapan Layar" />'.length);
}

fs.writeFileSync('src/components/settings-panel.tsx', code);
