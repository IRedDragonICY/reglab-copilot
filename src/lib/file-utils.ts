export const convertFileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

export const base64ToFile = (dataurl: string, filename: string): File => {
  if (!dataurl || typeof dataurl !== 'string') {
    return new File([], filename || 'unknown');
  }
  
  if (!dataurl.includes(',')) {
    try {
      const bstr = atob(dataurl);
      let n = bstr.length;
      const u8arr = new Uint8Array(n);
      while(n--){
          u8arr[n] = bstr.charCodeAt(n);
      }
      return new File([u8arr], filename);
    } catch (e) {
      return new File([], filename);
    }
  }

  const arr = dataurl.split(',');
  const match = arr[0].match(/:(.*?);/);
  const mime = match ? match[1] : 'application/octet-stream';
  const bstr = atob(arr[arr.length - 1]); 
  let n = bstr.length;
  const u8arr = new Uint8Array(n);
  while(n--){
      u8arr[n] = bstr.charCodeAt(n);
  }
  return new File([u8arr], filename, {type:mime});
};
