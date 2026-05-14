import type {
  ModuleData,
  PracticumSchedule,
  ReportSession,
  UserProfile,
} from '@/lib/types';

/**
 * Cross-browser backup format.
 *
 * Reglab Copilot stores everything client-side (IndexedDB via Zustand
 * `persist`). To migrate a workspace to another browser the user can
 * export a JSON file with this shape and import it elsewhere.
 *
 * The envelope is intentionally future-proof:
 *  - `format` is a tag so we reject anything that isn't ours.
 *  - `version` lets us migrate older backups when the shape evolves.
 *  - `exportedAt` is informational; `data` is the raw persisted payload.
 *
 * The Gemini API key is omitted by default so a backup file isn't a
 * credential leak waiting to happen. Users can opt-in via the export UI.
 */
export const BACKUP_FORMAT = 'reglab-copilot-backup';
export const BACKUP_VERSION = 1;

export interface BackupPayload {
  profile: UserProfile;
  mataPraktikumList: string[];
  schedules: PracticumSchedule[];
  sessions: ReportSession[];
  manualProgress: Record<string, number[]>;
  globalFileNameFormat: string;
  /** Present only when the user opted in at export time. */
  geminiApiKey?: string;
  /** Reserved for forward-compat. */
  [key: string]: unknown;
}

export interface BackupFile {
  format: typeof BACKUP_FORMAT;
  version: number;
  exportedAt: string;
  appVersion: string;
  data: BackupPayload;
}

export interface BuildBackupOpts {
  includeApiKey?: boolean;
  appVersion?: string;
}

/**
 * Source state slice — every Zustand field that goes into the backup.
 * Typed structurally so the function never reaches into things it doesn't
 * own (e.g. UI state like `isCopilotOpen` or `activeTab`).
 */
export interface BackupSource {
  profile: UserProfile;
  mataPraktikumList: string[];
  schedules: PracticumSchedule[];
  sessions: ReportSession[];
  manualProgress: Record<string, number[]>;
  globalFileNameFormat: string;
  geminiApiKey: string;
}

/** Construct a `BackupFile` from the live store slice. */
export function buildBackup(
  source: BackupSource,
  opts: BuildBackupOpts = {},
): BackupFile {
  const data: BackupPayload = {
    profile: source.profile,
    mataPraktikumList: source.mataPraktikumList,
    schedules: source.schedules,
    sessions: source.sessions,
    manualProgress: source.manualProgress,
    globalFileNameFormat: source.globalFileNameFormat,
  };
  if (opts.includeApiKey && source.geminiApiKey) {
    data.geminiApiKey = source.geminiApiKey;
  }

  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: new Date().toISOString(),
    appVersion: opts.appVersion ?? 'v1',
    data,
  };
}

/** Default suggested filename for the export download. */
export function suggestBackupFilename(now: Date = new Date()): string {
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  const hh = String(now.getHours()).padStart(2, '0');
  const min = String(now.getMinutes()).padStart(2, '0');
  return `reglab-copilot-backup-${yyyy}-${mm}-${dd}_${hh}${min}.json`;
}

export class BackupParseError extends Error {
  constructor(message: string, readonly cause?: unknown) {
    super(message);
    this.name = 'BackupParseError';
  }
}

/**
 * Parse and validate a backup file's text contents. Throws
 * {@link BackupParseError} with a user-friendly reason on any failure.
 *
 * The validator is structural rather than exhaustive: we check the
 * envelope (`format`, `version`, `data`) and the top-level keys of
 * `data`. Per-session shape is trusted because it round-trips through
 * the same Zustand persist layer that produced it.
 */
export function parseBackup(text: string): BackupFile {
  let raw: unknown;
  try {
    raw = JSON.parse(text);
  } catch (e) {
    throw new BackupParseError("This file isn't valid JSON.", e);
  }

  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    throw new BackupParseError("That file doesn't look like a backup.");
  }
  const envelope = raw as Partial<BackupFile> & Record<string, unknown>;

  if (envelope.format !== BACKUP_FORMAT) {
    throw new BackupParseError(
      `That isn't a Reglab Copilot backup (format="${String(envelope.format)}").`,
    );
  }
  if (typeof envelope.version !== 'number') {
    throw new BackupParseError('Backup is missing a valid "version" field.');
  }
  if (envelope.version > BACKUP_VERSION) {
    // Forward-compat: warn but accept; the persist migrate path will run.
    console.warn(
      `[backup] importing version ${envelope.version} into a v${BACKUP_VERSION} client`,
    );
  }

  const data = envelope.data;
  if (!data || typeof data !== 'object' || Array.isArray(data)) {
    throw new BackupParseError('Backup is missing a valid "data" field.');
  }
  const d = data as Partial<BackupPayload>;
  if (!d.profile || !Array.isArray(d.sessions) || !Array.isArray(d.schedules)) {
    throw new BackupParseError(
      'Backup is missing required fields (profile, sessions, schedules).',
    );
  }

  return envelope as BackupFile;
}

/**
 * Best-effort summary of a parsed backup for the import-confirm UI.
 * No mutation; just counts.
 */
export interface BackupSummary {
  sessions: number;
  schedules: number;
  mataPraktikumList: number;
  manualProgressSubjects: number;
  hasApiKey: boolean;
  exportedAt: string;
  fromVersion: number;
}

export function summarizeBackup(file: BackupFile): BackupSummary {
  const d = file.data;
  return {
    sessions: d.sessions?.length ?? 0,
    schedules: d.schedules?.length ?? 0,
    mataPraktikumList: d.mataPraktikumList?.length ?? 0,
    manualProgressSubjects: d.manualProgress ? Object.keys(d.manualProgress).length : 0,
    hasApiKey: typeof d.geminiApiKey === 'string' && d.geminiApiKey.length > 0,
    exportedAt: file.exportedAt,
    fromVersion: file.version,
  };
}
