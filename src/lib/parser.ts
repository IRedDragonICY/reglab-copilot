export interface NotebookCell {
  cell_type: 'code' | 'markdown' | 'raw';
  source: string;
  outputs?: NotebookOutput[];
}

export interface NotebookOutput {
  type: 'text' | 'image' | 'html';
  content: string; // text content or base64 string
  fallbackText?: string;
}

export interface ParsedNotebook {
  cells: NotebookCell[];
}

export function parseNotebook(jsonContent: string): ParsedNotebook {
  try {
    const notebook = JSON.parse(jsonContent);
    if (!notebook || !Array.isArray(notebook.cells)) {
      throw new Error('Invalid notebook format: missing cells array.');
    }

    const parsedCells: NotebookCell[] = notebook.cells.map((cell: any) => {
      const source = Array.isArray(cell.source) ? cell.source.join('') : (cell.source || '');
      
      let outputs: NotebookOutput[] = [];
      if (cell.cell_type === 'code' && Array.isArray(cell.outputs)) {
        cell.outputs.forEach((output: any) => {
          if (output.output_type === 'stream') {
            const text = Array.isArray(output.text) ? output.text.join('') : (output.text || '');
            outputs.push({ type: 'text', content: text });
          } else if (output.output_type === 'execute_result' || output.output_type === 'display_data') {
            if (output.data) {
              if (output.data['image/png']) {
                const imgData = Array.isArray(output.data['image/png']) ? output.data['image/png'].join('') : output.data['image/png'];
                outputs.push({ type: 'image', content: imgData });
              } else if (output.data['text/html'] && output.data['text/plain']) {
                const textPlain = Array.isArray(output.data['text/plain']) ? output.data['text/plain'].join('') : output.data['text/plain'];
                const textHtml = Array.isArray(output.data['text/html']) ? output.data['text/html'].join('') : output.data['text/html'];
                
                // If it has text/html, always prefer it so it becomes an image in the DOCX (as requested by user)
                outputs.push({ type: 'html', content: textHtml, fallbackText: textPlain });
              } else if (output.data['text/html']) {
                const text = Array.isArray(output.data['text/html']) ? output.data['text/html'].join('') : output.data['text/html'];
                outputs.push({ type: 'html', content: text });
              } else if (output.data['text/plain']) {
                const text = Array.isArray(output.data['text/plain']) ? output.data['text/plain'].join('') : output.data['text/plain'];
                outputs.push({ type: 'text', content: text });
              }
            }
          } else if (output.output_type === 'error') {
             const ename = output.ename || '';
             const evalue = output.evalue || '';
             outputs.push({ type: 'text', content: `${ename}: ${evalue}` });
          }
        });
      }

      return {
        cell_type: cell.cell_type,
        source,
        outputs: outputs.length > 0 ? outputs : undefined,
      };
    });

    return { cells: parsedCells };
  } catch (error) {
    console.error('Failed to parse notebook:', error);
    throw new Error('Failed to parse notebook file.');
  }
}

export function categorizeNotebookCells(notebook: ParsedNotebook, nbIdx: number, cellAnalysesArray: any[]) {
  const sections = new Array(notebook.cells.length).fill('implementasi');
  
  let currentSection = 'implementasi';

  for (let i = 0; i < notebook.cells.length; i++) {
    const cell = notebook.cells[i];

    // Priority 1: Did AI explicitly give a section to this mapped cell (markdown or code)?
    const analysis = cellAnalysesArray?.find(a => 
       a.cellIndex === i && (a.notebookIndex === undefined || a.notebookIndex === nbIdx)
    );

    if (analysis?.section) {
       currentSection = analysis.section;
    } else if (cell.cell_type === 'markdown') {
      // Priority 2: Keyword match in markdown
      const sourceLower = cell.source.toLowerCase();
      if (sourceLower.includes('post test') || sourceLower.includes('post-test') || sourceLower.includes('kesimpulan') || sourceLower.includes('kesimpulan dan evaluasi')) {
         currentSection = 'post_test';
      }
    }
    
    sections[i] = currentSection;
  }

  return sections;
}

export async function preprocessMathToImages(text: string): Promise<string> {
  if (!text) return text;
  
  if (!text.includes('$') && !text.includes('\\(') && !text.includes('\\[')) return text;

  // We need to dynamically import getMathPng from katexToImage
  // to avoid trying to parse it immediately if it's not needed
  const { getMathPng } = await import('./katexToImage');

  let processed = text;
  
  // Use regex with asynchronous replacement
  // Replace block math (multi-line or single line with $$ or \[ \])
  const blockRegex = /(?:\$\$|\\\[)\s*([\s\S]+?)\s*(?:\$\$|\\\])/g;
  let blockMatches = [...processed.matchAll(blockRegex)];
  
  for (const match of blockMatches) {
    try {
        const math = match[1];
        const dataUrl = await getMathPng(math, true);
        processed = processed.replace(match[0], `\n\n![math_block](${dataUrl})\n\n`);
    } catch(e) {
        console.error("Math processing error:", e);
    }
  }
  
  // Replace inline math ($...$ or \( ... \))
  // We use a negative lookbehind/lookahead to prevent matching $$ or \\ or escaped \$
  // Actually, standard inline regex:
  const inlineRegex = /(?:(?<!\$)\$(?!\$)|\\\()\s*(.+?)\s*(?:(?<!\$)\$(?!\$)|\\\))/g;
  let inlineMatches = [...processed.matchAll(inlineRegex)];
  
  for (const match of inlineMatches) {
    try {
        const math = match[1];
        const dataUrl = await getMathPng(math, false);
        processed = processed.replace(match[0], `![math_inline](${dataUrl})`);
    } catch (e) {
        console.error("Math processing error:", e);
    }
  }

  return processed;
}
