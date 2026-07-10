const fs = require('fs');
let code = fs.readFileSync('src/components/AppMain.tsx', 'utf8');

code = code.replace(
  "import { useReportDownload } from '@/hooks/use-report-download';",
  ""
);

code = code.replace(
  "const { download } = useReportDownload(activeSession);",
  ""
);

code = code.replace(
  /download\(\);\s*setFileMenuOpen\(false\);/,
  "window.dispatchEvent(new Event('export-docx'));\n                          setFileMenuOpen(false);"
);

code = code.replace(
  "e.target.setPointerCapture(e.pointerId);",
  "(e.target as Element).setPointerCapture(e.pointerId);"
);

code = code.replace(
  "e.target.releasePointerCapture(e.pointerId);",
  "(e.target as Element).releasePointerCapture(e.pointerId);"
);

fs.writeFileSync('src/components/AppMain.tsx', code);
