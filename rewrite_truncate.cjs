const fs = require('fs');
let text = fs.readFileSync('src/components/report-preview.tsx', 'utf8');

text = text.replace(
  /line\.length > 2000 \? line\.substring\(0, 2000\)/g,
  "line.length > 15000 ? line.substring(0, 15000)"
);

text = text.replace(
  /line\.length > 1000 \? line\.substring\(0, 1000\)/g,
  "line.length > 15000 ? line.substring(0, 15000)"
);

// also in builder? Let's check builder!

fs.writeFileSync('src/components/report-preview.tsx', text);
console.log("Done");
