const fs = require('fs');
let code = fs.readFileSync('src/main.tsx', 'utf8');
code = code.replace(
  'class GlobalErrorBoundary extends React.Component {',
  'class GlobalErrorBoundary extends React.Component<{ children: React.ReactNode }, { hasError: boolean, error: Error | null }> {'
);
fs.writeFileSync('src/main.tsx', code);
