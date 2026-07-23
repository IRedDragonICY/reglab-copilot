const fs = require('fs');
let code = fs.readFileSync('src/components/settings-panel.tsx', 'utf8');

const targetStr = `<div className="space-y-2">
          <Label className="text-[#a0a0a0]">File Kode / Notebook Pembahasan</Label>
          <div {...getRootProps()} className={\`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors text-xs mb-2 \${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-[#555] hover:border-[#777] bg-[#242424]'}\`}>
            <input {...getInputProps()} />
            <p className="text-gray-400 text-[10px]">Klik atau tarik file kode / notebook di sini (Bisa lebih dari satu)</p>
          </div>
          {notebookFiles.length > 0 && (
            <div className="space-y-1 mt-2">
              {notebookFiles.map((file, idx) => (
                <div key={idx} className="flex items-center justify-between bg-[#242424] p-2 rounded border border-[#333] text-[10px]">
                  <span className="text-green-400 truncate flex-1 mr-2">{file.name}</span>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={(e) => {
                    e.stopPropagation();
                    const newFiles = [...notebookFiles];
                    newFiles.splice(idx, 1);
                    setNotebookFiles(newFiles);
                    const newParsed = [...parsedNotebooks];
                    newParsed.splice(idx, 1);
                    setParsedNotebooks(newParsed);
                    setGeneratedDocxBlob(null);
                  }}>
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          <ImageUploader images={implImages} onChange={setImplImages} label="Unggah Tangkapan Layar" />
        </div>`;

const replaceStr = `{metadata.reportType !== 'resume' && (
          <div className="space-y-2">
            <Label className="text-[#a0a0a0]">File Kode / Notebook Pembahasan</Label>
            <div {...getRootProps()} className={\`border border-dashed rounded-md p-4 text-center cursor-pointer transition-colors text-xs mb-2 \${isDragActive ? 'border-blue-500 bg-blue-500/10' : 'border-[#555] hover:border-[#777] bg-[#242424]'}\`}>
              <input {...getInputProps()} />
              <p className="text-gray-400 text-[10px]">Klik atau tarik file kode / notebook di sini (Bisa lebih dari satu)</p>
            </div>
            {notebookFiles.length > 0 && (
              <div className="space-y-1 mt-2">
                {notebookFiles.map((file, idx) => (
                  <div key={idx} className="flex items-center justify-between bg-[#242424] p-2 rounded border border-[#333] text-[10px]">
                    <span className="text-green-400 truncate flex-1 mr-2">{file.name}</span>
                    <Button variant="ghost" size="sm" className="h-6 w-6 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10" onClick={(e) => {
                      e.stopPropagation();
                      const newFiles = [...notebookFiles];
                      newFiles.splice(idx, 1);
                      setNotebookFiles(newFiles);
                      const newParsed = [...parsedNotebooks];
                      newParsed.splice(idx, 1);
                      setParsedNotebooks(newParsed);
                      setGeneratedDocxBlob(null);
                    }}>
                      <X className="w-3 h-3" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        <div className="space-y-2">
          <ImageUploader images={implImages} onChange={setImplImages} label={metadata.reportType === 'resume' ? "Unggah Foto/Poster/Kegiatan (Klik, Tarik, atau Ctrl+V)" : "Unggah Tangkapan Layar"} />
        </div>`;

code = code.replace(targetStr, replaceStr);

fs.writeFileSync('src/components/settings-panel.tsx', code);
console.log("Replaced settings UI successfully.");
