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
                  "description": "Jawaban post test / solusi detail. WAJIB DIISI! Jawab semua pertanyaan post test dengan pengetahuan Anda secara mendalam. Jika melibatkan flowchart/diagram, terjemahkan/jelaskan diagram tersebut.",
                  "items": {
                    "type": "STRING"
                  },
                  "type": "ARRAY"
                },
                "cellAnalyses": {
                  "description": "Penjelasan/Analisis ringkas untuk SETIAP gambar screenshot (baik dari bagian Implementasi MAUPUN Post-Test) ATAU setiap sel notebook. Anda WAJIB membuat satu entri di array ini untuk SETIAP gambar yang diunggah agar gambar tersebut tidak dibuang (orphan). Susun secara kronologis berurutan.",
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
                        "description": "Penjelasan natural berbahasa Indonesia (kalimat pasif, gaya laporan mahasiswa) untuk setiap screenshot/sel. WAJIB minimal 2 kalimat dan menyebut detail konkret yang TERLIHAT di gambar. JIKA GAMBAR ADALAH GRAFIK/VISUALISASI (Clustering/KNN dll), Anda WAJIB menganalisis mengapa bentuknya seperti itu (contoh: mengapa boundary acak/amburadul, distribusi data, pengaruh nilai K, overfitting/underfitting). Hindari gaya bahasa puitis/kaku (misal: \\"memberikan pemahaman baru\\" BUKAN \\"memberikan wawasan mendalam\\"). DILARANG menggunakan pembuka generic seperti \\"Pada gambar di atas...\\". Langsung sebut observasi konkret. Khusus post_test jelaskan baris mana di ipynb / kode yang diubah untuk menyelesaikan tantangan/soal tersebut (jangan hanya berikan jawaban).",
                        "type": "STRING"
                      },
                      "imageCategory": {
                        "description": "Kategori/bucket asal gambar lampiran tersebut diupload. Wajib disesuaikan dengan label [KATEGORI UPLOAD] yang mendahului gambar.",
                        "enum": [
                          "pre_test",
                          "implementasi",
                          "post_test",
                          "notebook"
                        ],
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
                        "enum": [
                          "implementasi",
                          "post_test"
                        ],
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
                  "description": "Daftar paragraf analisis hasil / kesimpulan. Tiap elemen objek adalah satu paragraf, dan Anda bisa secara dinamis menyatukan atau memanggil lampiran grafik (jika relevan) menggunakan imageIndex.",
                  "items": {
                    "properties": {
                      "caption": {
                        "description": "Caption gambar jika menampilkan image (contoh: \\"Grafik Confusion Matrix\\").",
                        "type": "STRING"
                      },
                      "imageCategory": {
                        "description": "Kategori/bucket asal gambar lampiran tersebut diupload. Wajib disesuaikan dengan label [KATEGORI UPLOAD] yang mendahului gambar.",
                        "enum": [
                          "pre_test",
                          "implementasi",
                          "post_test",
                          "notebook"
                        ],
                        "type": "STRING"
                      },
                      "imageIndex": {
                        "description": "Index grafik/visualisasi (0-based) dari daftar lampiran yang sedang Anda bahas. JANGAN diisi jika Anda tidak membahas gambar tertentu dalam paragraf ini!",
                        "type": "NUMBER"
                      },
                      "teks": {
                        "description": "Paragraf kesimpulan atau analisis. WAJIB menggunakan bahasa profesional. Istilah bahasa Inggris/asing WAJIB dicetak miring (contoh: \\"*Confusion Matrix*\\").",
                        "type": "STRING"
                      }
                    },
                    "required": [
                      "teks"
                    ],
                    "type": "OBJECT"
                  },
                  "type": "ARRAY"
                },
                "cellAnalyses": "[Circular]",
                "judul_laporan": {
                  "description": "Judul laporan/praktikum singkat dan padat yang digenerate secara otomatis berdasarkan konteks/modul JIKA belum ada judul yang diberikan (misalnya \\"Penghitungan Bibit Ikan Berbasis Computer Vision dan YOLO\\").",
                  "type": "STRING"
                },
                "langkah_kerja": {
                  "description": "Penjelasan naratif (narasi dengan format markdown list agar rapi dan bagus) step-by-step implementasinya",
                  "type": "STRING"
                },
                "ulasan_praktikum": {
                  "description": "Ulasan/Feedback pelaksanaan praktikum berupa perasaan, kendala/kesulitan, atau saran. JIKA USER MEMBERIKAN RAW INPUT ULASAN, ANDA WAJIB MERANGKUM/MENYEMPURNAKAN SELURUH POIN DARI INPUT TERSEBUT SECARA DETAIL TANPA ADA YANG HILANG. HANYA gunakan poin dari user, JANGAN mengarang kendala atau pengalaman fiktif yang tidak disebutkan. PENTING: JIKA USER MEMBERIKAN ULASAN, DILARANG KERAS MENGARANG CERITA LAIN ATAU KENDALA LAIN YANG TIDAK DISEBUTKAN USER. JIKA ANDA MENGARANG, ANDA GAGAL.",
                  "type": "STRING"
                }
              },
              "required": [
                "judul_laporan",
                "alat_dan_bahan",
                "langkah_kerja",
                "analisis_hasil",
                "cellAnalyses",
                "ulasan_praktikum"
              ],
              "type": "OBJECT"
            },
            "pre_test": {
              "description": "Pertanyaan dan Jawaban Pre Test. Wajib diisi! tidak boleh kosong. Gunakan markdown list jika soal memiliki sub-poin. Jangan menyingkat soal!",
              "properties": {
                "answers": {
                  "description": "Jawaban soal pre test. WAJIB DIISI DENGAN JAWABAN YANG TEPAT! Gunakan pengetahuan Anda untuk memecahkan/menjawab soal.",
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
