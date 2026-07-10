const fs = require('fs');
let text = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

const startIdx = text.indexOf('const usedImplImageIndexes = new Set<string>();');
const endIdx = text.indexOf('const allImageMocks =[');

if (startIdx !== -1 && endIdx !== -1) {
  const replaceStr = `const usedImplImageIndexes = new Set<string>();
  cellAnalysesArray?.forEach((analysis: any, aiIdx: number) => {
    if (analysis.section === 'implementasi' && analysis.imageIndex !== undefined) {
      const categoryToUse = analysis.imageCategory || 'implementasi';
      usedImplImageIndexes.add(categoryToUse + '-' + analysis.imageIndex);
      let img;
      if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
      else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
      else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];
      
      if (img && img.dataUrl) {
        implElements.push(
          <div key={\`impl-img-\${categoryToUse}-\${analysis.imageIndex}-\${aiIdx}\`} className="mb-8">
            <h3 className="font-bold mb-2">{(analysis.caption as string).replace(/['"]/g, '')}</h3>
            <PreviewImage src={img.dataUrl} caption={\`Gambar II.\${nextImgIdxII++} \${analysis.caption}\`} />
            <div className="mt-4 prose prose-sm max-w-none text-gray-900 text-justify">
              <MarkdownBlock content={analysis.explanation} />
            </div>
          </div>
        );
      }
    }
  });

  const postTestElements: React.ReactNode[] =[];
  let nextCodeIdxIII = 1;
  let nextImgIdxIII = 1;

  notebooks.forEach((nb, nbIdx) => {
    if (!nb) return;
    const sections = categorizeNotebookCells(nb, nbIdx, cellAnalysesArray ||[]);
    const postTestCells = nb.cells.map((c, i) => ({ cell: c, index: i, notebookIndex: nbIdx })).filter(item => sections[item.index] === 'post_test');
    const res = renderNotebookCells(postTestCells, 'III', nextCodeIdxIII, nextImgIdxIII);
    postTestElements.push(...res.elements);
    nextCodeIdxIII = res.nextCodeIdx;
    nextImgIdxIII = res.nextImgIdx;
  });

  const usedPostTestImageIndexes = new Set<string>();
  cellAnalysesArray?.forEach((analysis: any, aiIdx: number) => {
    if (analysis.section === 'post_test' && analysis.imageIndex !== undefined) {
      const categoryToUse = analysis.imageCategory || 'post_test';
      usedPostTestImageIndexes.add(categoryToUse + '-' + analysis.imageIndex);
      let img;
      if (categoryToUse === 'implementasi') img = implImages[analysis.imageIndex];
      else if (categoryToUse === 'post_test') img = postTestImages[analysis.imageIndex];
      else if (categoryToUse === 'pre_test') img = preTestImages[analysis.imageIndex];

      if (img && img.dataUrl) {
        postTestElements.push(
          <div key={\`post-img-\${categoryToUse}-\${analysis.imageIndex}-\${aiIdx}\`} className="mb-8">
            <h3 className="font-bold mb-2">{(analysis.caption as string).replace(/['"]/g, '')}</h3>
            <PreviewImage src={img.dataUrl} caption={\`Gambar III.\${nextImgIdxIII++} \${analysis.caption}\`} />
            <div className="mt-4 prose prose-sm max-w-none text-gray-900 text-justify">
              <MarkdownBlock content={analysis.explanation} />
            </div>
          </div>
        );
      }
    }
  });

  if (Array.isArray(cAnalysis)) {
    cAnalysis.forEach(item => {
      if (item.imageIndex !== undefined) {
        usedImplImageIndexes.add((item.imageCategory || 'implementasi') + '-' + item.imageIndex);
      }
    });
  }

  const finalUnusedImplImages = implImages.filter((_, i) => !usedImplImageIndexes.has('implementasi-' + i) && !usedPostTestImageIndexes.has('implementasi-' + i));
  const finalUnusedPostTestImages = postTestImages.filter((_, i) => !usedPostTestImageIndexes.has('post_test-' + i) && !usedImplImageIndexes.has('post_test-' + i));
  
  `;

  fs.writeFileSync('src/components/report-preview.tsx', text.substring(0, startIdx) + replaceStr + text.substring(endIdx));
  console.log("Replaced successfully");
} else {
  console.log("Could not find start/end string");
}

