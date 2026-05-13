import katex from 'katex';
import html2canvas from 'html2canvas-pro';

export async function getMathPng(latex: string, display: boolean): Promise<string> {
  // Create an off-screen element
  const container = document.createElement('div');
  Object.assign(container.style, {
    position: 'fixed',
    top: '0px',
    left: '-9999px',
    zIndex: '-9999',
    backgroundColor: 'white',
    color: 'black', // Memaksa text menjadi hitam agar tidak invisible di Dark Mode
    padding: '2px', // FIX: Mengurangi padding dari 10px menjadi 2px agar tidak kegedean/banyak putih
    display: 'inline-block',
    pointerEvents: 'none'
  });
  
  try {
    katex.render(latex, container, {
        displayMode: display,
        throwOnError: false,
        output: 'html' // Ensure it's DOM-based so html2canvas can capture it
    });
    
    document.body.appendChild(container);
    
    const canvas = await html2canvas(container, {
        backgroundColor: '#ffffff',
        scale: 2, // for higher resolution
        logging: false
    });
    
    document.body.removeChild(container);
    return canvas.toDataURL('image/png');
  } catch (err) {
    if (document.body.contains(container)) {
        document.body.removeChild(container);
    }
    console.error('KaTeX to Image failed:', err);
    throw err;
  }
}