/**
 * Long-form prompt templates for the Copilot agent. Moved out of the
 * hook so the hook itself stays focused on state management and so a
 * future refinement (A/B testing prompts, swapping languages, adding a
 * dev-mode "show raw prompt" affordance) is a one-file change.
 *
 * The text is untouched from the pre-refactor hook to preserve Gemini's
 * response quality — these strings are effectively part of the system
 * contract.
 */

export interface GenerationPromptCtx {
  isKuliah: boolean;
  totalImages: number;
  judulLaporan: string;
  mataPraktikum: string;
  preTest: string;
  modulContext: string;
  postTest: string;
  notebookPromptData: string;
}

export function buildGenerationPrompt(ctx: GenerationPromptCtx): string {
  const kuliahLead = ctx.isKuliah
    ? 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field `pendahuluan` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.'
    : 'Ini adalah format LAPORAN PRAKTIKUM.';

  return `
        Anda adalah Agen AI Otonom layaknya ahli/analis data manusia yang menyusun laporan formal.
        ${kuliahLead}
        
        CRITICAL INSTRUCTIONS & COGNITIVE REARRANGEMENT:
        1. Anda akan menerima puluhan gambar yang mungkin diupload TIDAK BERURUTAN (misal: soal Post-Test ada di akhir, atau Gambar Visualisasi 3 diupload sebelum Visualisasi 1).
        2. TUGAS ANDA:
           - Deteksi konteks tiap gambar secara visual (baca teks di dalam gambar seperti "Studi Kasus", "Visualisasi 1", "Langkah 2").
           - Pisahkan mana yang merupakan SOAL TEKS, mana yang merupakan HASIL IMPLEMENTASI (Screenshot Program/Grafik).
           - Jika gambar adalah Soal (misal teks Notepad/Soal PDF): Ekstrak teks pertanyaannya secara lengkap ke dalam field \`questions\` (baik di \`pre_test\` maupun \`post_test\` sesuai kategorinya). JANGAN masukkan gambar soal ke \`cellAnalyses\`.
           - Jika gambar adalah Hasil Implementasi/Jawaban: Masukkan ke dalam \`cellAnalyses\`, pastikan Anda memberikan deskripsi detail/analisis tajam di \`explanation\`.
        3. RELATIVE IMAGE INDEXING (PENTING!):
           Setiap gambar yang dilampirkan akan diberi label seperti "[Relative Index: 0]", "[Relative Index: 1]", dst sesuai kategori uploadnya. 
           Anda WAJIB mengisi field \`imageIndex\` pada \`cellAnalyses\` menggunakan angka dari "[Relative Index: X]" tersebut secara tepat agar dokumen tidak salah meletakkan gambar!
        4. CHRONOLOGICAL SORTING: Susun array \`cellAnalyses\` secara KRONOLOGIS dari awal hingga akhir (misal: Visualisasi 1 harus di array atas, Visualisasi 2 di bawahnya, dsb), meskipun urutan upload dari user berantakan!
        5. "Langkah Kerja" (stepByStepNarrative) wajib menggunakan format Markdown yang rapi.
        6. Tone: Gunakan KALIMAT PASIF formal secara dominan ("Dataset dibaca menggunakan...", bukan "Saya membaca...").
        7. DILARANG KERAS menggunakan teks template/generic seperti "Implementasi Kode" atau "Tabel/Output DataFrame". Berikan penamaan caption (caption & tableCaption) yang SANGAT SPESIFIK dan DINAMIS untuk setiap baris kode/gambar (misal: "Proses Cleansing Data Missing Values", "Tabel Distribusi Kategori Produk"). Setiap sel kode HARUS memiliki \`caption\`! DILARANG MENGOSONGKANNYA!

        MULTI-TURN BATCH PROCESSING (CRITICAL):
        TOTAL GAMBAR/VISUAL YANG DIKIRIMKAN ADALAH: ${ctx.totalImages} gambar.
        Untuk menghindari token output terpotong, jalankan metode Agentic Loop:
        - Panggil \`generate_report\` untuk menyimpan sebagian data (misal 4-8 gambar pertama).
        - Sistem akan membalas pesan "success".
        - Panggil lagi \`generate_report\` HANYA untuk melanjutkan sisa gambar/data yang BELUM terekstrak di panggilan sebelumnya.
        - Sistem otomatis melakukan *append* (penggabungan) pada array \`cellAnalyses\`. JANGAN mengirim ulang data gambar yang sudah dianalisis di batch sebelumnya untuk menghindari duplikasi!
        - Jika SEMUA ${ctx.totalImages} gambar sudah terekstrak dengan benar, tuliskan teks biasa ("Laporan selesai") dan STOP memanggil fungsi \`generate_report\`.

        Context Tambahan:
        Judul Laporan: ${ctx.judulLaporan || '-'}
        Mata Praktikum / Kuliah: ${ctx.mataPraktikum || '-'}
        Pre-Test Questions: ${ctx.preTest}
        Modul Context/Goals: ${ctx.modulContext}
        Post-Test Questions: ${ctx.postTest}

        Notebook Data (JSON Extracted Cells):
        ${ctx.notebookPromptData}
      `;
}

export function buildEditPrompt(ctx: {
  judulLaporan: string;
  currentDataJson: string;
  userMessage: string;
}): string {
  return `You are an AI Markdown Editor. 
The user is requesting you to edit the structured lab report data.
Judul Laporan / Topik Kajian: ${ctx.judulLaporan || '-'}

Current Data:
${ctx.currentDataJson}

User Request: "${ctx.userMessage}"

You MUST output the new, updated structured data using the \`generate_report\` tool that satisfies the user's request. Modify ONLY what they asked. Keep the rest of the layout and properties intact.`;
}

export const GENERATION_SYSTEM_INSTRUCTION =
  'You act as an autonomous AI analyst. Read images, sort them chronologically, extract text from questions, and map visualizations correctly using relative indexes in multi-turn batches.';

export const EDIT_SYSTEM_INSTRUCTION =
  'You act as an editor that modifies data based on user input.';

export function buildBatchContinuationMessage(loop: number, totalImages: number): string {
  return `Tugas batch ${loop} berhasil diproses. Sistem telah menggabungkan array \`cellAnalyses\` dan \`questions\`. Lanjutkan analisis ke sisa gambar yang belum diekstrak. Jangan mengulang data yang sama. Jika semua ${totalImages} gambar sudah diproses, balas dengan teks penutup dan berhenti memanggil fungsi.`;
}
