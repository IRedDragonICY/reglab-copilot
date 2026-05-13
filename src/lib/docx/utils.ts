export const CM_TO_TWIP = 567; // 1 cm = 567 twips

export function sanitizeText(text: string): string {
  if (!text) return '';
  // Remove ANSI escape codes
  let clean = text.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  // Remove invalid XML characters
  clean = clean.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return clean;
}

export async function convertHtmlToImageBuffer(htmlContent: string): Promise<{ buffer: ArrayBuffer, width: number, height: number } | null> {
  if (typeof document === 'undefined') return null; // Ensure we are in browser
  
  return new Promise((resolve) => {
    const div = document.createElement('div');
    // Sanitize any extraneous `<style scoped>` script wrappers, but we don't have to worry about oklch anymore!
    let cleanHtmlContent = htmlContent.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
    
    div.innerHTML = cleanHtmlContent;
    div.style.position = 'absolute';
    div.style.top = '-9999px';
    div.style.left = '-9999px';
    div.style.background = 'white';
    
    // We let the div be as wide as it needs to be to fit the pandas table horizontally
    div.style.display = 'inline-block';

    // Apply strict basic inline styles for the pandas tables
    const tables = div.getElementsByTagName('table');
    for (let i = 0; i < tables.length; i++) {
       tables[i].style.borderCollapse = 'collapse';
       tables[i].style.fontSize = '12px';
       tables[i].style.fontFamily = 'sans-serif';
       tables[i].style.color = '#000000'; // explicitly simple color
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
           // if text aligns right (like numbers in pandas)
           if (!tds[j].style.textAlign) {
               tds[j].style.textAlign = 'left';
           }
       }
    }

    document.body.appendChild(div);

    // Call html2canvas-pro ignoring elements it shouldn't try to render
    import('html2canvas-pro').then(({ default: html2canvas }) => {
      html2canvas(div, { 
        backgroundColor: '#ffffff', 
        scale: 2,
        useCORS: true,
        logging: false
      }).then(canvas => {
         document.body.removeChild(div);
         const dataUrl = canvas.toDataURL('image/png');
         const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, "");
         const binaryString = window.atob(base64Data);
         const bytes = new Uint8Array(binaryString.length);
         for (let i = 0; i < binaryString.length; i++) {
             bytes[i] = binaryString.charCodeAt(i);
         }
         resolve({ buffer: bytes.buffer, width: canvas.width / 2, height: canvas.height / 2 });
      }).catch(err => {
         console.error("html2canvas error", err);
         if (document.body.contains(div)) document.body.removeChild(div);
         resolve(null);
      });
    });
  });
}