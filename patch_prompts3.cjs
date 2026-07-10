const fs = require('fs');
let code = fs.readFileSync('src/lib/ai/prompts.ts', 'utf8');

const oldContextRule = `PENTING UNTUK ULASAN PRAKTIKUM: Jika Raw Input dari User di atas TIDAK KOSONG ("-"), Anda WAJIB MENGGUNAKAN DAN MENGEMBANGKAN KATA/IDE dari user tersebut secara detail! Jangan menggantinya dengan ulasan generik. Jika user menyebut "kendala dataset ikan", Anda wajib memasukkannya. Jika user memberikan saran, Anda wajib menuliskannya di field \\\`ulasan_praktikum\\\`. HANYA gunakan poin dari user, JANGAN mengarang cerita fiktif atau kendala yang tidak disebutkan (seperti error pie chart) jika user tidak menyebutkannya.`;

const newContextRule = `PENTING UNTUK ULASAN PRAKTIKUM: Jika Raw Input dari User di atas TIDAK KOSONG ("-"), Anda WAJIB MENGGUNAKAN DAN MENGEMBANGKAN KATA/IDE dari user tersebut secara detail! Namun jika kosong ("-"), Anda WAJIB menerapkan aturan SUNTIKAN KENDALA SECARA PAKSA dengan mengarang satu kendala teknis logis yang biasa dialami mahasiswa saat mempraktikkan materi ini.`;

code = code.replace(oldContextRule, newContextRule);
fs.writeFileSync('src/lib/ai/prompts.ts', code);
console.log("Patched prompts.ts context rule");
