import { TextRun } from 'docx';
import { sanitizeText } from './docxBuilder';

// Expanded set of Python keywords and built-ins for comprehensive syntax highlighting
const pythonKeywords = new Set([
  'and', 'as', 'assert', 'async', 'await', 'break', 'class', 'continue',
  'def', 'del', 'elif', 'else', 'except', 'False', 'finally', 'for',
  'from', 'global', 'if', 'import', 'in', 'is', 'lambda', 'None',
  'nonlocal', 'not', 'or', 'pass', 'raise', 'return', 'True', 'try',
  'while', 'with', 'yield'
]);

const pythonBuiltins = new Set([
  'print', 'len', 'int', 'str', 'float', 'list', 'dict', 'set', 'tuple',
  'open', 'range', 'type', 'dir', 'id', 'max', 'min', 'sum', 'abs', 'round',
  'any', 'all', 'enumerate', 'zip', 'map', 'filter', 'isinstance', 'issubclass',
  'super', 'Exception', 'ValueError', 'TypeError', 'IndexError', 'KeyError',
  'RuntimeError', 'np', 'pd', 'plt', 'cv2', 'os' // added common aliases for practical coloring
]);

export function highlightPythonLine(line: string): TextRun[] {
  const runs: TextRun[] = [];
  
  // This Regex breaks down the python line into identifiable tokens:
  // 1. Whitespace (\s+)
  // 2. Comments (#.*)
  // 3. Multi-line strings ("""...""" or '''...''') - matched per individual string parts
  // 4. Double quote strings ("[^\\]*(?:\\.[^\\]*)*")
  // 5. Single quote strings ('[^\\]*(?:\\.[^\\]*)*')
  // 6. Decorators (@[a-zA-Z_]\w*)
  // 7. Numbers (integers, floats, scientific)
  // 8. Identifiers (words/variables)
  // 9. All other symbols/operators
  const tokenRegex = /(\s+|#.*|"""[\s\S]*?"""|'''[\s\S]*?'''|"[^"\\]*(?:\\.[^"\\]*)*"|'[^'\\]*(?:\\.[^'\\]*)*'|@[a-zA-Z_]\w*|\b[0-9]+(?:\.[0-9]+)?(?:[eE][+-]?[0-9]+)?\b|\b[a-zA-Z_]\w*\b|\W)/;
  
  const tokens = line.split(tokenRegex).filter(Boolean);

  let isNextFuncName = false;
  let isNextClassName = false;

  for (const token of tokens) {
    let color = '000000'; // Default black
    let italics = false;
    let bold = false;

    // Comments
    if (token.startsWith('#')) {
      color = '008000'; // Dark green
      italics = true;
    } 
    // Strings (Single, Double, Multi)
    else if (token.startsWith('"') || token.startsWith("'")) {
      color = 'A31515'; // Red-brown
    } 
    // Decorators
    else if (token.startsWith('@')) {
      color = '008080'; // Teal
    } 
    // Keywords
    else if (pythonKeywords.has(token)) {
      color = '0000FF'; // Blue
      bold = true;
      if (token === 'def') isNextFuncName = true;
      if (token === 'class') isNextClassName = true;
    } 
    // Builtin functions and well-known data science aliases
    else if (pythonBuiltins.has(token)) {
      color = '795E26'; // Brown/Yellowish
    } 
    // Numbers
    else if (/^[0-9]+(?:\.[0-9]+)?/.test(token)) {
      color = '098658'; // Greenish
    } 
    // Variable names / Identifiers / Function names
    else if (/^[a-zA-Z_]\w*$/.test(token)) {
      if (isNextFuncName) {
        color = '795E26'; // Method/function names
        isNextFuncName = false;
      } else if (isNextClassName) {
        color = '267F99'; // Class names
        isNextClassName = false;
      } else if (token === 'self') {
        color = '0000FF'; // self behaves like a keyword in syntax highlighters often
      } else {
        color = '001080'; // Dark blue for variables (VS Code default light theme style)
      }
    } 
    // Symbols / Operators
    else {
      color = '000000'; // Black
      if (token.trim() !== '') {
        // Reset flags if any other non-whitespace character appears
        isNextFuncName = false;
        isNextClassName = false;
      }
    }

    runs.push(new TextRun({ 
      text: sanitizeText(token), 
      font: 'Courier New', 
      size: 20, 
      color, 
      italics, 
      bold 
    }));
  }
  
  return runs;
}
