import { expect, test } from 'vitest';
import { parseSimeruHtml } from './simeru';
import * as fs from 'fs';
import * as path from 'path';

test('parseSimeruHtml correctly extracts targeted courses', () => {
  // Read the HTML fixture we captured
  const htmlPath = path.join(process.cwd(), 'simeru_result.html');
  if (!fs.existsSync(htmlPath)) {
    console.log('Skipping test as fixture not found');
    return;
  }
  const html = fs.readFileSync(htmlPath, 'utf8');

  // We know Deep Learning is Kode 211861131, Kelas B
  const targetCourses = [
    { kode: '211861131', kelas: 'B' },
    { kode: '211861131', kelas: 'C' }
  ];

  const result = parseSimeruHtml(html, targetCourses);

  expect(result).toHaveLength(2);
  
  // Find Kelas C
  const kelasC = result.find(r => r.kelas === 'C');
  expect(kelasC).toBeDefined();
  expect(kelasC?.mataPraktikum).toBe('Deep Learning');
  expect(kelasC?.dosen).toBe('Ir., Herman Yuliansyah, S.T., M.Eng., Ph.D.');
  expect(kelasC?.jamMulai).toBe('1,2');
  expect(kelasC?.laboratorium).toBe('4.1.4.51');

  // Find Kelas B
  const kelasB = result.find(r => r.kelas === 'B');
  expect(kelasB).toBeDefined();
  expect(kelasB?.mataPraktikum).toBe('Deep Learning');
  expect(kelasB?.dosen).toBe('Dr., Murinto, S.Si., M.Kom.');
  expect(kelasB?.jamMulai).toBe('5,6');
  expect(kelasB?.laboratorium).toBe('4.1.5.65');
});
