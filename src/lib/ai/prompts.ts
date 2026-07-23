/**
 * Long-form prompt templates for the Copilot agent. Moved out of the
 * hook so the hook itself stays focused on state management and so a
 * future refinement (A/B testing prompts, swapping languages, adding a
 * dev-mode "show raw prompt" affordance) is a one-file change.
 *
 * The text is treated as part of Gemini's contract — even minor wording
 * changes shift output quality. Snapshot tests in `prompts.test.ts` lock
 * in the rules that matter (zero-orphan images, anti-slop ban-list,
 * passive-voice tone) so accidental edits surface in review.
 */

export interface GenerationPromptCtx {
  isKuliah: boolean;
  isResume?: boolean;
  totalImages: number;
  totalCells: number;
  judulLaporan: string;
  mataPraktikum: string;
  preTest: string;
  modulContext: string;
  postTest: string;
  ulasanPraktikum?: string;
  notebookPromptData: string;
}

export function buildGenerationPrompt(ctx: GenerationPromptCtx): string {
  const isEventResume = ctx.isResume;

  const kuliahLead = ctx.isKuliah
    ? 'PENTING: Ini adalah format LAPORAN KULIAH. Anda WAJIB membuat narasi BAB I PENDAHULUAN secara naratif dan komprehensif ke dalam field `pendahuluan` berdasarkan Modul Context/Goals yang diberikan. Jika tidak ada konteks, buat abstraksi berdasarkan topik laporan.'
    : ctx.isResume
    ? 'PENTING: Ini adalah format LAPORAN RESUME. DOKUMEN INI TIDAK MENGGUNAKAN FORMAT BAB (TIDAK ADA BAB I, BAB II, BAB III). Anda WAJIB membuat pengantar/abstrak di field `pendahuluan`. KHUSUS UNTUK RESUME: Lakukan ekstraksi SEMUA TEKS dan INFORMASI dari gambar poster/modul secara SANGAT MENDETAIL dan LENGKAP. DILARANG MENULIS DALAM PARAGRAF UTUH! Anda WAJIB MENGGUNAKAN MARKDOWN HEADING (### Nama Subbab) DAN BULLET POINTS (-) untuk memecah penjelasan menjadi subbab-subbab spesifik sesuai informasi di poster (Contoh Subbab: ### Latar Belakang, ### Tujuan, ### Fitur Produk, ### Cara Kerja, ### Keunggulan Sistem, ### Spesifikasi Hardware/Software, ### Kesimpulan). Potong-potong per subbab agar struktur resume sangat jelas dan komprehensif!'
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
           - KHUSUS LAPORAN KULIAH (BUKAN PRAKTIKUM): Jika gambar adalah Grafik Evaluasi / Visualisasi / Hasil Analisis Akhir (seperti *Confusion Matrix*, *Word Cloud*, dsb), gambar tersebut WAJIB dimasukkan ke dalam array \`analisis_hasil\` (Bab III Kesimpulan) melalui relasi \`imageIndex\`, dan JANGAN BIKIN entri di \`cellAnalyses\` untuk gambar tersebut.
           - KHUSUS LAPORAN PRAKTIKUM: Anda tetap BOLEH memasukkan Grafik Evaluasi di \`analisis_hasil\` atau \`cellAnalyses\`, namun DILARANG menulis narasi kesimpulan tentang grafik tanpa menyertakan \`imageIndex\` grafiknya jika gambar tersebut memang ada.
        3. RELATIVE IMAGE INDEXING (PENTING!):
           Setiap gambar yang dilampirkan akan diberi label seperti "[Relative Index: 0]", "[Relative Index: 1]", dst sesuai kategori uploadnya. 
           Anda WAJIB mengisi field \`imageIndex\` pada \`cellAnalyses\` menggunakan angka dari "[Relative Index: X]" tersebut secara tepat agar dokumen tidak salah meletakkan gambar!
        4. CHRONOLOGICAL SORTING: Gambar yang dikirimkan ke Anda biasanya sudah disusun berurutan secara logis dari Langkah 1 hingga akhir. Pertahankan urutan asli tersebut sebisa mungkin di array \`cellAnalyses\`, KECUALI jika Anda menemukan anomali urutan yang sangat jelas salah (misal Visualisasi 3 dikirim sebelum Visualisasi 1).
        5. "Langkah Kerja" (stepByStepNarrative) wajib menggunakan format Markdown yang rapi.
        6. Tone: Gunakan KALIMAT PASIF formal secara dominan ("Dataset dibaca menggunakan...", bukan "Saya membaca...").
        7. DILARANG KERAS menggunakan teks template/generic seperti "Implementasi Kode" atau "Tabel/Output DataFrame". Berikan penamaan caption (caption & tableCaption) yang SANGAT SPESIFIK dan DINAMIS untuk setiap baris kode/gambar (misal: "Proses Cleansing Data Missing Values", "Tabel Distribusi Kategori Produk"). Setiap sel kode HARUS memiliki \`caption\`! DILARANG MENGOSONGKANNYA!

        ZERO-ORPHAN POLICY (PALING KRITIS — JANGAN DILANGGAR):
        - Setiap gambar bertipe HASIL IMPLEMENTASI/JAWABAN (kategori \`implementasi\` atau \`post_test\`) WAJIB direlasikan melalui \`imageIndex\`, entah itu ke dalam \`cellAnalyses\` ATAUPUN \`analisis_hasil\` (khusus grafik evaluasi).
        - DILARANG mengirimkan gambar ke output tanpa merelasikannya. Gambar tanpa relasi logis akan berstatus yatim piatu yang merupakan kegagalan mutlak tugas Anda.
        - PENTING UNTUK POST-TEST: Meskipun Anda sudah menjawab esai/soal post_test di object \`answers\`, Anda TETAP WAJIB membuat entri di \`cellAnalyses\` (baik di objek \`praktikum\` maupun \`post_test\`) dengan \`section: 'post_test'\` khusus untuk menjelaskan baris kode / perubahan teknis apa yang Anda modifikasi pada screenshot tersebut. Sadarilah konteks praktikum sebelumnya! Jelaskan secara natural bagian kode mana yang "diubah" dari langkah praktikum untuk menyelesaikan soal post-test ini (misal: "Untuk menyelesaikan tugas ini, parameter \\\`numDisparities\\\` yang sebelumnya bernilai 16 pada langkah praktikum diubah menjadi 80..."). Jangan hanya menjawab di \`answers\` lalu meninggalkan gambar post-test tanpa penjelasan komparatif di \`cellAnalyses\`.
        - Sebelum memanggil \`add_cell_analysis\` di batch terakhir, lakukan self-check: pastikan SETIAP gambar implementasi dan post_test yang dikirim user sudah direlasikan secara utuh. Jika jumlah entri \`cellAnalyses\` masih kurang dari total gambar, Anda WAJIB melanjutkannya.
        - Untuk gambar Post-Test: \`section\` HARUS \`'post_test'\`. Untuk gambar Implementasi: \`section\` HARUS \`'implementasi'\`. Jangan tertukar.

        PENJELASAN BLOK KODE NOTEBOOK / FILE KODE (WAJIB JIKA ADA .IPYNB ATAU FILE KODE):
        Jika mendapat input "Notebook Data" (.ipynb) ATAU file kode lainnya (seperti .py, .js, .php), Anda WAJIB membuat entri \`cellAnalyses\` untuk SETIAP sel kode (cell_type: "code") di dalam data tersebut. Isi \`notebookIndex\` dan \`cellIndex\` sesuai urutan. Berikan \`explanation\` yang mendalam untuk setiap blok kode. Jika sel kode tersebut tidak memiliki screenshot pendamping, abaikan \`imageIndex\` (jangan diisi), namun \`explanation\` HARUS tetap ada!

        OBSERVASI VISUAL WAJIB (UNTUK SETIAP SCREENSHOT):
        Jika laporan menyertakan SCREENSHOT, Anda WAJIB membaca isi gambar secara teliti dan menyebut detail spesifik pada \`explanation\`:
        - File / tab editor yang aktif (contoh: "app.js", "prak.html", "styles.css"), beserta nomor baris yang ter-highlight bila terlihat.
        - Identifier kode yang relevan (nama fungsi, variabel, selector D3, properti CSS, atribut SVG) yang muncul di screenshot.
        - Output / tampilan UI yang dihasilkan (warna bar, label sumbu, urutan kategori, opsi dropdown yang sedang dipilih, taskbar/jam pada bottom-right, dsb).
        - Apa yang BERUBAH dari step sebelumnya.
        - KHUSUS GRAFIK / VISUALISASI DATA (misal Clustering, Regression, dll): Anda WAJIB menganalisis MENGAPA grafik tersebut terlihat seperti itu. Jelaskan pola distribusi data, area keputusan (decision boundary), indikasi overfitting/underfitting, anomali (misal: "kenapa segmentasinya terlihat acak/amburadul? Apakah nilai K terlalu kecil?"), dan dampak parameter model terhadap hasil visualisasi tersebut layaknya analisis mahasiswa yang kritis.
        - Untuk Post-Test, kaitkan setiap screenshot ke nomor soal Post-Test tertentu dan jelaskan bagian mana dari soal yang dijawab oleh screenshot tersebut.
        - WAJIB MENGANALISIS DIAGRAM / FLOWCHART / DRAWIO: Jika gambar berisi flowchart, drawio, bagan, atau skema manual, Anda TETAP WAJIB membaca dan menjabarkan alurnya ke teks penjelasan. JANGAN menolak membaca diagram!
        - JAWAB SEMUA SOAL: Anda WAJIB memikirkan dan menuliskan jawaban yang tepat untuk semua soal Pre-Test dan Post-Test di object \`answers\`. JANGAN dibiarkan kosong atau hanya mengulang soalnya saja.
- ANTI-STACKING GAMBAR (DILARANG MENUMPUK GAMBAR): JANGAN PERNAH menumpuk 2 gambar atau lebih secara berurutan tanpa teks penjelasan di antaranya! SETIAP 1 screenshot WAJIB diikuti oleh paragraf observasi visual yang spesifik sebelum gambar berikutnya muncul.

        ANTI AI-SLOP & LANGUAGE RULES (ATURAN KETAT PENULISAN):
        1. HILANGKAN KALIMAT PEMBUKA GENERIC/META-REFERENSI:
           DILARANG KERAS merujuk pada "gambar", "kode di atas", atau "potongan kode berikut".
           - JANGAN GUNAKAN: "Pada gambar di atas dapat dilihat...", "Berdasarkan output tersebut...", "Gambar ini menunjukkan...", "Potongan kode di atas berfungsi untuk..."
           - GUNAKAN GAYA LANGSUNG (ACTIVE/DIRECT NARRATIVE): Langsung jelaskan subjeknya.
             Contoh Benar: "Fungsi \`generate_ngrams\` digunakan untuk memecah teks menjadi potongan unigram."
             Contoh Benar: "Hasil evaluasi menunjukkan akurasi sebesar 46.74% yang mengindikasikan bahwa model..."
             Tulis layaknya mahasiswa yang sedang menjelaskan hasil kerjanya, fokus pada *apa yang terjadi* dan *mengapa*, bukan *di mana* itu terlihat.

        2. NATURAL TECHNICAL TRANSLATIONS (JANGAN TERJEMAHKAN ISTILAH TEKNIS):
           DILARANG KERAS menerjemahkan istilah baku IT / Data Science / Computer Vision / NLP ke dalam bahasa Indonesia secara harfiah (harfiah = slop).
           - CONTOH DILARANG: "Matriks Kebingungan", "Hutan Acak", "Pembekuan", "Lupa Bencana", "Penyesuaian Halus", "Penurunan Gradien", "Kotak Pembatas".
           - CONTOH WAJIB: "*Confusion Matrix*", "*Random Forest*", "*Freeze*", "*Catastrophic Forgetting*", "*Fine-tuning*", "*Gradient Descent*", "*Bounding Box*".
           Gunakan istilah aslinya (Bahasa Inggris) agar relevan dengan konteks teknis Informatika.

        3. FORMATTING ISTILAH ASING & IDENTIFIER KODE (WAJIB KONSISTEN):
           - ISTILAH ASING: Semua istilah bahasa Inggris/asing WAJIB dicetak miring (italic). Gunakan markdown \`*teks*\` atau \`_teks_\`. (Contoh: *hyperparameter*, *overfitting*, *layer*, *epoch*).
           - IDENTIFIER KODE: Semua nama fungsi, variabel, library, tipe data, file, atau nilai syntax WAJIB diformat sebagai inline code dengan backtick (\`kode\`). (Contoh: \`base_model.trainable = True\`, \`generate_ngrams()\`, \`CountVectorizer\`).
           Perpaduan yang benar: "Fungsi \`re.findall()\` digunakan untuk mengekstrak entitas melalui proses *pattern matching*."

        4. GAYA BAHASA SEMI-FORMAL (TIDAK BIPOLAR):
           Jangan terlalu kaku akademis di satu sisi, tapi JANGAN menggunakan bahasa gaul (slang) tongkrongan di sisi lain.
           - DILARANG pakai kata: "pas", "ngecek", "jelek", "basa-basi", "ngasih gambaran", "ngitung seberapa capek".
           - GUNAKAN: "ketika", "mengukur/memeriksa", "semakin buruk / menurun performanya", "memberikan gambaran", "menghitung perbaikan manual".
           Tone harus Semi-Formal Laporan Praktikum yang natural, bukan gaya AI kaku, dan bukan gaya chat santai.

        5. STRUKTUR PARAGRAF & SUBBAB (SANGAT KRITIS):
           - KHUSUS LAPORAN PRAKTIKUM/KULIAH: DILARANG KERAS MENGGUNAKAN LISTING/BULLETS. Semuanya WAJIB ditulis dalam bentuk PARAGRAF NARATIF (cerita komparatif).
           - KHUSUS LAPORAN RESUME: ANDA SANGAT DIIZINKAN DAN WAJIB MENGGUNAKAN SUBBAB (MARKDOWN HEADING SEPERTI ###) SERTA LISTING/BULLETS (•, -, 1, 2, 3) untuk memecah seluruh informasi dari gambar poster secara detail per poin (misalnya: ### Latar Belakang, ### Tujuan, ### Fitur Produk, ### Cara Kerja, ### Keunggulan Sistem, dsb). DILARANG KERAS MENULISNYA DALAM BENTUK PARAGRAF POLOS TANPA SUBBAB!
           - ANTI-DUPLIKASI KETAT (NO REDUNDANCY): DILARANG KERAS mencetak/menghasilkan paragraf yang persis sama dua kali. Pastikan Langkah Kerja dan Ulasan Praktikum hanya dieksekusi satu kali per dokumen!
           - BLACKLIST KATA PEMBUKA: DILARANG KERAS menggunakan kalimat "Proses pengerjaan praktikum dilakukan melalui tahapan sistematis berikut" atau variasi kalimat pengantar list lainnya. Langsung masuk ke paragraf pertama (Contoh awal: "Pada praktikum kali ini, langkah pertama yang dilakukan adalah...").
           - BLACKLIST KATA MEGAH: DILARANG menggunakan kata-kata: ketangguhan, ketiadaan, mengonfirmasi, meregulasi, komprehensif. Gunakan bahasa Indonesia sehari-hari yang sopan (semi-formal).
           - Variasikan awal kalimat. Jangan selalu "Fungsi X digunakan untuk...". Gunakan variasi pasif santai seperti: "Pada langkah ini, kita melakukan import...", "Selanjutnya, dataset dibagi menjadi...", atau "Model kemudian dijalankan...".

        6. ANALOGI TEKNIS YANG MEMBUMI:
           JANGAN menggunakan analogi metaforis atau terkesan dibuat-buat agar santai. 
           (Contoh dilarang: "TER menghitung seberapa capek manusia", "kata basa-basi").
           Gunakan penjelasan teknis nyata: "TER menghitung seberapa banyak perbaikan manual yang diperlukan terhadap hasil mesin agar sama dengan referensi."

        7. TAMBAHKAN PENGALAMAN TEKNIS PRAKTIKAL:
           Di bagian Analisis Hasil, selipkan opini pengalaman teknis/kendala praktikal yang natural dialami mahasiswa.
           - SUNTIKAN KENDALA SECARA PAKSA PADA ULASAN PRAKTIKUM: Di bagian Ulasan Praktikum, JANGAN menulis 'praktikum berjalan sangat lancar tanpa kendala'. Anda WAJIB mengarang satu kendala wajar mahasiswa (contoh: bingung menyesuaikan dimensi reshape untuk input LSTM, error saat slicing data, proses training epoch yang lama/GPU limit di Colab, atau penyesuaian hyperparameter yang sulit) jika user tidak menyebutkannya. Jika user menyebutkan kendalanya sendiri, gunakan dan kembangkan kendala dari user tersebut.

        MULTI-TURN BATCH PROCESSING (CRITICAL):
        TOTAL GAMBAR/VISUAL: ${ctx.totalImages} gambar.
        TOTAL BLOK/CELL NOTEBOOK: ${ctx.totalCells} cell.
        
        PENTING: Karena batasan token output, JANGAN memproses semua gambar/cell sekaligus jika jumlahnya banyak (khususnya untuk laporan / notebook panjang)! Gunakan metode Agentic Loop:
        - Panggil tool granular seperti \`add_cell_analysis\` secara paralel untuk menyimpan sebagian data saja (misal 5 gambar ATAU 10-15 blok cell pertama).
        - Sistem akan membalas pesan "success".
        - Panggil lagi \`add_cell_analysis\` HANYA untuk melanjutkan sisa gambar / blok cell yang BELUM dianalisis.
        - Sistem otomatis melakukan *append* (penggabungan) pada array \`cellAnalyses\`. JANGAN mengirim ulang data yang sudah dianalisis di batch sebelumnya (hindari duplikasi)!
        - JIKA ANDA SUDAH MENCAPAI AKHIR DARI DATA (semua gambar/cell selesai), PASTIKAN SEMUA atribut seperti \`analisis_hasil\`, \`ulasan_praktikum\`, dan \`post_test\` JUGA IKUT DIGENERATE sebelum Anda berhenti. Atribut-atribut ini bisa Anda isi di panggilan terakhir atau panggilan manapun asalkan tidak terlewat.
        - Jika SEMUA data (gambar & cell) dan ulasan sudah dikirim dengan benar, tuliskan teks biasa ("Laporan selesai") dan STOP memanggil tool (lalu panggil \`mark_task_complete\` di akhir).
        
        Context Tambahan:
        Judul Laporan: ${ctx.judulLaporan || '-'} (PENTING: Jika Judul Laporan ini kosong, '-', atau bertanda kurung siku seperti '[Judul Resume]', Anda WAJIB membuat/meng-generate field 'judul_laporan' yang singkat, padat, profesional, dan sangat spesifik sesuai topik/materi/poster/modul yang diunggah, contoh: 'Sistem Penghitung dan Deteksi Bibit Ikan Berbasis Computer Vision dan YOLO (INOTEKAI)').
        Mata Praktikum / Kuliah: ${ctx.mataPraktikum || '-'}
        Pre-Test Questions: ${ctx.preTest}
        Modul Context/Goals: ${ctx.modulContext}
        Post-Test Questions: ${ctx.postTest}
        Ulasan Praktikum (Raw Input dari User): ${ctx.ulasanPraktikum || '-'}
        PENTING UNTUK ULASAN PRAKTIKUM: Jika Raw Input dari User di atas TIDAK KOSONG ("-"), Anda WAJIB MENGGUNAKAN DAN MENGEMBANGKAN KATA/IDE dari user tersebut secara detail! Namun jika kosong ("-"), Anda WAJIB menerapkan aturan SUNTIKAN KENDALA SECARA PAKSA dengan mengarang satu kendala teknis logis yang biasa dialami mahasiswa saat mempraktikkan materi ini.
        
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

You MUST output the new, updated structured data using the \`add_cell_analysis\` tool that satisfies the user's request. Modify ONLY what they asked. Keep the rest of the layout and properties intact.`;
}

export const GENERATION_SYSTEM_INSTRUCTION =
  'You act as an autonomous AI analyst. Read images, sort them chronologically, extract text from questions, and map visualizations correctly using relative indexes in multi-turn batches. Every implementation / post-test screenshot MUST have a corresponding cellAnalyses entry (even if you answered the post-test question in the `answers` array) with a natural-language Indonesian explanation grounded in concrete details visible in the screenshot. Never use generic boilerplate openers. PENTING: Untuk Laporan Resume, ANDA WAJIB MENGGUNAKAN MARKDOWN HEADING (### Nama Subbab) DAN BULLET POINTS (-) untuk memilah informasi ke dalam subbab-subbab spesifik (seperti Latar Belakang, Tujuan, Fitur Produk, Cara Kerja, Keunggulan, dsb) daripada menulis satu paragraf panjang. Keep technical terms in their original English (e.g., "Confusion Matrix" instead of "Matriks Kebingungan").';

export const EDIT_SYSTEM_INSTRUCTION =
  'You act as an editor that modifies data based on user input.';

export function buildBatchContinuationMessage(loop: number, totalImages: number, totalCells: number): string {
  return `Tugas batch ${loop} berhasil diproses. Sistem telah menggabungkan array \`cellAnalyses\` dan \`questions\`. Lanjutkan analisis ke sisa gambar atau blok cell yang belum diekstrak. Jangan mengulang data yang sama. Pastikan setiap gambar atau cell memiliki entri \`cellAnalyses\` dengan \`imageIndex\` (untuk gambar) terisi dan \`explanation\` yang berisi observasi visual konkret (file aktif, baris kode, identifier, warna/output, perubahan dari step sebelumnya). JIKA INI ADALAH BATCH TERAKHIR (semua gambar dan cell telah dianalisis), JANGAN LUPA untuk meng-generate atribut penting di akhir laporan seperti \`analisis_hasil\` dan \`ulasan_praktikum\`! Jika semua ${totalImages} gambar dan ${totalCells} cell sudah diproses dan ulasan telah diberikan, balas dengan teks penutup dan berhenti memanggil fungsi.`;
}
