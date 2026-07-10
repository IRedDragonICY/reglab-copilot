const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const oldStructureRule = `        5. STRUKTUR PARAGRAF NATURAL (HINDARI POLA ROBOTIK):
           - Kurangi ketergantungan pada bullet-points bertingkat (nested lists) yang terlalu rapi. 
           - Rangkai analisis ke dalam 2-3 paragraf naratif yang mengalir seperti tulisan manusia.
           - HINDARI template pembuka AI seperti: "Proses implementasi praktikum X dilakukan melalui langkah-langkah sistematis berikut:"
           - Variasikan awal kalimat. Jangan selalu "Fungsi X digunakan untuk...". Gunakan variasi pasif santai seperti: "Pada langkah ini, kita melakukan import...", "Selanjutnya, dataset dibagi menjadi...", atau "Model kemudian dijalankan...".`;

const newStructureRule = `        5. STRUKTUR PARAGRAF NATURAL (HINDARI POLA ROBOTIK):
           - DILARANG KERAS MENGGUNAKAN LISTING/BULLETS PADA LANGKAH KERJA: Untuk bagian Langkah Kerja dan Analisis, WAJIB ditulis dalam bentuk PARAGRAF NARATIF (cerita proses) yang terdiri dari 2-4 paragraf. DILARANG KERAS menggunakan format bullet points (1, 2, 3) atau list.
           - BLACKLIST KATA PEMBUKA: DILARANG KERAS menggunakan kalimat "Proses pengerjaan praktikum dilakukan melalui tahapan sistematis berikut" atau variasi kalimat pengantar list lainnya. Langsung masuk ke paragraf pertama (Contoh awal: "Pada praktikum kali ini, langkah pertama yang dilakukan adalah...").
           - BLACKLIST KATA MEGAH: DILARANG menggunakan kata-kata: ketangguhan, ketiadaan, mengonfirmasi, meregulasi, komprehensif. Gunakan bahasa Indonesia sehari-hari yang sopan (semi-formal).
           - Variasikan awal kalimat. Jangan selalu "Fungsi X digunakan untuk...". Gunakan variasi pasif santai seperti: "Pada langkah ini, kita melakukan import...", "Selanjutnya, dataset dibagi menjadi...", atau "Model kemudian dijalankan...".`;

const oldExperienceRule = `        7. TAMBAHKAN PENGALAMAN TEKNIS PRAKTIKAL (JIKA ADA):
           Di bagian Analisis Hasil / Ulasan Praktikum, selipkan opini pengalaman teknis/kendala praktikal yang natural dialami mahasiswa (misal: lamanya proses training, perlunya menyesuaikan batch size karena memori GPU/Colab, dsb) jika relevan, agar tidak hanya berisi evaluasi teori metrik saja.`;

const newExperienceRule = `        7. TAMBAHKAN PENGALAMAN TEKNIS PRAKTIKAL:
           Di bagian Analisis Hasil, selipkan opini pengalaman teknis/kendala praktikal yang natural dialami mahasiswa.
           - SUNTIKAN KENDALA SECARA PAKSA PADA ULASAN PRAKTIKUM: Di bagian Ulasan Praktikum, JANGAN menulis 'praktikum berjalan sangat lancar tanpa kendala'. Anda WAJIB mengarang satu kendala wajar mahasiswa (contoh: bingung menyesuaikan dimensi reshape untuk input LSTM, error saat slicing data, proses training epoch yang lama/GPU limit di Colab, atau penyesuaian hyperparameter yang sulit) jika user tidak menyebutkannya. Jika user menyebutkan kendalanya sendiri, gunakan dan kembangkan kendala dari user tersebut.`;

code = code.replace(oldStructureRule, newStructureRule);
code = code.replace(oldExperienceRule, newExperienceRule);

fs.writeFileSync('src/lib/ai/prompts.ts', code);
console.log("Patched prompts.ts with extreme AI-Slop reduction rules");
