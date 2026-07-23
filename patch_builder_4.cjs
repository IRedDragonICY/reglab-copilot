const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

const regex = /if \(cellAnalysesArray\) \{\s*for \(const analysis of cellAnalysesArray\) \{\s*if \(analysis\.section === 'post_test' && analysis\.imageIndex !== undefined\) \{\s*const categoryToUse = analysis\.imageCategory \|\| 'post_test';\s*let img;\s*if \(categoryToUse === 'implementasi'\) img = implImages\[analysis\.imageIndex\];\s*else if \(categoryToUse === 'post_test'\) img = postTestImages\[analysis\.imageIndex\];\s*else if \(categoryToUse === 'pre_test'\) img = preTestImages\[analysis\.imageIndex\];\s*if \(img\) \{\s*usedPostTestImages\.add\(\(analysis\.imageCategory \|\| 'post_test'\) \+ '-' \+ analysis\.imageIndex\);\s*bodyChildren\.push\(\s*new Paragraph\(\{\s*children: \[new TextRun\(\{ text: String\(analysis\.caption\)\.replace\(\/\['"\]\/g, ''\), bold: true, size: 22, font: 'Calibri' \}\)\],\s*spacing: \{ before: 200, after: 100 \},\s*\}\)\s*\);\s*const imgParagraphs = await createImagesParagraphs\(\[img\], String\(analysis\.caption\)\.replace\(\/\['"\]\/g, ''\), isResume \? '' : 'III', postTestImageIndex\);\s*bodyChildren\.push\(\.\.\.imgParagraphs\);\s*postTestImageIndex\+\+;\s*bodyChildren\.push\(\.\.\.\(await parseMarkdownToParagraphs\(analysis\.explanation\)\)\);\s*\}\s*\}\s*\}\s*\}/;

const replacement = `if (cellAnalysesArray) {
      for (const analysis of cellAnalysesArray) {
        if (analysis.section === 'post_test') {
          let renderedImage = false;
          if (analysis.imageIndex !== undefined) {
            const categoryToUse = analysis.imageCategory || 'post_test';
            let img;
            if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
            else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
            else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];
            if (img) {
              usedPostTestImages.add((analysis.imageCategory || 'post_test') + '-' + analysis.imageIndex);
              bodyChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: String(analysis.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
                  spacing: { before: 200, after: 100 },
                })
              );
              
              const imgParagraphs = await createImagesParagraphs([img], String(analysis.caption).replace(/['"]/g, ''), isResume ? '' : 'III', postTestImageIndex);
              bodyChildren.push(...imgParagraphs);
              postTestImageIndex++;
              bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
              renderedImage = true;
            }
          }
          
          if (!renderedImage && (notebooks.length === 0 || analysis.notebookIndex === -1)) {
            if (analysis.caption) {
              bodyChildren.push(
                new Paragraph({
                  children: [new TextRun({ text: String(analysis.caption).replace(/['"]/g, ''), bold: true, size: 22, font: 'Calibri' })],
                  spacing: { before: 200, after: 100 },
                })
              );
            }
            if (analysis.explanation) {
              bodyChildren.push(...(await parseMarkdownToParagraphs(analysis.explanation)));
            }
          }
        }
      }
    }`;

content = content.replace(regex, replacement);
fs.writeFileSync('src/lib/docx/builder.ts', content);
