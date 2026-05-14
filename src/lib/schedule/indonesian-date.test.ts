import { describe, it, expect } from 'vitest';
import { parseIndonesianDate } from '@/lib/schedule/indonesian-date';

describe('parseIndonesianDate', () => {
  it('parses each of the twelve months', () => {
    const months = [
      ['Januari', 0],
      ['Februari', 1],
      ['Maret', 2],
      ['April', 3],
      ['Mei', 4],
      ['Juni', 5],
      ['Juli', 6],
      ['Agustus', 7],
      ['September', 8],
      ['Oktober', 9],
      ['November', 10],
      ['Desember', 11],
    ] as const;
    for (const [name, idx] of months) {
      const d = parseIndonesianDate(`15 ${name} 2025`);
      expect(d).not.toBeNull();
      expect(d!.getDate()).toBe(15);
      expect(d!.getMonth()).toBe(idx);
      expect(d!.getFullYear()).toBe(2025);
    }
  });

  it('is case-insensitive on the month', () => {
    expect(parseIndonesianDate('1 januari 2024')!.getMonth()).toBe(0);
    expect(parseIndonesianDate('1 JANUARI 2024')!.getMonth()).toBe(0);
    expect(parseIndonesianDate('1 Januari 2024')!.getMonth()).toBe(0);
  });

  it('rejects malformed inputs', () => {
    expect(parseIndonesianDate('')).toBeNull();
    expect(parseIndonesianDate('not a date')).toBeNull();
    expect(parseIndonesianDate('15 Smarch 2024')).toBeNull();
    expect(parseIndonesianDate('15 2024 Maret')).toBeNull();
  });

  it('tolerates extra whitespace and trailing text', () => {
    const d = parseIndonesianDate('  3   Maret   2026, 09:00 - 11:00');
    expect(d).not.toBeNull();
    expect(d!.getDate()).toBe(3);
    expect(d!.getMonth()).toBe(2);
    expect(d!.getFullYear()).toBe(2026);
  });
});
