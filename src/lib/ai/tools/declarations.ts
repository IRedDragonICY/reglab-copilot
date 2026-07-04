/**
 * Granular, meta, and inspection tool declarations exposed to Gemini
 * alongside the legacy monolithic `generate_report` /
 * `generate_kuliah_report` calls (Req 6.1–6.3, 9.4).
 *
 * The declarations follow the same `Type.OBJECT/STRING/NUMBER/ARRAY`
 * style that lives in `src/lib/ai/schema.ts`. They are NOT imported
 * from `schema.ts` — the legacy file is byte-stable and snapshot
 * tested (Req 9.4). The few sub-shapes shared with the legacy
 * declarations (notably the `cellAnalysisItem` shape used by
 * `add_cell_analysis` / `update_cell_analysis`) are duplicated inline
 * so this module is self-contained and any future change to the
 * granular contract has no risk of bleeding into the legacy bytes.
 *
 * Description tone for the granular write tools intentionally mirrors
 * the corresponding `cellAnalysisItem` field descriptions in
 * `schema.ts` (Indonesian, imperative). Reusing the exact wording
 * keeps the model's behavior consistent across the monolithic and
 * granular paths — its prior on what an `explanation` or `caption`
 * means does not shift when it switches between the two.
 *
 * The `ALL_GRANULAR_DECLARATIONS` aggregate is the canonical bundle
 * passed to the tool registry (task 8.2) and from there into the
 * `tools[].functionDeclarations` array on `generateContentStream`.
 */

import { Type } from '@google/genai';

/**
 * Shape of a single declaration entry. Matches the Gemini SDK's
 * `FunctionDeclaration` surface but kept minimal to avoid a hard
 * compile-time dep on the SDK's exported type — the registry layer
 * casts to `FunctionDeclaration` at the boundary.
 */
export interface ToolDeclaration {
  name: string;
  description: string;
  /** Gemini OpenAPI-style schema with `Type.OBJECT` at the root. */
  parameters: unknown;
}

// ---------------------------------------------------------------------------
// Shared sub-shapes (duplicated from schema.ts on purpose — see file header)
// ---------------------------------------------------------------------------

/**
 * The `entry` shape for `add_cell_analysis`, structurally equivalent
 * to `cellAnalysisItem` in `schema.ts`. Descriptions match byte-for-byte
 * so the model's understanding of each field carries over from the
 * monolithic schema.
 */
const cellAnalysisEntrySchema = {
  type: Type.OBJECT,
  properties: {
    notebookIndex: {
      type: Type.NUMBER,
      description: 'Index file notebook (0-based) jika terdapat lebih dari satu notebook yang diupload.',
    },
    cellIndex: {
      type: Type.NUMBER,
      description: 'Index sel notebook di dalam file tersebut',
    },
    imageIndex: {
      type: Type.NUMBER,
      description:
        'Index gambar lampiran (0-based) dari daftar yang diberikan. WAJIB diisi untuk setiap screenshot implementasi atau post_test agar gambar terhubung ke entri ini. Tanpa imageIndex, gambar akan muncul tanpa penjelasan di laporan.',
    },
    explanation: {
      type: Type.STRING,
      description:
        'Penjelasan natural berbahasa Indonesia (kalimat pasif, gaya laporan mahasiswa) untuk setiap screenshot/sel. WAJIB minimal 2 kalimat dan menyebut detail konkret yang TERLIHAT di gambar: file/tab editor aktif, nomor baris yang ter-highlight, identifier kode (fungsi/variabel/selector D3/properti CSS), output UI yang dihasilkan (warna, urutan, nilai dropdown), dan perubahan dari step sebelumnya. Hindari kata-kata puitis/kaku seperti "memberikan wawasan mendalam" atau "mengonfirmasi ketangguhan". DILARANG menggunakan pembuka generic seperti "Pada gambar di atas...", "Seperti yang terlihat...", "Berdasarkan tampilan...", "Gambar di atas menunjukkan...". Langsung sebut observasi konkret.',
    },
    caption: {
      type: Type.STRING,
      description:
        'Caption dinamis & spesifik untuk judul potongan kode. CONTOH: "Import Library Pandas", "Proses Cleansing Data Missing Value". DILARANG KERAS menggunakan kata generic/template seperti "Implementasi Kode"!',
    },
    tableCaption: {
      type: Type.STRING,
      description:
        'Caption dinamis khusus untuk output visual (tabel DataFrame/Grafik/Plot). CONTOH: "Tabel Distribusi Kategori Produk", "Grafik Elbow Method". DILARANG KERAS menggunakan kata generic seperti "Tabel/Output DataFrame"!',
    },
    section: {
      type: Type.STRING,
      description:
        "Wajib diisi 'implementasi' or 'post_test'. Penting! Nilainya harus persis salah satu dari list ini.",
    },
  },
  required: ['explanation', 'caption', 'section'],
};

/**
 * The `patch` shape for `update_cell_analysis`. Same properties as
 * the entry but no `required` list — every field is optional and only
 * the ones the model wants to change need to be supplied.
 */
const cellAnalysisPatchSchema = {
  type: Type.OBJECT,
  description:
    'Subset of CellAnalysis fields to overwrite on the matched entry. Omit fields you do not want to change.',
  properties: {
    notebookIndex: {
      type: Type.NUMBER,
      description: 'Index file notebook (0-based) jika terdapat lebih dari satu notebook yang diupload.',
    },
    cellIndex: {
      type: Type.NUMBER,
      description: 'Index sel notebook di dalam file tersebut',
    },
    imageIndex: {
      type: Type.NUMBER,
      description:
        'Index gambar lampiran (0-based) dari daftar yang diberikan. WAJIB diisi untuk setiap screenshot implementasi atau post_test agar gambar terhubung ke entri ini.',
    },
    explanation: {
      type: Type.STRING,
      description:
        'Penjelasan natural berbahasa Indonesia (kalimat pasif, gaya laporan mahasiswa) untuk setiap screenshot/sel. Hindari kata-kata puitis/kaku seperti "memberikan wawasan mendalam". Aturan tone & isi sama dengan add_cell_analysis.',
    },
    caption: {
      type: Type.STRING,
      description:
        'Caption dinamis & spesifik untuk judul potongan kode. DILARANG KERAS menggunakan kata generic/template seperti "Implementasi Kode"!',
    },
    tableCaption: {
      type: Type.STRING,
      description:
        'Caption dinamis khusus untuk output visual (tabel DataFrame/Grafik/Plot). DILARANG KERAS menggunakan kata generic seperti "Tabel/Output DataFrame"!',
    },
    section: {
      type: Type.STRING,
      description: "Salah satu dari 'implementasi' atau 'post_test'.",
    },
  },
};

/**
 * The `matcher` shape for `update_cell_analysis` and
 * `delete_cell_analysis`. `section` is required so the agent always
 * targets a definite layout slot; the index fields are wildcards when
 * absent (per Req 6.1).
 */
const cellAnalysisMatcherSchema = {
  type: Type.OBJECT,
  description:
    'Selects an existing CellAnalysis entry. notebookIndex / cellIndex / imageIndex act as wildcards when omitted; the first matching entry in document order is targeted.',
  properties: {
    notebookIndex: {
      type: Type.NUMBER,
      description: 'Index file notebook (0-based). Omit to wildcard.',
    },
    cellIndex: {
      type: Type.NUMBER,
      description: 'Index sel notebook. Omit to wildcard.',
    },
    imageIndex: {
      type: Type.NUMBER,
      description: 'Index gambar lampiran (0-based). Omit to wildcard.',
    },
    section: {
      type: Type.STRING,
      description: "Salah satu dari 'implementasi' atau 'post_test'. Wajib diisi.",
    },
  },
  required: ['section'],
};

/**
 * Shape of a single Q&A pair, shared between `set_pre_test_qa` and
 * `set_post_test_qa`.
 */
const qaPairSchema = {
  type: Type.OBJECT,
  properties: {
    q: {
      type: Type.STRING,
      description:
        'Teks pertanyaan persis seperti pada modul. JANGAN disingkat atau diparafrase.',
    },
    a: {
      type: Type.STRING,
      description: 'Jawaban detail untuk pertanyaan tersebut.',
    },
  },
  required: ['q', 'a'],
};

// ---------------------------------------------------------------------------
// Granular write tools (9)
// ---------------------------------------------------------------------------

export const addCellAnalysisDeclaration: ToolDeclaration = {
  name: 'add_cell_analysis',
  description:
    'Append a single CellAnalysis entry to the report. Use this when adding one new screenshot or notebook-cell explanation. Prefer this over generate_report when the user is iteratively building up a report; it produces a smaller, traceable change.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      entry: cellAnalysisEntrySchema,
    },
    required: ['entry'],
  },
};

export const updateCellAnalysisDeclaration: ToolDeclaration = {
  name: 'update_cell_analysis',
  description:
    'Update fields of an existing CellAnalysis entry. The matcher selects by (notebookIndex, cellIndex, imageIndex, section); undefined fields in the matcher act as wildcards. The patch contains only the fields to change.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      matcher: cellAnalysisMatcherSchema,
      patch: cellAnalysisPatchSchema,
    },
    required: ['matcher', 'patch'],
  },
};

export const deleteCellAnalysisDeclaration: ToolDeclaration = {
  name: 'delete_cell_analysis',
  description:
    'Delete a CellAnalysis entry by matcher. Same matcher semantics as update_cell_analysis.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      matcher: cellAnalysisMatcherSchema,
    },
    required: ['matcher'],
  },
};

export const setPendahuluanDeclaration: ToolDeclaration = {
  name: 'set_pendahuluan',
  description:
    "Replace the report's `pendahuluan` (introduction) with the supplied Indonesian-language narrative paragraph.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description:
          'Bab Pendahuluan yang memuat latar belakang kajian atau tugas secara komprehensif. Susun narasinya dengan rapi.',
      },
    },
    required: ['text'],
  },
};

export const setAlatDanBahanDeclaration: ToolDeclaration = {
  name: 'set_alat_dan_bahan',
  description:
    "Replace the report's `alatDanBahan` (tools and materials) list. Each entry is one numbered or labeled item, e.g. '1. Perangkat Keras: PC Lab'.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      items: {
        type: Type.ARRAY,
        description:
          'Daftar perangkat (Keras, Lunak, Library, Bahasa Pemrograman dll). Contoh array: ["1. Perangkat Keras: PC Lab", "2. Perangkat Lunak: Browser", "3. Bahasa Pemrograman: Python", "4. Library: Pandas, Numpy"]',
        items: { type: Type.STRING },
      },
    },
    required: ['items'],
  },
};

export const setStepByStepNarrativeDeclaration: ToolDeclaration = {
  name: 'set_step_by_step_narrative',
  description:
    "Replace the report's `stepByStepNarrative` (Langkah Kerja) with markdown-formatted steps.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description:
          'Penjelasan naratif (narasi dengan format markdown list agar rapi dan bagus) step-by-step implementasinya',
      },
    },
    required: ['text'],
  },
};

export const setCodeAnalysisDeclaration: ToolDeclaration = {
  name: 'set_code_analysis',
  description:
    "Replace the report's `codeAnalysis` (overall analysis paragraph) with the supplied Indonesian-language narrative.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      text: {
        type: Type.STRING,
        description:
          'Analisis keseluruhan dari implementasi kode hasil praktikum. Tulis dalam bahasa Indonesia yang mengalir dan koheren.',
      },
    },
    required: ['text'],
  },
};

export const setPreTestQaDeclaration: ToolDeclaration = {
  name: 'set_pre_test_qa',
  description:
    "Replace the report's pre-test Q&A list. Each entry pairs an exact question text with its answer. Do not abbreviate the question.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      pairs: {
        type: Type.ARRAY,
        description:
          'Daftar pasangan soal & jawaban Pre Test. Pertanyaan harus persis seperti modul (boleh markdown list bila ada sub-poin).',
        items: qaPairSchema,
      },
    },
    required: ['pairs'],
  },
};

export const setPostTestQaDeclaration: ToolDeclaration = {
  name: 'set_post_test_qa',
  description:
    "Replace the report's post-test Q&A list. Same shape as set_pre_test_qa.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      pairs: {
        type: Type.ARRAY,
        description:
          'Daftar pasangan soal & jawaban Post Test (Tugas). Pertanyaan harus persis seperti modul; gunakan markdown list untuk sub-points seperti Tugas A, Tugas B.',
        items: qaPairSchema,
      },
    },
    required: ['pairs'],
  },
};

export const setUlasanPraktikumDeclaration: ToolDeclaration = {
  name: 'set_ulasan_praktikum',
  description:
    "Set the feedback/ulasan of the practicum. JIKA USER MEMBERIKAN RAW INPUT ULASAN, ANDA WAJIB MERANGKUM/MENYEMPURNAKAN SELURUH POIN DARI INPUT TERSEBUT SECARA DETAIL TANPA ADA YANG HILANG. Jika user tidak menyediakan teks ulasan, draft secara natural.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      ulasan_praktikum: {
        type: Type.STRING,
        description:
          'Ulasan/Feedback pelaksanaan praktikum berupa perasaan, kendala/kesulitan, atau saran. JIKA USER MEMBERIKAN RAW INPUT ULASAN, ANDA WAJIB MERANGKUM/MENYEMPURNAKAN SELURUH POIN DARI INPUT TERSEBUT SECARA DETAIL TANPA ADA YANG HILANG. Jika user tidak menyediakan teks ulasan, draft secara natural.',
      },
    },
    required: ['ulasan_praktikum'],
  },
};

// ---------------------------------------------------------------------------
// Meta-tools (4)
// ---------------------------------------------------------------------------

export const setTaskPlanDeclaration: ToolDeclaration = {
  name: 'set_task_plan',
  description:
    "Declare the agent's planned subtasks for this run. The user sees this as a checklist in the Active Task Panel. Each step should be concrete and actionable. Call once at the start of a complex run.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      steps: {
        type: Type.ARRAY,
        description:
          'Ordered list of planned subtasks. Each step renders as a checklist row.',
        items: {
          type: Type.OBJECT,
          properties: {
            id: {
              type: Type.STRING,
              description:
                'Stable identifier for this step. Used by update_task_status to update progress.',
            },
            title: {
              type: Type.STRING,
              description: 'Short, user-readable label for the step.',
            },
            description: {
              type: Type.STRING,
              description: 'Optional longer explanation shown beneath the title.',
            },
          },
          required: ['id', 'title'],
        },
      },
    },
    required: ['steps'],
  },
};

export const updateTaskStatusDeclaration: ToolDeclaration = {
  name: 'update_task_status',
  description: 'Update the status of a previously-declared task plan step.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      id: {
        type: Type.STRING,
        description: 'The id of the step declared via set_task_plan.',
      },
      status: {
        type: Type.STRING,
        description: "New status for the step.",
        enum: ['pending', 'active', 'done'],
      },
    },
    required: ['id', 'status'],
  },
};

export const requestUserClarificationDeclaration: ToolDeclaration = {
  name: 'request_user_clarification',
  description:
    'Pause the agent and ask the user a clarifying question. The agent will resume after the user replies via the chat composer. Use this when the input is ambiguous and a wrong assumption would waste tokens.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      question: {
        type: Type.STRING,
        description: 'The clarifying question to surface to the user verbatim.',
      },
    },
    required: ['question'],
  },
};

export const markTaskCompleteDeclaration: ToolDeclaration = {
  name: 'mark_task_complete',
  description:
    "Signal that the agent has finished its current Run. Optional one-line summary becomes the agent's final chat message.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      summary: {
        type: Type.STRING,
        description: "Optional one-line wrap-up shown to the user as the agent's final message.",
      },
    },
  },
};

// ---------------------------------------------------------------------------
// Inspection tools (2)
// ---------------------------------------------------------------------------

export const inspectImageDeclaration: ToolDeclaration = {
  name: 'inspect_image',
  description:
    'Re-inspect a specific uploaded image by category and index. The next iteration will receive only that image plus a focused prompt — useful when you need to verify a detail without scanning the whole batch again.',
  parameters: {
    type: Type.OBJECT,
    properties: {
      category: {
        type: Type.STRING,
        description: 'Which uploaded image bucket to pull from.',
        enum: ['pre_test', 'implementasi', 'post_test', 'notebook'],
      },
      index: {
        type: Type.NUMBER,
        description: '0-based index inside the chosen category bucket.',
      },
    },
    required: ['category', 'index'],
  },
};

export const readNotebookCellDeclaration: ToolDeclaration = {
  name: 'read_notebook_cell',
  description:
    "Read a specific notebook cell's source and outputs. Returns text only; use inspect_image for cell visual outputs. Useful to re-check code mid-run.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      notebookIndex: {
        type: Type.NUMBER,
        description: '0-based index of the notebook file when multiple were uploaded.',
      },
      cellIndex: {
        type: Type.NUMBER,
        description: '0-based index of the cell within the chosen notebook.',
      },
    },
    required: ['notebookIndex', 'cellIndex'],
  },
};

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

/**
 * The full set of granular + meta + inspection declarations the agent
 * registry exposes. Order is intentional and matches the order in
 * Req 6.1–6.3 so the snapshot test reads top-down by tool kind.
 *
 * The legacy `generate_report`, `generate_kuliah_report`, and
 * `parse_module_praktikum` declarations are deliberately NOT included
 * (Req 6.8, 9.4) — they continue to live in `src/lib/ai/schema.ts`
 * and are passed alongside this aggregate by the registry layer.
 */
export const ALL_GRANULAR_DECLARATIONS: readonly ToolDeclaration[] = [
  // Granular writes (10)
  addCellAnalysisDeclaration,
  updateCellAnalysisDeclaration,
  deleteCellAnalysisDeclaration,
  setPendahuluanDeclaration,
  setAlatDanBahanDeclaration,
  setStepByStepNarrativeDeclaration,
  setCodeAnalysisDeclaration,
  setPreTestQaDeclaration,
  setPostTestQaDeclaration,
  setUlasanPraktikumDeclaration,
  // Meta (4)
  setTaskPlanDeclaration,
  updateTaskStatusDeclaration,
  requestUserClarificationDeclaration,
  markTaskCompleteDeclaration,
  // Inspection (2)
  inspectImageDeclaration,
  readNotebookCellDeclaration,
];
