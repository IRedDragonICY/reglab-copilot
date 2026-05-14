/**
 * Render a LaTeX string to a base-64 PNG via KaTeX + html2canvas.
 *
 * Both heavy deps (`katex`, `html2canvas-pro`) are loaded via dynamic
 * imports so they split into their own chunks and never appear in the
 * initial JS payload. This module is itself loaded lazily by
 * `parser.ts`'s `preprocessMathToImages`, so the chain triggers only
 * when text containing `$…$` flows through the docx builder.
 */
export async function getMathPng(latex: string, display: boolean): Promise<string> {
  // Create an off-screen element.
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '0px',
    left: '-9999px',
    zIndex: '-9999',
    backgroundColor: 'white',
    color: 'black', // Force black so it's not invisible in dark-mode hosts.
    padding: '2px',
    display: 'inline-block',
    pointerEvents: 'none',
  });

  try {
    const [{ default: katex }, { default: html2canvas }] = await Promise.all([
      import('katex'),
      import('html2canvas-pro'),
    ]);

    katex.render(latex, container, {
      displayMode: display,
      throwOnError: false,
      output: 'html',
    });

    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      backgroundColor: '#ffffff',
      scale: 2,
      logging: false,
    });

    document.body.removeChild(container);
    return canvas.toDataURL('image/png');
  } catch (err) {
    if (document.body.contains(container)) document.body.removeChild(container);
    console.error('KaTeX to Image failed:', err);
    throw err;
  }
}
