const fs = require('fs');
let code = fs.readFileSync('src/components/session-tab.tsx', 'utf8');

if (!code.includes("window.addEventListener('export-docx'")) {
  code = code.replace(
    'return (',
    `  useEffect(() => {
    const handleExport = () => download();
    window.addEventListener('export-docx', handleExport);
    return () => window.removeEventListener('export-docx', handleExport);
  }, [download]);

  return (`
  );
  fs.writeFileSync('src/components/session-tab.tsx', code);
}
