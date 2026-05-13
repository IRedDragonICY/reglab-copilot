import React, { useCallback, useEffect, useState, useRef } from 'react';
import { useDropzone } from 'react-dropzone';
import { UserImage } from '@/lib/docxBuilder';
import { Button } from '@/components/ui/button';
import { X, FileText, Loader2 } from 'lucide-react';
import { renderPageAsImage, getDocumentProxy } from 'unpdf';

interface ImageUploaderProps {
  images: UserImage[];
  onChange: (images: UserImage[]) => void;
  label: string;
}

export function ImageUploader({ images, onChange, label }: ImageUploaderProps) {
  const processingRef = useRef<Set<string>>(new Set());

  const convertPdfToImages = useCallback(async (dataUrl: string): Promise<string[]> => {
    try {
      const base64Data = dataUrl.split(',')[1];
      if (!base64Data) return [dataUrl];
      
      const binaryString = window.atob(base64Data);
      const len = binaryString.length;
      const bytes = new Uint8Array(len);
      for (let i = 0; i < len; i++) {
        bytes[i] = binaryString.charCodeAt(i);
      }

      const pdf = await getDocumentProxy(bytes);
      const results: string[] = [];
      
      for (let i = 1; i <= pdf.numPages; i++) {
        const thumb = await renderPageAsImage(pdf, i, {
          scale: 2.0,
          toDataURL: true,
        });
        results.push(thumb);
      }
      
      return results;
    } catch (error) {
      console.error('Error converting PDF to images with unpdf:', error);
    }
    return [dataUrl];
  }, []);

  const generateThumbnails = useCallback(async (file: File): Promise<string[]> => {
    if (file.type === 'application/pdf') {
       try {
         const arrayBuffer = await file.arrayBuffer();
         const uint8Array = new Uint8Array(arrayBuffer);
         const pdf = await getDocumentProxy(uint8Array);
         const results: string[] = [];
         
         for (let i = 1; i <= pdf.numPages; i++) {
           const thumb = await renderPageAsImage(pdf, i, {
              scale: 2.0,
              toDataURL: true,
           });
           results.push(thumb);
         }
         
         return results;
       } catch (error) {
         console.error('Error generating PDF thumbnails from file with unpdf:', error);
       }
    }
    
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve([e.target?.result as string]);
      reader.readAsDataURL(file);
    });
  }, []);

  // Convert legacy PDF dataUrls to images (expand multi-page)
  useEffect(() => {
    const legacyPdfs = images.filter(img => 
      img.dataUrl?.startsWith('data:application/pdf') && 
      !processingRef.current.has(img.id)
    );

    if (legacyPdfs.length > 0) {
      const processLegacy = async () => {
        let newImages = [...images];
        let changed = false;
        
        for (const img of legacyPdfs) {
          processingRef.current.add(img.id);
          const thumbs = await convertPdfToImages(img.dataUrl);
          
          const idx = newImages.findIndex(i => i.id === img.id);
          if (idx !== -1 && thumbs.length > 0) {
            // Replace the PDF entry with multiple images
            const expandedImages = thumbs.map(thumb => ({
              id: Math.random().toString(36).substring(7),
              dataUrl: thumb
            }));
            
            newImages.splice(idx, 1, ...expandedImages);
            changed = true;
          }
          processingRef.current.delete(img.id);
        }
        
        if (changed) {
          onChange(newImages);
        }
      };
      processLegacy();
    }
  }, [images, onChange, convertPdfToImages]);

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    const nestedResults = await Promise.all(acceptedFiles.map(file => generateThumbnails(file)));
    const flatResults = nestedResults.flat().map(dataUrl => ({
      id: Math.random().toString(36).substring(7),
      dataUrl
    }));
    
    onChange([...images, ...flatResults]);
  }, [images, onChange, generateThumbnails]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'image/*': ['.png', '.jpg', '.jpeg'],
      'application/pdf': ['.pdf']
    },
    multiple: true
  });

  const removeImage = (id: string) => {
    onChange(images.filter(img => img.id !== id));
  };

  const handlePaste = useCallback(async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    const pendingFiles: File[] = [];

    for (let i = 0; i < items.length; i++) {
        const type = items[i].type;
        if (type.indexOf('image') !== -1 || type.indexOf('pdf') !== -1) {
            const file = items[i].getAsFile();
            if (file) pendingFiles.push(file);
        }
    }

    if (pendingFiles.length > 0) {
        const nestedResults = await Promise.all(pendingFiles.map(file => generateThumbnails(file)));
        const flatResults = nestedResults.flat().map(dataUrl => ({
          id: Math.random().toString(36).substring(7),
          dataUrl
        }));
        onChange([...images, ...flatResults]);
    }
  }, [images, onChange, generateThumbnails]);

  return (
    <div className="mt-2 mb-4">
      <div 
        {...getRootProps()} 
        onPaste={handlePaste}
        className={`border-2 border-dashed p-4 text-center cursor-pointer text-sm rounded-lg transition-all ${isDragActive ? 'border-blue-500 bg-blue-500/5' : 'border-gray-500/30 hover:border-blue-500/50 hover:bg-white/5'}`}
        tabIndex={0} 
      >
        <input {...getInputProps()} />
        <p className="text-gray-400 flex items-center justify-center gap-2">
          <FileText className="w-4 h-4 text-blue-400" />
          {label} (Klik, Tarik, atau Ctrl+V untuk tempel Gambar/PDF)
        </p>
      </div>
      
      {images.length > 0 && (
        <div className="flex flex-wrap gap-3 mt-3">
          {images.map((img) => (
            <div key={img.id} className="relative group border border-gray-500/20 rounded-md p-1 bg-[#1a1a1a] overflow-hidden">
              <div className="h-20 w-auto min-w-20 bg-black/20 flex items-center justify-center rounded overflow-hidden">
                {img.dataUrl?.startsWith('data:application/pdf') ? (
                  <div className="flex flex-col items-center gap-1">
                    <Loader2 className="w-5 h-5 text-blue-500 animate-spin" />
                    <span className="text-[10px] text-gray-400">Memproses...</span>
                  </div>
                ) : (
                  <img src={img.dataUrl} alt="uploaded" className="h-20 w-auto object-contain transition-transform group-hover:scale-105" />
                )}
              </div>
              <button 
                onClick={() => removeImage(img.id)}
                className="absolute top-1 right-1 bg-red-500 shadow-lg text-white rounded-full p-1 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-600 active:scale-95"
              >
                <X size={12} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
