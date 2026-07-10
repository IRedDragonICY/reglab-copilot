const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const oldRule4 = `        4. KURANGI KOSAKATA TERLALU BAKU/PUITIS/ROBOTIK:
           Hindari kata-kata transisi atau kesimpulan yang terlalu kaku, berlebihan, dan sering diulang oleh AI.
           - HINDARI KATA: "signifikan", "komprehensif", "krusial", "memainkan peran penting", "secara drastis", "memberikan wawasan mendalam", "mengonfirmasi ketangguhan".
           - GUNAKAN KATA YANG LEBIH MEMBUMI/NATURAL: "penting", "menyeluruh", "sangat menurun", "memberikan pemahaman baru", "menunjukkan model bekerja dengan baik".
           Tone (nada bicara) harus rileks namun tetap akademis layaknya mahasiswa praktikan.`;

const newRules = `        4. GAYA BAHASA SEMI-FORMAL (TIDAK BIPOLAR):
           Jangan terlalu kaku akademis di satu sisi, tapi JANGAN menggunakan bahasa gaul (slang) tongkrongan di sisi lain.
           - DILARANG pakai kata: "pas", "ngecek", "jelek", "basa-basi", "ngasih gambaran", "ngitung seberapa capek".
           - GUNAKAN: "ketika", "mengukur/memeriksa", "semakin buruk / menurun performanya", "memberikan gambaran", "menghitung perbaikan manual".
           Tone harus Semi-Formal Laporan Praktikum yang natural, bukan gaya AI kaku, dan bukan gaya chat santai.

        5. STRUKTUR PARAGRAF NATURAL (HINDARI POLA ROBOTIK):
           - Kurangi ketergantungan pada bullet-points bertingkat (nested lists) yang terlalu rapi. 
           - Rangkai analisis ke dalam 2-3 paragraf naratif yang mengalir seperti tulisan manusia.
           - HINDARI template pembuka AI seperti: "Proses implementasi praktikum X dilakukan melalui langkah-langkah sistematis berikut:"
           - Variasikan awal kalimat. Jangan selalu "Fungsi X digunakan untuk...". Gunakan variasi pasif santai seperti: "Pada langkah ini, kita melakukan import...", "Selanjutnya, dataset dibagi menjadi...", atau "Model kemudian dijalankan...".

        6. ANALOGI TEKNIS YANG MEMBUMI:
           JANGAN menggunakan analogi metaforis atau terkesan dibuat-buat agar santai. 
           (Contoh dilarang: "TER menghitung seberapa capek manusia", "kata basa-basi").
           Gunakan penjelasan teknis nyata: "TER menghitung seberapa banyak perbaikan manual yang diperlukan terhadap hasil mesin agar sama dengan referensi."

        7. TAMBAHKAN PENGALAMAN TEKNIS PRAKTIKAL (JIKA ADA):
           Di bagian Analisis Hasil / Ulasan Praktikum, selipkan opini pengalaman teknis/kendala praktikal yang natural dialami mahasiswa (misal: lamanya proses training, perlunya menyesuaikan batch size karena memori GPU/Colab, dsb) jika relevan, agar tidak hanya berisi evaluasi teori metrik saja.`;

code = code.replace(oldRule4, newRules);
fs.writeFileSync('src/lib/ai/prompts.ts', code);
console.log("Patched prompts.ts with new language rules");
