import { Type } from '@google/genai';

/**
 * Catalogue of Gemini models shown in the Copilot model-selector dropdown.
 *
 * The array order drives the dropdown order. The `type` field groups items
 * visually ("Featured", "Standard", "Research"). `name` is the user-facing
 * display label and is also the stored preference — do not rename existing
 * entries without a data migration.
 */
export const AVAILABLE_MODELS = [
  { id: 'gemini-3.0-flash', name: 'Gemini 3 Flash Preview', type: 'Featured', info: 'Search & grounding', new: true },
  { id: 'gemini-3.1-pro-preview', name: 'Gemini 3.1 Pro Preview', type: 'Featured', info: 'SOTA reasoning model', new: true },
  { id: 'gemini-3.1-flash-lite-preview', name: 'Gemini 3.1 Flash Lite Preview', type: 'Featured', info: 'Cost-efficient model', new: true },
  { id: 'gemini-3.1-flash-image-preview', name: 'Nano Banana 2', type: 'Featured', info: 'Flash-speed image intelligence', new: true, paid: true },
  { id: 'gemini-3-pro-image-preview', name: 'Nano Banana Pro', type: 'Featured', info: 'State-of-the-art image editing', paid: true },
  { id: 'gemini-pro-latest', name: 'Gemini Pro Latest', type: 'Standard', info: 'Latest Pro alias' },
  { id: 'gemini-flash-latest', name: 'Gemini Flash Latest', type: 'Standard', info: 'Latest Flash alias' },
  { id: 'gemini-flash-lite-latest', name: 'Gemini Flash-Lite Latest', type: 'Standard' },
  { id: 'gemini-2.5-pro', name: 'Gemini 2.5 Pro', type: 'Standard', info: '1M token context' },
  { id: 'gemini-2.5-flash', name: 'Gemini 2.5 Flash', type: 'Standard' },
  { id: 'gemini-2.5-flash-lite', name: 'Gemini 2.5 Flash-Lite', type: 'Standard' },
  { id: 'gemini-2.0-flash', name: 'Gemini 2.0 Flash', type: 'Standard' },
  { id: 'gemini-2.0-flash-lite', name: 'Gemini 2.0 Flash-Lite', type: 'Standard' },
  { id: 'gemini-robotics-er-1.6-preview', name: 'Gemini Robotics ER 1.6 Preview', type: 'Research', info: 'Embodied Reasoning', new: true },
  { id: 'gemini-robotics-er-1.5-preview', name: 'Gemini Robotics ER 1.5 Preview', type: 'Research' },
  { id: 'gemini-3-info', name: 'Gemini 3 info', type: 'Standard', info: 'Search grounding' }
];

/**
 * Schema for a single entry of the `cellAnalyses` array. Shared between
 * praktikum and kuliah report declarations so that a tweak to the contract
 * is a one-line change.
 *
 * The description strings are **byte-stable**: Gemini's response quality is
 * sensitive to prompt wording, so any edit here is a behavior change. The
 * snapshot test `schema.test.ts` guards against accidental drift.
 */
const cellAnalysisItem = {
  type: Type.OBJECT,
  properties: {
    notebookIndex: { type: Type.NUMBER, description: 'Index file notebook (0-based) jika terdapat lebih dari satu notebook yang diupload. WAJIB diisi! Jika bukan notebook (hanya gambar saja), isi dengan -1.' },
    cellIndex: { type: Type.NUMBER, description: 'Index sel notebook di dalam file tersebut. WAJIB diisi! Jika bukan notebook (hanya gambar saja), isi dengan -1.' },
    imageIndex: { type: Type.NUMBER, description: 'Index gambar lampiran (0-based) dari daftar yang diberikan. WAJIB diisi untuk setiap screenshot implementasi atau post_test agar gambar terhubung ke entri ini. Tanpa imageIndex, gambar akan muncul tanpa penjelasan di laporan.' },
    explanation: { type: Type.STRING, description: 'Penjelasan natural berbahasa Indonesia (kalimat pasif, gaya laporan mahasiswa) untuk setiap screenshot/sel. WAJIB minimal 2 kalimat dan menyebut detail konkret yang TERLIHAT di gambar: file/tab editor aktif, nomor baris yang ter-highlight, identifier kode (fungsi/variabel/selector D3/properti CSS), output UI yang dihasilkan (warna, urutan, nilai dropdown), dan perubahan dari step sebelumnya. DILARANG menggunakan pembuka generic seperti "Pada gambar di atas...", "Seperti yang terlihat...", "Berdasarkan tampilan...", "Gambar di atas menunjukkan...". Langsung sebut observasi konkret. Khusus post_test jelaskan baris mana di ipynb / kode yang diubah untuk menyelesaikan tantangan/soal tersebut (jangan hanya berikan jawaban).' },
    caption: { type: Type.STRING, description: 'Caption dinamis & spesifik untuk judul potongan kode. CONTOH: "Import Library Pandas", "Proses Cleansing Data Missing Value". DILARANG KERAS menggunakan kata generic/template seperti "Implementasi Kode"!' },
    tableCaption: { type: Type.STRING, description: 'Caption dinamis khusus untuk output visual (tabel DataFrame/Grafik/Plot). CONTOH: "Tabel Distribusi Kategori Produk", "Grafik Elbow Method". DILARANG KERAS menggunakan kata generic seperti "Tabel/Output DataFrame"!' },
    section: { type: Type.STRING, description: "Wajib diisi 'implementasi' or 'post_test'. Penting! Nilainya harus persis salah satu dari list ini." }
  },
  required: ['explanation', 'caption', 'section', 'notebookIndex', 'cellIndex']
};

const cellAnalysesArray = {
  type: Type.ARRAY,
  description: 'Penjelasan/Analisis ringkas untuk setiap block/cell (baik CODE maupun MARKDOWN) implementasi pada notebook ATAU gambar screenshot langkah kerja. Susun secara kronologis berurutan.',
  items: cellAnalysisItem,
};

// The kuliah declaration had subtly different wording in the imageIndex and
// caption examples of the original code. Preserve those deltas to keep the
// snapshot identical.
const kuliahCellAnalysisItem = {
  type: Type.OBJECT,
  properties: {
    notebookIndex: { type: Type.NUMBER, description: 'Index file notebook (0-based) jika terdapat lebih dari satu notebook yang diupload. WAJIB diisi! Jika bukan notebook (hanya gambar saja), isi dengan -1.' },
    cellIndex: { type: Type.NUMBER, description: 'Index sel notebook di dalam file tersebut. WAJIB diisi! Jika bukan notebook (hanya gambar saja), isi dengan -1.' },
    imageIndex: { type: Type.NUMBER, description: 'Index gambar lampiran (0-based) dari daftar yang diberikan. WAJIB diisi untuk setiap screenshot agar gambar terhubung ke entri ini. Tanpa imageIndex, gambar akan muncul tanpa penjelasan di laporan.' },
    explanation: { type: Type.STRING, description: 'Penjelasan natural berbahasa Indonesia (kalimat pasif, gaya laporan mahasiswa) untuk setiap screenshot/sel. WAJIB minimal 2 kalimat dan menyebut detail konkret yang TERLIHAT di gambar: file/tab editor aktif, nomor baris yang ter-highlight, identifier kode (fungsi/variabel/library), output yang dihasilkan (angka, grafik, tren), dan perubahan dari step sebelumnya. DILARANG menggunakan pembuka generic seperti "Pada gambar di atas...", "Seperti yang terlihat...", "Berdasarkan tampilan...", "Gambar di atas menunjukkan...". Langsung sebut observasi konkret.' },
    caption: { type: Type.STRING, description: 'Caption dinamis & spesifik untuk judul potongan kode. CONTOH: "Import Library Scikit-Learn", "Ekstraksi Fitur Model". DILARANG KERAS menggunakan kata generic/template seperti "Implementasi Kode"!' },
    tableCaption: { type: Type.STRING, description: 'Caption dinamis khusus untuk output visual (tabel DataFrame/Grafik/Plot). CONTOH: "Tabel Matriks Korelasi", "Grafik Akurasi Pelatihan". DILARANG KERAS menggunakan kata generic seperti "Tabel/Output DataFrame"!' },
    section: { type: Type.STRING, description: "Untuk laporan kuliah ini wajib diset 'implementasi'." }
  },
  required: ['explanation', 'caption', 'section', 'notebookIndex', 'cellIndex']
};

const kuliahCellAnalysesArray = {
  type: Type.ARRAY,
  description: 'Penjelasan/Analisis ringkas untuk setiap block/cell (baik CODE maupun MARKDOWN) implementasi pada notebook ATAU gambar screenshot langkah kerja. Susun secara kronologis berurutan.',
  items: kuliahCellAnalysisItem,
};

/**
 * Praktikum-report function declaration sent to Gemini.
 *
 * The `cellAnalyses` sub-schema is hoisted to `cellAnalysesArray` above so
 * the two declarations share one definition. The kuliah variant uses a
 * separate `kuliahCellAnalysesArray` because its `imageIndex`/`caption` /
 * `tableCaption` / `section` descriptions differ from praktikum by design
 * (the snapshot test guards the byte-for-byte equivalence with the
 * pre-refactor output).
 */
const conclusionItem = {
    type: Type.OBJECT,
    properties: {
      teks: { type: Type.STRING, description: 'Paragraf kesimpulan atau analisis. WAJIB menggunakan bahasa profesional. Istilah bahasa Inggris/asing WAJIB dicetak miring (contoh: "*Confusion Matrix*").' },
      imageIndex: { type: Type.NUMBER, description: 'Index grafik/visualisasi (0-based) dari daftar lampiran yang sedang Anda bahas. JANGAN diisi jika Anda tidak membahas gambar tertentu dalam paragraf ini!' },
      caption: { type: Type.STRING, description: 'Caption gambar jika menampilkan image (contoh: "Grafik Confusion Matrix").' }
    },
    required: ['teks']
};

const conclusionArray = {
  type: Type.ARRAY,
  description: 'Daftar paragraf analisis hasil / kesimpulan. Tiap elemen objek adalah satu paragraf, dan Anda bisa secara dinamis menyatukan atau memanggil lampiran grafik (jika relevan) menggunakan imageIndex.',
  items: conclusionItem
};

export const generateReportDeclaration = {
  name: 'generate_report',
  description: 'Extrack data format untuk laporan praktikum',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pre_test: {
        type: Type.OBJECT,
        description: 'Pertanyaan dan Jawaban Pre Test. Wajib diisi! tidak boleh kosong. Gunakan markdown list jika soal memiliki sub-poin. Jangan menyingkat soal!',
        properties: {
          questions: { type: Type.ARRAY, description: 'Daftar soal pre test (pastikan persis seperti input)', items: { type: Type.STRING } },
          answers: { type: Type.ARRAY, description: 'Jawaban soal pre test', items: { type: Type.STRING } },
        },
        required: ['questions', 'answers'],
      },
      praktikum: {
        type: Type.OBJECT,
        properties: {
          alat_dan_bahan: { type: Type.ARRAY, description: 'Daftar perangkat (Keras, Lunak, Library, Bahasa Pemrograman dll). Contoh array: ["1. Perangkat Keras: PC Lab", "2. Perangkat Lunak: Browser", "3. Bahasa Pemrograman: Python", "4. Library: Pandas, Numpy"]', items: { type: Type.STRING } },
          langkah_kerja: { type: Type.STRING, description: 'Penjelasan naratif (narasi dengan format markdown list agar rapi dan bagus) step-by-step implementasinya' },
          analisis_hasil: conclusionArray,
          cellAnalyses: cellAnalysesArray,
          ulasan_praktikum: { type: Type.STRING, description: 'Ulasan/Feedback pelaksanaan praktikum berupa perasaan, kendala/kesulitan, atau saran. Jika user tidak menyediakan teks ulasan, draft secara natural (berikan feedback generik positif/konstruktif, minimal 1 kalimat panjang).' },
        },
        required: ['alat_dan_bahan', 'langkah_kerja', 'analisis_hasil', 'cellAnalyses', 'ulasan_praktikum'],
      },
      post_test: {
        type: Type.OBJECT,
        description: 'Pertanyaan dan Jawaban Post Test (Tugas). Wajib diisi! Jangan menyingkat soal. Gunakan markdown list jika soal memiliki sub-points seperti Tugas A, Tugas B dll.',
        properties: {
          questions: { type: Type.ARRAY, description: 'Daftar soal post test (Wajib persis seperti di modul, dukung markdown list)', items: { type: Type.STRING } },
          answers: { type: Type.ARRAY, description: 'Jawaban post test detail', items: { type: Type.STRING } },
        },
        required: ['questions', 'answers'],
      },
    },
    required: ['pre_test', 'praktikum', 'post_test'],
  },
};

export const parseModuleDeclaration = {
  name: 'parse_module_praktikum',
  description: 'Extrack content dari pdf modul praktikum',
  parameters: {
    type: Type.OBJECT,
    properties: {
      pertemuan_data: {
        type: Type.ARRAY,
        description: 'Daftar pertemuan praktikum yang diekstrak dari seluruh halaman modul.',
        items: {
          type: Type.OBJECT,
          properties: {
            pertemuan: { type: Type.NUMBER, description: 'Angka pertemuan (1, 2, 3...)' },
            judul: { type: Type.STRING, description: 'Topik atau judul materi pada pertemuan ini' },
            pre_test: { type: Type.STRING, description: 'Soal, tugas, atau instruksi pre-test pada pertemuan ini (jika ada)' },
            langkah: { type: Type.STRING, description: 'Seluruh langkah praktikum yang ada di dalam modul (mulai dari persiapan, pelaksanaan, hingga analisis/evaluasi). WAJIB EXTRACT SEMUANYA SECARA LENGKAP SAMA PERSIS dengan teks aslinya tanpa ada yang disingkat atau di-skip, gunakan markdown list numerik.' },
            post_test: { type: Type.STRING, description: 'Soal, tugas, atau instruksi post-test pada pertemuan ini (jika ada)' }
          },
          required: ['pertemuan', 'judul', 'langkah']
        }
      }
    },
    required: ['pertemuan_data']
  }
};

export const generateKuliahReportDeclaration = {
  name: 'generate_report',
  description: 'Extrack data format untuk laporan kuliah',
  parameters: {
    type: Type.OBJECT,
    properties: {
      kuliah: {
        type: Type.OBJECT,
        properties: {
          pendahuluan: { type: Type.STRING, description: 'Bab Pendahuluan yang memuat latar belakang kajian atau tugas secara komprehensif. Susun narasinya dengan rapi.' },
          analisis_hasil: conclusionArray,
          cellAnalyses: kuliahCellAnalysesArray,
        },
        required: ['pendahuluan', 'analisis_hasil', 'cellAnalyses'],
      }
    },
    required: ['kuliah'],
  },
};
