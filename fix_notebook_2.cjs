const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

const replacement = `    const htmlImages: Paragraph[] = [];
    if (cell.outputs) {
      const htmlOutputs = cell.outputs.filter(o => o.type === 'html' && o.content.trim());
      const rasterizedRuns = await Promise.all(
        htmlOutputs.map(async (output) => {
          const imgData = await rasterizeHtml(output.content);
          if (!imgData) {
            return { failedOutput: output };
          }
          const htmlRun = await toImageRun(
            { buffer: imgData.buffer, measureSrc: '', forceType: 'png' },
            { maxWidth: MAX_IMG_WIDTH, preMeasured: { width: imgData.width, height: imgData.height } },
          );
          return { run: htmlRun, output };
        })
      );
      
      for (const result of rasterizedRuns) {
        if (result.run) {
          htmlImages.push(
            new Paragraph({
              alignment: AlignmentType.CENTER,
              children: [result.run],
            }),
            new Paragraph({
              heading: HeadingLevel.HEADING_4,
              alignment: AlignmentType.CENTER,
              children: [
                new TextRun({
                  text: \`Gambar \${chapterPrefix}.\${imgIdx} \${tableCaption}\`,
                  size: 22,
                  font: FONT_CALIBRI,
                }),
              ],
              spacing: { before: 100, after: 300 },
            }),
          );
          imgIdx++;
        } else if (result.failedOutput && (result.failedOutput as any).fallbackText) {
          let lines = (result.failedOutput as any).fallbackText.split('\\n');
          const MAX_LINES = 500;
          if (lines.length > MAX_LINES) {
            lines = [
              ...lines.slice(0, 80),
              '',
              '... [OUTPUT TRUNCATED / TERPOTONG KARENA TERLALU PANJANG] ...',
              '',
              ...lines.slice(-15)
            ];
          }
          const outputParagraphs = lines.map((line: string) =>
            new Paragraph({
              children: [new TextRun({ text: sanitizeText(line.substring(0, 15000)), font: FONT_MONO, size: 20 })],
              spacing: { line: 240 },
            }),
          );
          tableRows.push(titledRow('Hasil Output'), contentRow(outputParagraphs));
        } else if (result.failedOutput) {
          tableRows.push(titledRow('Hasil Output'), contentRow([
            new Paragraph({
              children: [new TextRun({ text: '[Output HTML tidak dapat ditampilkan]', font: FONT_MONO, size: 20, italics: true, color: '888888' })],
              spacing: { line: 240 },
            })
          ]));
        }
      }

      for (const output of cell.outputs) {
        if (output.type === 'text' && output.content.trim()) {`;

const target = `    const htmlImages: Paragraph[] = [];
    if (cell.outputs) {
      for (const output of cell.outputs) {
        if (output.type === 'html' && output.content.trim()) {
          const imgData = await rasterizeHtml(output.content);
          if (imgData) {
            const htmlRun = await toImageRun(
              { buffer: imgData.buffer, measureSrc: '', forceType: 'png' },
              { maxWidth: MAX_IMG_WIDTH, preMeasured: { width: imgData.width, height: imgData.height } },
            );
            if (htmlRun) {
              htmlImages.push(
                new Paragraph({
                  alignment: AlignmentType.CENTER,
                  children: [htmlRun],
                }),
                new Paragraph({
                  heading: HeadingLevel.HEADING_4,
                  alignment: AlignmentType.CENTER,
                  children: [
                    new TextRun({
                      text: \`Gambar \${chapterPrefix}.\${imgIdx} \${tableCaption}\`,
                      size: 22,
                      font: FONT_CALIBRI,
                    }),
                  ],
                  spacing: { before: 100, after: 300 },
                }),
              );
              imgIdx++;
            }
          } else if ((output as any).fallbackText) {
            // Rasterization failed — fall back to plaintext fallback rendering.
            let lines = (output as any).fallbackText.split('\\n');
            const MAX_LINES = 500;
            if (lines.length > MAX_LINES) {
              lines = [
                ...lines.slice(0, 80),
                '',
                '... [OUTPUT TRUNCATED / TERPOTONG KARENA TERLALU PANJANG] ...',
                '',
                ...lines.slice(-15)
              ];
            }
            const outputParagraphs = lines.map((line: string) =>
              new Paragraph({
                children: [new TextRun({ text: sanitizeText(line.substring(0, 15000)), font: FONT_MONO, size: 20 })],
                spacing: { line: 240 },
              }),
            );
            tableRows.push(titledRow('Hasil Output'), contentRow(outputParagraphs));
          } else {
            // Pure HTML with no fallback
            tableRows.push(titledRow('Hasil Output'), contentRow([
              new Paragraph({
                children: [new TextRun({ text: '[Output HTML tidak dapat ditampilkan]', font: FONT_MONO, size: 20, italics: true, color: '888888' })],
                spacing: { line: 240 },
              })
            ]));
          }
        } else if (output.type === 'text' && output.content.trim()) {`;

if (code.includes(target)) {
  code = code.replace(target, replacement);
  fs.writeFileSync('src/lib/docx/notebook.ts', code);
  console.log('Notebook HTML parallelization successful');
} else {
  console.log('Notebook HTML parallelization failed: Target not found');
}
