import { GoogleGenAI, Type } from '@google/genai';

export async function extractScheduleFromText(inputText: string, apiKey: string) {
  const ai = new GoogleGenAI({ apiKey });
  const prompt = `Parse the following practicum schedule text into a structured JSON list of objects.
  The text usually contains columns like No, Mata Praktikum, Laboratorium, Dosen, Hari, Jam.
  
  Input text:
  ${inputText}`;

  const response = await ai.models.generateContent({
    model: 'gemini-flash-latest', // DO NOT CHANGE: ini gemini 3.0 flash!
    contents: [{ role: 'user', parts: [{ text: prompt }] }],
    config: {
      responseMimeType: 'application/json',
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          schedules: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                mataPraktikum: { type: Type.STRING },
                laboratorium: { type: Type.STRING },
                dosen: { type: Type.STRING },
                hari: { type: Type.STRING },
                jamMulai: { type: Type.STRING },
                jamSelesai: { type: Type.STRING }
              },
            }
          }
        }
      }
    }
  });

  return JSON.parse(response.text || '{}');
}

export async function extractModuleFromPdf(base64Data: string, apiKey: string, onLog?: (msg: string) => void) {
  const ai = new GoogleGenAI({ apiKey });
  const partsPattern = base64Data.split(',');
  const actualBase64 = partsPattern.length > 1 ? partsPattern[1] : partsPattern[0];

  onLog?.("[INIT] Menyiapkan dokumen PDF untuk dianalisis...");

  // Skema JSON loss-less (mencegah model melakukan peringkasan) & Pemisahan Teori Pendukung
  const structuredSchema = {
    type: Type.OBJECT,
    properties: {
      pertemuan_data: {
        type: Type.ARRAY,
        description: "Daftar pertemuan praktikum yang diekstrak secara menyeluruh",
        items: {
          type: Type.OBJECT,
          properties: {
            pertemuan: { type: Type.NUMBER, description: "Angka pertemuan (1, 2, 3...)" },
            judul: { type: Type.STRING, description: "Judul materi pertemuan" },
            teori_pendukung: { 
              type: Type.STRING, 
              description: "Salin seluruh teks pada bagian TEORI PENDUKUNG atau DASAR TEORI. DILARANG memasukkan bagian ini ke dalam langkah_praktikum!" 
            },
            pre_test: { type: Type.STRING, description: "Soal pre-test atau pertanyaan pra-praktikum" },
            langkah: { 
              type: Type.STRING, 
              description: "HANYA BERISI LANGKAH KERJA / INSTRUKSI. SALIN 100% SEMUA TEKS DAN KODE PROGRAM TANPA KECUALI. JANGAN DIRINGKAS! Setiap melihat baris kode program (Python, Pandas, Sklearn, dll), WAJIB BUNGKUS DENGAN MARKDOWN CODE BLOCKS (```python \n <kode> \n ```) agar struktur kodenya terjaga rapi dan tidak menjadi 1 baris. PASTIKAN Teori Pendukung TIDAK MASUK KE SINI!" 
            },
            post_test: { type: Type.STRING, description: "Soal post-test atau tugas akhir praktikum" }
          },
          required: ["pertemuan", "judul", "langkah"]
        }
      }
    },
    required: ["pertemuan_data"]
  };

  onLog?.("[INIT] Memulai koneksi stream dengan Gemini 3.0 Flash...");

  const stream = await ai.models.generateContentStream({
    model: 'gemini-flash-latest', // DO NOT CHANGE: ini gemini 3.0 flash!
    contents: [
      {
        role: 'user',
        parts: [
          { inlineData: { mimeType: 'application/pdf', data: actualBase64 } },
          { text: "Ekstrak struktur modul praktikum ini. PENTING: Anda adalah mesin Lossless Data Extractor. Tugas Anda MENYALIN SEMUA instruksi dan source code secara persis. Pisahkan secara tegas antara TEORI PENDUKUNG dengan LANGKAH PRAKTIKUM. Semua kode program HARUS berada di dalam Markdown Code Blocks yang sesuai." }
        ]
      }
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: structuredSchema,
      temperature: 0.1, // Suhu rendah agar stabil dan patuh pada schema (tidak halusinasi)
      systemInstruction: "You are an extreme lossless text and code extraction engine. Separate theoretical background from practical steps. You MUST copy every single word and line of code from the practical steps into the JSON array without summarizing. EVERY SINGLE LINE OF CODE MUST BE PRESERVED and properly wrapped in Markdown Code Blocks."
    }
  });

  let fullJsonText = "";
  let currentPertemuanCount = 0;

  for await (const chunk of stream) {
    if (chunk.text) {
      fullJsonText += chunk.text;
      
      // Hanya tampilkan log ketika AI mendeteksi iterasi pertemuan baru
      const matches = fullJsonText.match(/"pertemuan"\s*:\s*(\d+)/gi);
      if (matches && matches.length > currentPertemuanCount) {
         currentPertemuanCount = matches.length;
         onLog?.(`[EKSTRAKSI] Memproses Pertemuan ${currentPertemuanCount}...`);
      }
    }
  }

  onLog?.("[FINISH] Selesai mengunduh data. Memvalidasi struktur JSON...");

  try {
    // Regex kuat untuk mencari bentuk JSON secara penuh
    // Ini mengabaikan teks tambahan/markdown (```json) yang mungkin menyelinap
    const jsonMatch = fullJsonText.match(/\{[\s\S]*\}/);
    const cleanedJsonText = jsonMatch ? jsonMatch[0] : fullJsonText;
    
    const parsedData = JSON.parse(cleanedJsonText);
    return { name: 'parse_module_praktikum', args: parsedData };
  } catch (error) {
    console.error("Gagal melakukan parse struktur JSON:", error, fullJsonText);
    return null;
  }
}