// @vitest-environment jsdom
/**
 * Tests for the persisted-state migrator and the read-time
 * `hydrateSession` defense-in-depth helper.
 *
 * Scope: pure functions only. The full Zustand-persist round trip
 * (including `replaceFromBackup` writing the IDB record) is covered by
 * the Phase A integration smoke in task 7.1; instantiating Zustand here
 * would be heavy ceremony for low-value coverage.
 *
 * Validates: Requirements 9.1, 9.3 (persist migration), 1.5 (welcome
 * seeding without persisted-record mutation).
 */

import { describe, it, expect, vi } from 'vitest';

// Mock idb-keyval so the Zustand persist middleware's async writes
// triggered by `setCopilotSettings` resolve cleanly under the Node test
// env (no `indexedDB` global). The migrator tests below operate on
// plain objects and don't touch idb at all, but importing `useAppStore`
// instantiates the persist middleware once on module load.
vi.mock('idb-keyval', () => ({
  get: vi.fn(async () => undefined),
  set: vi.fn(async () => undefined),
  del: vi.fn(async () => undefined),
  clear: vi.fn(async () => undefined),
}));

import {
  migratePersistedState,
  hydrateSession,
  WELCOME_MESSAGE,
  useAppStore,
} from './store';
import { DEFAULT_COPILOT_SETTINGS } from '@/lib/copilot/types';
import type { ReportSession, CopilotMessage } from '@/lib/types';

describe('migratePersistedState', () => {
  it('migrates a v0 persisted record to v2: strips legacy default mata praktikum and seeds Copilot defaults', () => {
    const v0 = {
      state: {
        mataPraktikumList: ['Pemrograman Berorientasi Objek', 'CustomMK'],
        sessions: [],
      },
      version: 0,
    };

    const migrated = migratePersistedState(v0.state, v0.version);

    // Existing v0 cleanup: legacy default removed, custom entry preserved.
    expect(migrated.mataPraktikumList).toEqual(['CustomMK']);
    // v1 → v2 seed: copilotSettings defaulted, sessions left untouched (empty).
    expect(migrated.copilotSettings).toEqual(DEFAULT_COPILOT_SETTINGS);
    expect(migrated.sessions).toEqual([]);
    // Cloned, not the same reference — migrator must be free to mutate.
    expect(migrated.copilotSettings).not.toBe(DEFAULT_COPILOT_SETTINGS);
  });

  it('migrates a v1 persisted record to v2: seeds the eight new fields per session and the top-level copilotSettings', () => {
    const legacySession = {
      id: 'sess-1',
      title: 'Legacy Report',
      createdAt: 1,
      updatedAt: 2,
      metadata: {
        reportType: 'praktikum' as const,
        mataPraktikum: 'MK',
        judulPertemuan: 'P1',
        hariTanggalSesi: '',
        laboratorium: '',
        dosen: '',
      },
      preTest: '',
      modulContext: '',
      postTest: '',
    };

    const v1 = {
      state: {
        mataPraktikumList: ['CustomMK'],
        sessions: [legacySession],
      },
      version: 1,
    };

    const migrated = migratePersistedState(v1.state, v1.version);

    // mataPraktikumList untouched on v1 → v2 (the v0 cleanup never runs).
    expect(migrated.mataPraktikumList).toEqual(['CustomMK']);
    // Top-level Copilot slice seeded.
    expect(migrated.copilotSettings).toEqual(DEFAULT_COPILOT_SETTINGS);

    expect(migrated.sessions).toHaveLength(1);
    const s = migrated.sessions[0];

    // Existing fields preserved.
    expect(s.id).toBe('sess-1');
    expect(s.title).toBe('Legacy Report');

    // All eight new fields seeded with their documented defaults.
    expect(s.chatHistory).toEqual([]);
    expect(s.checkpoints).toEqual([]);
    expect(s.loopCursor).toBeNull();
    expect(s.runState).toBe('idle');
    expect(s.pendingMerge).toBeNull();
    expect(s.taskPlan).toBeNull();
    expect(s.pendingUserSteer).toBeNull();
    expect(s.pendingClarification).toBeNull();
  });
});

describe('hydrateSession', () => {
  // Minimal valid ReportSession — only the required fields, plus optional
  // ones explicitly set per case below.
  const baseSession = (
    overrides: Partial<ReportSession> = {},
  ): ReportSession => ({
    id: 'sess-1',
    title: 'Test',
    createdAt: 1,
    updatedAt: 2,
    metadata: {
      reportType: 'praktikum',
      mataPraktikum: '',
      judulPertemuan: '',
      hariTanggalSesi: '',
    },
    preTest: '',
    modulContext: '',
    postTest: '',
    ...overrides,
  });

  it('seeds [WELCOME_MESSAGE] when chatHistory is missing', () => {
    const input = baseSession();
    const out = hydrateSession(input);

    expect(out.chatHistory).toEqual([WELCOME_MESSAGE]);
    // Defense-in-depth: defaults applied for the rest too.
    expect(out.checkpoints).toEqual([]);
    expect(out.loopCursor).toBeNull();
    expect(out.runState).toBe('idle');
    expect(out.pendingMerge).toBeNull();
    expect(out.taskPlan).toBeNull();
    expect(out.pendingUserSteer).toBeNull();
    expect(out.pendingClarification).toBeNull();

    // Pure: input untouched.
    expect(input.chatHistory).toBeUndefined();
    expect(out).not.toBe(input);
  });

  it('seeds [WELCOME_MESSAGE] when chatHistory is empty (Req 1.5 — empty == missing)', () => {
    const input = baseSession({ chatHistory: [] });
    const out = hydrateSession(input);

    expect(out.chatHistory).toEqual([WELCOME_MESSAGE]);
    // Input array reference unchanged.
    expect(input.chatHistory).toEqual([]);
  });

  it('preserves a non-empty chatHistory deep-equal to the input', () => {
    const existing: CopilotMessage[] = [
      { role: 'user', text: 'Hello' },
      { role: 'agent', text: 'Hi there' },
    ];
    const input = baseSession({ chatHistory: existing });
    const out = hydrateSession(input);

    expect(out.chatHistory).toEqual(existing);
  });
});

describe('setCopilotSettings', () => {
  it('clamps maxIterations to [1, 30] and merges other fields without clamping', () => {
    // Drive the live store rather than instantiating a fresh one — the
    // setter logic is the same and we can leave the slice as we found
    // it at the end (defaults) so this test composes with any others
    // that touch `useAppStore`.
    const { setCopilotSettings, copilotSettings: initial } = useAppStore.getState();
    expect(initial).toEqual(DEFAULT_COPILOT_SETTINGS);

    setCopilotSettings({ maxIterations: 99 });
    expect(useAppStore.getState().copilotSettings.maxIterations).toBe(30);

    setCopilotSettings({ maxIterations: 0 });
    expect(useAppStore.getState().copilotSettings.maxIterations).toBe(1);

    // A patch that doesn't include maxIterations must not re-clamp or
    // mutate other fields.
    setCopilotSettings({ autoAccept: false });
    expect(useAppStore.getState().copilotSettings.autoAccept).toBe(false);
    expect(useAppStore.getState().copilotSettings.maxIterations).toBe(1);

    // Reset for any subsequent tests in this file (or a watch-mode
    // re-run) that assume defaults.
    setCopilotSettings(DEFAULT_COPILOT_SETTINGS);
    expect(useAppStore.getState().copilotSettings).toEqual(DEFAULT_COPILOT_SETTINGS);
  });
});
