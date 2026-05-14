/**
 * Rasterize a snippet of HTML (notably pandas DataFrame `text/html` output)
 * into a PNG buffer that can be embedded as an `ImageRun` in a DOCX.
 *
 * Dynamically imports `html2canvas-pro` so the dependency is not bundled
 * into the initial chunk — it only loads when the builder actually has an
 * HTML output to rasterize. This is the first step toward R7; the docx
 * library itself becomes dynamic in task 14.
 */
export async function rasterizeHtml(
  htmlContent: string,
): Promise<{ buffer: ArrayBuffer; width: number; height: number } | null> {
  if (typeof document === 'undefined') return null;

  const div = document.createElement('div');
  const cleanHtmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  div.innerHTML = cleanHtmlContent;
  div.style.position = 'absolute';
  div.style.top = '-9999px';
  div.style.left = '-9999px';
  div.style.background = 'white';
  div.style.color = 'black';
  div.style.display = 'inline-block';

  // Normalize table styling so html2canvas-pro has consistent, non-oklch
  // CSS to render. Matches the pre-refactor rendering exactly.
  const tables = div.getElementsByTagName('table');
  for (let i = 0; i < tables.length; i++) {
    tables[i].style.borderCollapse = 'collapse';
    tables[i].style.fontSize = '12px';
    tables[i].style.fontFamily = 'sans-serif';
    tables[i].style.color = '#000000';
    tables[i].style.margin = '10px';
    const ths = tables[i].getElementsByTagName('th');
    const tds = tables[i].getElementsByTagName('td');
    for (let j = 0; j < ths.length; j++) {
      ths[j].style.border = '1px solid #d1d5db';
      ths[j].style.padding = '6px 12px';
      ths[j].style.backgroundColor = '#f1f5f9';
      ths[j].style.textAlign = 'left';
    }
    for (let j = 0; j < tds.length; j++) {
      tds[j].style.border = '1px solid #e5e7eb';
      tds[j].style.padding = '6px 12px';
      if (!tds[j].style.textAlign) tds[j].style.textAlign = 'left';
    }
  }

  document.body.appendChild(div);

  try {
    const { default: html2canvas } = await import('html2canvas-pro');
    const canvas = await html2canvas(div, {
      backgroundColor: '#ffffff',
      scale: 2,
      useCORS: true,
      logging: false,
    });

    const dataUrl = canvas.toDataURL('image/png');
    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const binaryString = window.atob(base64Data);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }

    // The scale:2 factor doubles both axes; divide to get on-page size.
    return {
      buffer: bytes.buffer,
      width: canvas.width / 2,
      height: canvas.height / 2,
    };
  } catch (err) {
    console.error('html2canvas error', err);
    return null;
  } finally {
    if (document.body.contains(div)) document.body.removeChild(div);
  }
}
