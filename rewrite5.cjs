const fs = require('fs');
let text = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

text = text.replace(
  /usedPostTestImages\.add\(analysis\.imageIndex\);/g,
  "usedPostTestImages.add((analysis.imageCategory || 'post_test') + '-' + analysis.imageIndex);"
);

text = text.replace(
  /const img = postTestImages\[analysis\.imageIndex\];/g,
  `const categoryToUse = analysis.imageCategory || 'post_test';
          let img;
          if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
          else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
          else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];`
);

text = text.replace(
  /!usedPostTestImages\.has\(idx\)/g,
  "!usedPostTestImages.has('post_test-' + idx) && !usedImplImages.has('post_test-' + idx)"
);

fs.writeFileSync('src/lib/docx/builder.ts', text);
console.log("Done");
