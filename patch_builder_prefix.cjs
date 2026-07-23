const fs = require('fs');
let content = fs.readFileSync('src/lib/docx/builder.ts', 'utf8');

// implCells prefix
content = content.replace(
  /await renderNotebookCells\(implCells, aiData, 'II', implCodeIndex, implImageIndex\);/,
  "await renderNotebookCells(implCells, aiData, isResume ? '' : 'II', implCodeIndex, implImageIndex);"
);

// postTestCells prefix
content = content.replace(
  /await renderNotebookCells\(postTestCells, aiData, 'III', postTestCodeIndex, postTestImageIndex\);/,
  "await renderNotebookCells(postTestCells, aiData, isResume ? '' : 'III', postTestCodeIndex, postTestImageIndex);"
);

// renderOrphanImages prefix
content = content.replace(
  /await renderOrphanImages\(implImages, orphans, 'II', implImageIndex\);/,
  "await renderOrphanImages(implImages, orphans, isResume ? '' : 'II', implImageIndex);"
);

// renderOrphanImages postTest
content = content.replace(
  /await renderOrphanImages\(postTestImages, postOrphans, 'III', postTestImageIndex\);/,
  "await renderOrphanImages(postTestImages, postOrphans, isResume ? '' : 'III', postTestImageIndex);"
);

// renderCAnalysis (II)
content = content.replace(
  /await renderCAnalysis\(cAnalysis, 'II', implImageIndex\);/,
  "await renderCAnalysis(cAnalysis, isResume ? '' : 'II', implImageIndex);"
);

content = content.replace(
  /await renderCAnalysis\(cAnalysis, 'II', kesimpulanImageIndex\);/,
  "await renderCAnalysis(cAnalysis, isResume ? '' : 'II', kesimpulanImageIndex);"
);

// renderCAnalysis (III)
content = content.replace(
  /await renderCAnalysis\(cAnalysis, 'III', kesimpulanImageIndex\);/,
  "await renderCAnalysis(cAnalysis, isResume ? '' : 'III', kesimpulanImageIndex);"
);

fs.writeFileSync('src/lib/docx/builder.ts', content);
