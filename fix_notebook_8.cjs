const fs = require('fs');
let code = fs.readFileSync('src/lib/docx/notebook.ts', 'utf8');

const target1 = `    // Native image outputs (e.g. matplotlib \`image/png\`) emit after the caption.
    if (cell.outputs) {`;

const target2 = `        if (output.type !== 'image') continue;`;

const index1 = code.indexOf(target1);
const index2 = code.indexOf(target2, index1);

if (index1 !== -1 && index2 !== -1) {
  const replacement = `    // Native image outputs (e.g. matplotlib \`image/png\`) emit after the caption.
    if (cell.outputs) {
      for (const output of cell.outputs) {
        if (output.type !== 'image') continue;`;
        
  code = code.substring(0, index1) + replacement + code.substring(index2 + target2.length);
  fs.writeFileSync('src/lib/docx/notebook.ts', code);
  console.log("Success string fix!");
} else {
  console.log("Failed string fix");
}
