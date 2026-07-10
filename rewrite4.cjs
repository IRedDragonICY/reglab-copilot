const fs = require('fs');
let text = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

const targetStr = `        if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
          const img = postTestImages[analysis.imageIndex];
          if (img) {
            usedPostTestImages.add(analysis.imageIndex);`;

const replaceStr = `        if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
          const categoryToUse = analysis.imageCategory || 'post_test';
          let img;
          if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
          else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
          else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];
          if (img) {
            usedPostTestImages.add(categoryToUse + '-' + analysis.imageIndex);`;

if (text.includes(targetStr)) {
  text = text.replace(targetStr, replaceStr);
  console.log("Replaced targetStr successfully");
} else {
  console.log("Could not find targetStr");
}

const targetStr2 = `const unusedPostTestImages = postTestImages.filter((_, idx) => !usedPostTestImages.has(idx));`;
const replaceStr2 = `const unusedPostTestImages = postTestImages.filter((_, idx) => !usedPostTestImages.has('post_test-' + idx) && !usedImplImages.has('post_test-' + idx));`;

if (text.includes(targetStr2)) {
  text = text.replace(targetStr2, replaceStr2);
  console.log("Replaced targetStr2 successfully");
} else {
  console.log("Could not find targetStr2");
}

fs.writeFileSync('src/lib/docx/builder.ts', text);
