const fs = require('fs');
let content = fs.readFileSync('src/hooks/use-copilot-ai.ts', 'utf8');

content = content.replace(/const activeDeclaration = isKuliah\n\s*\? generateKuliahReportDeclaration\n\s*: generateReportDeclaration;/, 'const activeDeclaration = isKuliah || isResume ? generateKuliahReportDeclaration : generateReportDeclaration;');

content = content.replace(/const activeDeclaration = isKuliah \? generateKuliahReportDeclaration : generateReportDeclaration;/, 'const activeDeclaration = isKuliah || isResume ? generateKuliahReportDeclaration : generateReportDeclaration;');

// also patch cursor.declarationKey check
content = content.replace(/cursor\.declarationKey === 'kuliah'/, "cursor.declarationKey === 'kuliah' || cursor.declarationKey === 'resume'");

// Also need to set the declaration key correctly for the continuation cursor.
content = content.replace(/declarationKey: isKuliah \? 'kuliah' : 'praktikum',/g, "declarationKey: isKuliah ? 'kuliah' : isResume ? 'resume' : 'praktikum',");

fs.writeFileSync('src/hooks/use-copilot-ai.ts', content);
