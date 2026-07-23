import * as cheerio from 'cheerio';

export interface SimeruSchedule {
  mataPraktikum: string;
  kode: string;
  kelas: string;
  hari: string;
  jamMulai: string;
  jamSelesai: string;
  laboratorium: string;
  dosen: string;
  type: 'kuliah';
}

export function parseSimeruHtml(html: string, targetCourses: {kode: string, kelas: string}[]): SimeruSchedule[] {
  const $ = cheerio.load(html);
  const matchedSchedules: SimeruSchedule[] = [];
  let currentDay = '';

  $('table.table-list tr').each((i, el) => {
    if ($(el).find('th').length > 0) return;
    
    const tds = $(el).find('td');
    if (tds.length < 8) return;

    const firstCell = $(tds[0]).text().trim();
    if ($(tds[0]).attr('rowspan') !== undefined) {
      if (firstCell && firstCell.length > 2) {
        currentDay = firstCell;
      }
    }

    let offset = ($(tds[0]).attr('rowspan') !== undefined && firstCell.length > 2) ? 1 : 0;
    if ($(tds[0]).attr('rowspan') !== undefined && firstCell === '') offset = 1;

    const kode = $(tds[offset]).text().trim();
    const mataKuliah = $(tds[offset + 1]).text().trim();
    const kelas = $(tds[offset + 2]).text().trim();
    const sks = $(tds[offset + 3]).text().trim();
    const jam = $(tds[offset + 4]).text().trim();
    const semester = $(tds[offset + 5]).text().trim();
    const dosen = $(tds[offset + 6]).text().trim();
    const ruang = $(tds[offset + 7]).text().trim();

    const isMatch = targetCourses.some(tc => tc.kode === kode && tc.kelas === kelas);
    if (isMatch) {
      matchedSchedules.push({
        mataPraktikum: mataKuliah,
        kode: kode,
        kelas: kelas,
        hari: currentDay || 'Senin',
        jamMulai: jam,
        jamSelesai: jam,
        laboratorium: ruang,
        dosen: dosen,
        type: 'kuliah'
      });
    }
  });

  return matchedSchedules;
}
