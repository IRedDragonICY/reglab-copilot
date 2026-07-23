const fs = require('fs');
let content = fs.readFileSync('src/lib/ai/agent-loop.test.ts', 'utf8');

content = content.replace(
  /mockGenerateContentStream\.mockResolvedValueOnce\(\s*asyncIterable\(\[\s*textChunk\('Okay, continuing'\)\s*\]\)\s*\);/g,
  "mockGenerateContentStream.mockResolvedValueOnce(asyncIterable([textChunk('Okay, continuing')])).mockResolvedValueOnce(asyncIterable([textChunk('Third call')]));"
);

fs.writeFileSync('src/lib/ai/agent-loop.test.ts', content);
