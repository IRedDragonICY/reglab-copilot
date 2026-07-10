const fs = require('fs');
let text = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// Replace usedImplImages to be Set<string>
text = text.replace(
  /const usedImplImages = new Set<number>\(\);/,
  "const usedImplImages = new Set<string>();"
);

// Replace its usage in cellAnalysesArray
text = text.replace(
  /if \(analysis\.section === 'implementasi' && analysis\.imageIndex !== undefined\) \{\n\s*usedImplImages\.add\(analysis\.imageIndex\);\n\s*\}/g,
  `if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
        usedImplImages.add((analysis.imageCategory || 'implementasi') + '-' + analysis.imageIndex);
      }`
);

// Replace usage in cAnalysis
text = text.replace(
  /if \(item\.imageIndex !== undefined\) \{\n\s*usedImplImages\.add\(item\.imageIndex\);\n\s*\}/g,
  `if (item.imageIndex !== undefined) {
        usedImplImages.add((item.imageCategory || 'implementasi') + '-' + item.imageIndex);
      }`
);

// Replace second cellAnalysesArray loop for image rendering
text = text.replace(
  /if \(analysis\.section === 'implementasi' && analysis\.imageIndex !== undefined\) \{\n\s*const img = implImages\[analysis\.imageIndex\];/g,
  `if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
        const categoryToUse = analysis.imageCategory || 'implementasi';
        let img;
        if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
        else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
        else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];`
);

// Do the same for usedPostTestImages
text = text.replace(
  /const usedPostTestImages = new Set<number>\(\);/,
  "const usedPostTestImages = new Set<string>();"
);

text = text.replace(
  /if \(analysis\.section === 'post_test' && analysis\.imageIndex !== undefined\) \{\n\s*const img = postTestImages\[analysis\.imageIndex\];\n\s*if \(img\) \{\n\s*usedPostTestImages\.add\(analysis\.imageIndex\);/g,
  `if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
          const categoryToUse = analysis.imageCategory || 'post_test';
          let img;
          if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
          else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
          else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];
          if (img) {
            usedPostTestImages.add(categoryToUse + '-' + analysis.imageIndex);`
);

// Fix unused logic
text = text.replace(
  /for \(let i = 0; i < implImages\.length; i\+\+\) \{\n\s*if \(!usedImplImages\.has\(i\)\) \{/g,
  `for (let i = 0; i < implImages.length; i++) {
        if (!usedImplImages.has('implementasi-' + i) && !usedPostTestImages.has('implementasi-' + i)) {`
);

text = text.replace(
  /for \(let i = 0; i < postTestImages\.length; i\+\+\) \{\n\s*if \(!usedPostTestImages\.has\(i\)\) \{/g,
  `for (let i = 0; i < postTestImages.length; i++) {
        if (!usedPostTestImages.has('post_test-' + i) && !usedImplImages.has('post_test-' + i)) {`
);


fs.writeFileSync('src/lib/docx/builder.ts', text);
console.log('done docx builder replacement');
