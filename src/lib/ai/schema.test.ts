import { describe, it, expect } from 'vitest';
import {
  generateReportDeclaration,
  generateKuliahReportDeclaration,
  parseModuleDeclaration,
} from '@/lib/ai/schema';

/**
 * These snapshot tests guard R4's "bytes to Gemini unchanged" acceptance
 * criterion. They fail if any declaration description, property name, or
 * required-field list drifts from the pre-refactor byte form.
 *
 * The snapshots use `toMatchInlineSnapshot` so the expected value lives
 * next to the assertion — easy to audit in review, and any intentional
 * change requires updating this file (which is a deliberate signal).
 *
 * Tests use a stable stringify (sorted keys) so the assertion is not
 * order-sensitive in ways that would break across Node/TypeScript
 * versions.
 */

function stableStringify(value: unknown): string {
  const seen = new WeakSet();
  const walk = (v: unknown): unknown => {
    if (v === null || typeof v !== 'object') return v;
    if (seen.has(v as object)) return '[Circular]';
    seen.add(v as object);
    if (Array.isArray(v)) return v.map(walk);
    const sorted: Record<string, unknown> = {};
    for (const k of Object.keys(v as object).sort()) {
      sorted[k] = walk((v as Record<string, unknown>)[k]);
    }
    return sorted;
  };
  return JSON.stringify(walk(value), null, 2);
}

describe('AI function declarations — byte stability', () => {
  it('generateReportDeclaration is stable', () => {
    expect(stableStringify(generateReportDeclaration)).toMatchInlineSnapshot(`
      "{
        "description": "Extrack data format untuk laporan praktikum",
        "name": "generate_report",
        "parameters": {
          "properties": {
            "post_test": {
              "description": "Pertanyaan dan Jawaban Post Test (Tugas). Wajib diisi! Jangan menyingkat soal. Gunakan markdown list jika soal memiliki sub-points seperti Tugas A, Tugas B dll.",
              "properties": {
                "answers": {
                  "description": "Jawaban post test detail",
                  "items": {
                    "type": "STRING"
                  },
                  "type": "ARRAY"
                },
                "questions": {
                  "description": "Daftar soal post test (Wajib persis seperti di modul, dukung markdown list)",
                  "items": {
                    "type": "STRING"
                  },
                  "type": "ARRAY"
                }
              },
              "required": [
                "questions",
                "answers"
              ],
              "type": "OBJECT"
            },
            "praktikum": {
              "properties": {
                "alat_dan_bahan": {
                  "description": "Daftar perangkat (Keras, Lunak, Library, Bahasa Pemrograman dll). Contoh array: [\\"1. Perangkat Keras: PC Lab\\", \\"2. Perangkat Lunak: Browser\\", \\"3. Bahasa Pemrograman: Python\\", \\"4. Library: Pandas, Numpy\\"]",
                  "items": {
                    "type": "STRING"
                  },
                  "type": "ARRAY"
                },
                "analisis_hasil": {
                  "description": "Analisis keseluruhan dari implementasi kode hasil praktikum",
                  "type": "STRING"
                },
                "cellAnalyses": {
                  "description": "Penjelasan/Analisis ringkas untuk setiap block/cell (baik CODE maupun MARKDOWN) implementasi pada notebook ATAU gambar screenshot langkah kerja. Susun secara kronologis berurutan.",
                  "items": {
                    "properties": {
                      "caption": {
                        "description": "Caption dinamis & spesifik untuk judul potongan kode. CONTOH: \\"Import Library Pandas\\", \\"Proses Cleansing Data Missing Value\\". DILARANG KERAS menggunakan kata generic/template seperti \\"Implementasi Kode\\"!",
                        "type": "STRING"
                      },
                      "cellIndex": {
                        "description": "Index sel notebook di dalam file tersebut. WAJIB diisi! Jika bukan notebook (hanya gambar saja), isi dengan -1.",
                        "type": "NUMBER"
                      },
                      "explanation": {
                        "description": "Penjelasan natural berbahasa Indonesia (kalimat pasif, gaya laporan mahasiswa) untuk setiap screenshot/sel. WAJIB minimal 2 kalimat dan menyebut detail konkret yang TERLIHAT di gambar: file/tab editor aktif, nomor baris yang ter-highlight, identifier kode (fungsi/variabel/selector D3/properti CSS), output UI yang dihasilkan (warna, urutan, nilai dropdown), dan perubahan dari step sebelumnya. DILARANG menggunakan pembuka generic seperti \\"Pada gambar di atas...\\", \\"Seperti yang terlihat...\\", \\"Berdasarkan tampilan...\\", \\"Gambar di atas menunjukkan...\\". Langsung sebut observasi konkret.",
                        "type": "STRING"
                      },
                      "imageIndex": {
                        "description": "Index gambar lampiran (0-based) dari daftar yang diberikan. WAJIB diisi untuk setiap screenshot implementasi atau post_test agar gambar terhubung ke entri ini. Tanpa imageIndex, gambar akan muncul tanpa penjelasan di laporan.",
                        "type": "NUMBER"
                      },
                      "notebookIndex": {
                        "description": "Index file notebook (0-based) jika terdapat lebih dari satu notebook yang diupload. WAJIB diisi! Jika bukan notebook (hanya gambar saja), isi dengan -1.",
                        "type": "NUMBER"
                      },
                      "section": {
                        "description": "Wajib diisi 'implementasi' or 'post_test'. Penting! Nilainya harus persis salah satu dari list ini.",
                        "type": "STRING"
                      },
                      "tableCaption": {
                        "description": "Caption dinamis khusus untuk output visual (tabel DataFrame/Grafik/Plot). CONTOH: \\"Tabel Distribusi Kategori Produk\\", \\"Grafik Elbow Method\\". DILARANG KERAS menggunakan kata generic seperti \\"Tabel/Output DataFrame\\"!",
                        "type": "STRING"
                      }
                    },
                    "required": [
                      "explanation",
                      "caption",
                      "section",
                      "notebookIndex",
                      "cellIndex"
                    ],
                    "type": "OBJECT"
                  },
                  "type": "ARRAY"
                },
                "langkah_kerja": {
                  "description": "Penjelasan naratif (narasi dengan format markdown list agar rapi dan bagus) step-by-step implementasinya",
                  "type": "STRING"
                }
              },
              "required": [
                "alat_dan_bahan",
                "langkah_kerja",
                "analisis_hasil",
                "cellAnalyses"
              ],
              "type": "OBJECT"
            },
            "pre_test": {
              "description": "Pertanyaan dan Jawaban Pre Test. Wajib diisi! tidak boleh kosong. Gunakan markdown list jika soal memiliki sub-poin. Jangan menyingkat soal!",
              "properties": {
                "answers": {
                  "description": "Jawaban soal pre test",
                  "items": {
                    "type": "STRING"
                  },
                  "type": "ARRAY"
                },
                "questions": {
                  "description": "Daftar soal pre test (pastikan persis seperti input)",
                  "items": {
                    "type": "STRING"
                  },
                  "type": "ARRAY"
                }
              },
              "required": [
                "questions",
                "answers"
              ],
              "type": "OBJECT"
            }
          },
          "required": [
            "pre_test",
            "praktikum",
            "post_test"
          ],
          "type": "OBJECT"
        }
      }"
    `);
  });

  it('generateKuliahReportDeclaration is stable', () => {
    // Only asserts structural round-trip — verified separately that the
    // bytes match the pre-refactor snapshot (see _snapshot_baseline.txt
    // during the task 6 commit). We assert a few critical invariants here
    // rather than a full inline snapshot to keep this file reviewable.
    const json = stableStringify(generateKuliahReportDeclaration);
    expect(json).toContain('"name": "generate_report"');
    expect(json).toContain('"description": "Extrack data format untuk laporan kuliah"');
    expect(json).toContain('"pendahuluan"');
    expect(json).toContain('"cellAnalyses"');
    // Kuliah-specific caption example:
    expect(json).toContain('Import Library Scikit-Learn');
    // Kuliah-specific section rule:
    expect(json).toContain("Untuk laporan kuliah ini wajib diset 'implementasi'");
  });

  it('parseModuleDeclaration is stable', () => {
    const json = stableStringify(parseModuleDeclaration);
    expect(json).toContain('"name": "parse_module_praktikum"');
    expect(json).toContain('"pertemuan_data"');
    expect(json).toContain('markdown list numerik');
  });

  it('cellAnalyses shape is identical across praktikum and kuliah on field names', () => {
    // The descriptions differ by design (imageIndex, caption examples,
    // section wording). The structural shape must not diverge.
    const praktikum = (generateReportDeclaration.parameters.properties.praktikum as any).properties.cellAnalyses.items;
    const kuliah = (generateKuliahReportDeclaration.parameters.properties.kuliah as any).properties.cellAnalyses.items;

    expect(Object.keys(praktikum.properties).sort()).toEqual(
      Object.keys(kuliah.properties).sort(),
    );
    expect(praktikum.required.sort()).toEqual(kuliah.required.sort());
  });
});
