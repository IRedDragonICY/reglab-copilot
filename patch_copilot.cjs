const fs = require('fs');
let code = fs.readFileSync('src/components/copilot-panel.tsx', 'utf8');

if (!code.includes("import ReactMarkdown")) {
  code = code.replace(
    "import { useState, useEffect, useRef } from 'react';",
    "import { useState, useEffect, useRef } from 'react';\nimport ReactMarkdown from 'react-markdown';"
  );
}

const thoughtComponents = `components={{
                  strong: ({ children }) => <strong className="font-semibold text-[#D1D1D1]">{children}</strong>,
                  em: ({ children }) => <em className="italic">{children}</em>,
                  code: ({ children }) => <code className="bg-[#111111] px-1 rounded text-[#D1D1D1]">{children}</code>,
                  p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
                  ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
                  ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
                  li: ({ children }) => <li className="mb-1">{children}</li>,
                }}`;

const textComponents = `components={{
            strong: ({ children }) => <strong className="font-semibold text-white">{children}</strong>,
            em: ({ children }) => <em className="italic">{children}</em>,
            code: ({ children }) => <code className="bg-[#1A1A1A] text-[#2F81F7] px-1 py-0.5 rounded text-[12px]">{children}</code>,
            pre: ({ children }) => <pre className="bg-[#1A1A1A] p-2 rounded my-2 overflow-x-auto text-[12px]">{children}</pre>,
            p: ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
            ul: ({ children }) => <ul className="list-disc pl-4 mb-2">{children}</ul>,
            ol: ({ children }) => <ol className="list-decimal pl-4 mb-2">{children}</ol>,
            li: ({ children }) => <li className="mb-1">{children}</li>,
            a: ({ href, children }) => <a href={href} className="text-[#2F81F7] hover:underline" target="_blank" rel="noreferrer">{children}</a>,
          }}`;

code = code.replace(
  /\{\s*msg\.thought \?\s*\(\s*msg\.thought\s*\)\s*:/,
  `{msg.thought ? (\n                  <ReactMarkdown ${thoughtComponents}>{msg.thought}</ReactMarkdown>\n                ) :`
);

code = code.replace(
  /\{\s*msg\.text\s*\}/,
  `<ReactMarkdown ${textComponents}>{msg.text}</ReactMarkdown>`
);

// We need to also remove `whitespace-pre-wrap` from the thought div because ReactMarkdown creates p tags that handle wrapping
code = code.replace(/whitespace-pre-wrap leading-\[1\.55\]/, "leading-[1.55]");

// Also remove `whitespace-pre-wrap` from msg.text container
code = code.replace(/text-\[\#EDEDED\] whitespace-pre-wrap/, "text-[#EDEDED]");

fs.writeFileSync('src/components/copilot-panel.tsx', code);
console.log("Patched copilot-panel.tsx");
