const fs = require('fs');
let lines = fs.readFileSync('src/lib/docx/builder.ts', 'utf8').split('\n');

// let's just do a clean replacement from line 500 to 540 if needed, or better, we can replace the malformed line.
let content = lines.join('\n');
content = content.replace(/new TextRun\(\{ text: 'BAB III', bold: true, size: 22, font: 'Calibri', color: '000000' \} else if \(isResume\) \{[\s\S]*?bodyChildren\.push\(\.\.\.elements\);\n  \}\),/, 
`new TextRun({ text: 'BAB III', bold: true, size: 22, font: 'Calibri', color: '000000' }),`);

// now we need to insert the isResume logic properly at the end of the block.
// Let's find where the `if (!isKuliah && !isResume)` block ends, or rather where the `else if (isKuliah) {` block ends.
// Wait, the else if (isKuliah) ends around `bodyChildren.push(...elements);`
content = content.replace(/let kesimpulanImageIndex = 1;\n    const \{ elements \} = await renderCAnalysis\(cAnalysis, 'III', kesimpulanImageIndex\);\n    bodyChildren\.push\(\.\.\.elements\);\n  \}/, 
`let kesimpulanImageIndex = 1;
    const { elements } = await renderCAnalysis(cAnalysis, 'III', kesimpulanImageIndex);
    bodyChildren.push(...elements);
  } else if (isResume) {
    let kesimpulanImageIndex = 1;
    const { elements } = await renderCAnalysis(cAnalysis, 'II', kesimpulanImageIndex);
    bodyChildren.push(...elements);
  }`);

fs.writeFileSync('src/lib/docx/builder.ts', content);
