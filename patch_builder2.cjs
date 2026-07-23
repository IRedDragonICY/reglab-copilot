const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// The first block was already replaced.
content = content.replace(/if \(!isKuliah\) {(\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*children: \[new TextRun\(\{ text: 'II\. Hasil Praktikum'[\s\S]*?)} else {([\s\S]*?)}/m, (match, p1, p2) => {
  return `if (!isKuliah && !isResume) {${p1}} else if (isKuliah) {${p2}}`;
});

// Link Notebook:
// C. Implementasi/Screenshot
content = content.replace(/if \(!isKuliah\) {\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_2,\s*children: \[new TextRun\(\{ text: 'C\. Implementasi\/Screenshot'/m, `if (!isKuliah && !isResume) {
    bodyChildren.push(
      new Paragraph({
        heading: HeadingLevel.HEADING_2,
        children: [new TextRun({ text: 'C. Implementasi/Screenshot'`);

// BAB III KESIMPULAN
content = content.replace(/if \(!isKuliah\) {\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*heading: HeadingLevel\.HEADING_1,\s*children: \[new TextRun\(\{ text: 'III\. Post Test'[\s\S]*?)} else {([\s\S]*?)}/m, (match, p1, p2) => {
  return `if (!isKuliah && !isResume) {${match.substring(match.indexOf('{') + 1, match.lastIndexOf('}'))}} else if (isKuliah) {${p2}}`;
});
// wait the regex for BAB III Kesimpulan is a bit tricky.

fs.writeFileSync('src/lib/docx/builder.ts', content);
