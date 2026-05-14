import { describe, it, expect } from 'vitest';
import {
  BACKUP_FORMAT,
  BACKUP_VERSION,
  BackupParseError,
  buildBackup,
  parseBackup,
  summarizeBackup,
  suggestBackupFilename,
  type BackupSource,
} from '@/lib/backup';

const baseSource: BackupSource = {
  profile: { nama: 'Aria', nim: '2200000001' },
  mataPraktikumList: ['Pemrograman', 'Basis Data'],
  schedules: [
    {
      id: 'sch-1',
      mataPraktikum: 'Pemrograman',
      laboratorium: 'Lab 3',
      dosen: 'Dr. X',
      hari: 'Senin',
      jamMulai: '08:00',
      jamSelesai: '10:00',
    },
  ],
  sessions: [
    {
      id: 'sess-1',
      title: 'Session 1',
      createdAt: 1700000000000,
      updatedAt: 1700000001000,
      metadata: {
        reportType: 'praktikum',
        mataPraktikum: 'Pemrograman',
        judulPertemuan: 'Pengenalan',
        hariTanggalSesi: 'Senin, 1 Januari 2024, 08:00 - 10:00',
      },
      preTest: 'Pre',
      modulContext: 'Mod',
      postTest: 'Post',
    },
  ],
  manualProgress: { Pemrograman: [1, 3] },
  globalFileNameFormat: '{nim}_{nama}',
  geminiApiKey: 'AIzaSyTEST',
};

describe('buildBackup', () => {
  it('produces a versioned envelope with the canonical format tag', () => {
    const file = buildBackup(baseSource);
    expect(file.format).toBe(BACKUP_FORMAT);
    expect(file.version).toBe(BACKUP_VERSION);
    expect(typeof file.exportedAt).toBe('string');
    expect(file.appVersion).toBe('v1');
  });

  it('omits the API key by default', () => {
    const file = buildBackup(baseSource);
    expect(file.data.geminiApiKey).toBeUndefined();
  });

  it('includes the API key only when explicitly opted in', () => {
    const file = buildBackup(baseSource, { includeApiKey: true });
    expect(file.data.geminiApiKey).toBe('AIzaSyTEST');
  });

  it('does not include an empty API key even when opted in', () => {
    const file = buildBackup({ ...baseSource, geminiApiKey: '' }, { includeApiKey: true });
    expect(file.data.geminiApiKey).toBeUndefined();
  });

  it('preserves the source slice byte-for-byte (round-trip via JSON)', () => {
    const file = buildBackup(baseSource, { includeApiKey: true });
    const parsed = parseBackup(JSON.stringify(file));
    expect(parsed.data.profile).toEqual(baseSource.profile);
    expect(parsed.data.sessions).toEqual(baseSource.sessions);
    expect(parsed.data.schedules).toEqual(baseSource.schedules);
    expect(parsed.data.mataPraktikumList).toEqual(baseSource.mataPraktikumList);
    expect(parsed.data.manualProgress).toEqual(baseSource.manualProgress);
    expect(parsed.data.globalFileNameFormat).toEqual(baseSource.globalFileNameFormat);
    expect(parsed.data.geminiApiKey).toEqual(baseSource.geminiApiKey);
  });
});

describe('parseBackup error paths', () => {
  it('rejects malformed JSON', () => {
    expect(() => parseBackup('this is not json')).toThrow(BackupParseError);
  });

  it('rejects a JSON value that is not an object', () => {
    expect(() => parseBackup('[1,2,3]')).toThrow(BackupParseError);
    expect(() => parseBackup('"hello"')).toThrow(BackupParseError);
  });

  it('rejects an envelope from an unrelated app', () => {
    const fake = JSON.stringify({ format: 'someone-elses-app', version: 1, data: {} });
    expect(() => parseBackup(fake)).toThrow(/Reglab Copilot backup/);
  });

  it('rejects an envelope without a numeric version', () => {
    const fake = JSON.stringify({ format: BACKUP_FORMAT, version: 'one', data: {} });
    expect(() => parseBackup(fake)).toThrow(/version/);
  });

  it('rejects an envelope without a data object', () => {
    const fake = JSON.stringify({ format: BACKUP_FORMAT, version: 1, data: 'oops' });
    expect(() => parseBackup(fake)).toThrow(/"data"/);
  });

  it('rejects a payload missing required arrays', () => {
    const fake = JSON.stringify({
      format: BACKUP_FORMAT,
      version: 1,
      data: { profile: { nama: 'x', nim: 'y' } },
    });
    expect(() => parseBackup(fake)).toThrow(/sessions/);
  });

  it('accepts a future-version envelope with a console warning', () => {
    const fake: unknown = {
      format: BACKUP_FORMAT,
      version: BACKUP_VERSION + 99,
      exportedAt: 'now',
      data: {
        profile: { nama: '', nim: '' },
        mataPraktikumList: [],
        schedules: [],
        sessions: [],
        manualProgress: {},
        globalFileNameFormat: '',
      },
    };
    expect(() => parseBackup(JSON.stringify(fake))).not.toThrow();
  });
});

describe('summarizeBackup', () => {
  it('counts entries and reports api-key presence', () => {
    const withKey = buildBackup(baseSource, { includeApiKey: true });
    const summary = summarizeBackup(withKey);
    expect(summary.sessions).toBe(1);
    expect(summary.schedules).toBe(1);
    expect(summary.mataPraktikumList).toBe(2);
    expect(summary.manualProgressSubjects).toBe(1);
    expect(summary.hasApiKey).toBe(true);
    expect(summary.fromVersion).toBe(BACKUP_VERSION);
  });

  it('reports hasApiKey=false for a backup without the key', () => {
    const without = buildBackup(baseSource);
    expect(summarizeBackup(without).hasApiKey).toBe(false);
  });
});

describe('suggestBackupFilename', () => {
  it('formats a deterministic, kebab-case name', () => {
    const name = suggestBackupFilename(new Date(2024, 2, 7, 9, 5, 0));
    expect(name).toBe('reglab-copilot-backup-2024-03-07_0905.json');
  });
});
