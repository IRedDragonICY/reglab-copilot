const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

code = code.replace(/const htmlOutputs = cell\.outputs\.filter[\s\S]*?if \(htmlRun\) \{/m, `for (const output of cell.outputs) {
        if (output.type === 'html' && output.content.trim()) {
          const imgData = await rasterizeHtml(output.content);
          if (imgData) {
            const htmlRun = await toImageRun(
              { buffer: imgData.buffer, measureSrc: '', forceType: 'png' },
              { maxWidth: MAX_IMG_WIDTH, preMeasured: { width: imgData.width, height: imgData.height } },
            );
            if (htmlRun) {`);

fs.writeFileSync('src/lib/docx/notebook.ts', code);
