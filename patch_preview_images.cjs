const fs = require('fs');
let code = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

// Replace usedImplImageIndexes definition
code = code.replace(
  /const usedImplImageIndexes = new Set<number>\(\);/g,
  "const usedImplImageIndexes = new Set<string>();"
);
// Replace its usage in cellAnalysesArray for implementasi
code = code.replace(
  /if \(analysis\.section === 'implementasi' && analysis\.imageIndex !== undefined\) \{\n\s*usedImplImageIndexes\.add\(analysis\.imageIndex\);\n\s*const img = implImages\[analysis\.imageIndex\];/g,
  `if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
      const categoryToUse = analysis.imageCategory || 'implementasi';
      usedImplImageIndexes.add(categoryToUse + '-' + analysis.imageIndex);
      let img;
      if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
      else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
      else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];`
);
// Replace usedPostTestImageIndexes definition
code = code.replace(
  /const usedPostTestImageIndexes = new Set<number>\(\);/g,
  "const usedPostTestImageIndexes = new Set<string>();"
);
// Replace its usage in cellAnalysesArray for post_test
code = code.replace(
  /if \(analysis\.section === 'post_test' && analysis\.imageIndex !== undefined\) \{\n\s*usedPostTestImageIndexes\.add\(analysis\.imageIndex\);\n\s*const img = postTestImages\[analysis\.imageIndex\];/g,
  `if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
      const categoryToUse = analysis.imageCategory || 'post_test';
      usedPostTestImageIndexes.add(categoryToUse + '-' + analysis.imageIndex);
      let img;
      if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
      else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
      else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];`
);

// Replace cAnalysis push
code = code.replace(
  /usedImplImageIndexes\.add\(item\.imageIndex\);/g,
  "usedImplImageIndexes.add((item.imageCategory || 'implementasi') + '-' + item.imageIndex);"
);

// Replace final filter
code = code.replace(
  /const finalUnusedImplImages = implImages\.filter\(\(_, i\) => !usedImplImageIndexes\.has\(i\)\);/g,
  "const finalUnusedImplImages = implImages.filter((_, i) => !usedImplImageIndexes.has('implementasi-' + i) && !usedPostTestImageIndexes.has('implementasi-' + i));"
);
code = code.replace(
  /const finalUnusedPostTestImages = postTestImages\.filter\(\(_, i\) => !usedPostTestImageIndexes\.has\(i\)\);/g,
  "const finalUnusedPostTestImages = postTestImages.filter((_, i) => !usedPostTestImageIndexes.has('post_test-' + i) && !usedImplImageIndexes.has('post_test-' + i));"
);

fs.writeFileSync('src/components/report-preview.tsx', code);
