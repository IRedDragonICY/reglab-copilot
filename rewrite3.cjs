const fs = require('fs');
let text = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

text = text.replace(
  /if \(analysis\.section === 'post_test' && analysis\.imageIndex !== undefined\) \{\n\s*const img = postTestImages\[analysis\.imageIndex\];\n\s*if \(img\) \{\n\s*usedPostTestImages\.add\(analysis\.imageIndex\);/,
  `if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
          const categoryToUse = analysis.imageCategory || 'post_test';
          let img;
          if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
          else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
          else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];
          
          if (img) {
            usedPostTestImages.add(categoryToUse + '-' + analysis.imageIndex);`
);

text = text.replace(
  /const unusedPostTestImages = postTestImages\.filter\(\(\_, idx\) => !usedPostTestImages\.has\(idx\)\);/,
  `const unusedPostTestImages = postTestImages.filter((_, idx) => !usedPostTestImages.has('post_test-' + idx) && !usedImplImages.has('post_test-' + idx));`
);

fs.writeFileSync('src/lib/docx/builder.ts', text);
