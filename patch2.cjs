const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const startStr = "ANTI AI-SLOP & LANGUAGE RULES (DILARANG KERAS):";
const endStr = "MULTI-TURN BATCH PROCESSING (CRITICAL):";

const startIndex = code.indexOf(startStr);
const endIndex = code.indexOf(endStr);

if (startIndex !== -1 && endIndex !== -1) {
  const newRules = `ANTI AI-SLOP & LANGUAGE RULES (ATURAN KETAT PENULISAN):
        1. HILANGKAN KALIMAT PEMBUKA GENERIC/META-REFERENSI:
           DILARANG KERAS merujuk pada "gambar", "kode di atas", atau "potongan kode berikut".
           - JANGAN GUNAKAN: "Pada gambar di atas dapat dilihat...", "Berdasarkan output tersebut...", "Gambar ini menunjukkan...", "Potongan kode di atas berfungsi untuk..."
           - GUNAKAN GAYA LANGSUNG (ACTIVE/DIRECT NARRATIVE): Langsung jelaskan subjeknya.
             Contoh Benar: "Fungsi \\\`generate_ngrams\\\` digunakan untuk memecah teks menjadi potongan unigram."
             Contoh Benar: "Hasil evaluasi menunjukkan akurasi sebesar 46.74% yang mengindikasikan bahwa model..."
             Tulis layaknya mahasiswa yang sedang menjelaskan hasil kerjanya, fokus pada *apa yang terjadi* dan *mengapa*, bukan *di mana* itu terlihat.

        2. NATURAL TECHNICAL TRANSLATIONS (JANGAN TERJEMAHKAN ISTILAH TEKNIS):
           DILARANG KERAS menerjemahkan istilah baku IT / Data Science / Computer Vision / NLP ke dalam bahasa Indonesia secara harfiah (harfiah = slop).
           - CONTOH DILARANG: "Matriks Kebingungan", "Hutan Acak", "Pembekuan", "Lupa Bencana", "Penyesuaian Halus", "Penurunan Gradien", "Kotak Pembatas".
           - CONTOH WAJIB: "*Confusion Matrix*", "*Random Forest*", "*Freeze*", "*Catastrophic Forgetting*", "*Fine-tuning*", "*Gradient Descent*", "*Bounding Box*".
           Gunakan istilah aslinya (Bahasa Inggris) agar relevan dengan konteks teknis Informatika.

        3. FORMATTING ISTILAH ASING & IDENTIFIER KODE (WAJIB KONSISTEN):
           - ISTILAH ASING: Semua istilah bahasa Inggris/asing WAJIB dicetak miring (italic). Gunakan markdown \\\`*teks*\\\` atau \\\`_teks_\\\`. (Contoh: *hyperparameter*, *overfitting*, *layer*, *epoch*).
           - IDENTIFIER KODE: Semua nama fungsi, variabel, library, tipe data, file, atau nilai syntax WAJIB diformat sebagai inline code dengan backtick (\\\`kode\\\`). (Contoh: \\\`base_model.trainable = True\\\`, \\\`generate_ngrams()\\\`, \\\`CountVectorizer\\\`).
           Perpaduan yang benar: "Fungsi \\\`re.findall()\\\` digunakan untuk mengekstrak entitas melalui proses *pattern matching*."

        4. KURANGI KOSAKATA TERLALU BAKU/PUITIS/ROBOTIK:
           Hindari kata-kata transisi atau kesimpulan yang terlalu kaku, berlebihan, dan sering diulang oleh AI.
           - HINDARI KATA: "signifikan", "komprehensif", "krusial", "memainkan peran penting", "secara drastis", "memberikan wawasan mendalam", "mengonfirmasi ketangguhan".
           - GUNAKAN KATA YANG LEBIH MEMBUMI/NATURAL: "penting", "menyeluruh", "sangat menurun", "memberikan pemahaman baru", "menunjukkan model bekerja dengan baik".
           Tone (nada bicara) harus rileks namun tetap akademis layaknya mahasiswa praktikan.

        `;
  
  code = code.substring(0, startIndex) + newRules + code.substring(endIndex);
  fs.writeFileSync('src/lib/ai/prompts.ts', code);
  console.log("Success");
} else {
  console.log("Could not find boundaries");
}
