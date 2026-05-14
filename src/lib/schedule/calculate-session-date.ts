import type { PracticumSchedule } from '@/lib/types';
import {
  HARI_MAP,
  dayNames,
  monthNames,
  parseIndonesianDate,
} from './indonesian-date';

/**
 * Compute the formatted "hariTanggalSesi" string for the Nth practicum
 * meeting of a recurring schedule.
 *
 * The algorithm walks forward from a fixed semester start anchor
 * (`2026-04-13`), advancing one weekday at a time and only counting days
 * that match the schedule's `hari` (which may list multiple days as
 * "Senin, Rabu" or "Senin & Rabu"). Custom dates from
 * `schedule.customDates[k]` re-anchor the walk for any meeting `k`.
 *
 * Returns the schedule's `customDates[pertemuanNum]` directly if present.
 * Returns `fallback` when `schedule` is missing.
 */
export function calculateSessionDate(
  pertemuanNum: number,
  schedule: PracticumSchedule | null | undefined,
  fallback: string,
): string {
  if (!schedule) return fallback;
  if (schedule.customDates && schedule.customDates[pertemuanNum]) {
    return schedule.customDates[pertemuanNum];
  }

  let currentDate = new Date('2026-04-13T00:00:00');

  const targetHaris = (schedule.hari || '')
    .toLowerCase()
    .split(/[,&/]|dan/)
    .map((s) => HARI_MAP[s.trim()])
    .filter((h): h is number => h !== undefined);
  if (targetHaris.length === 0) targetHaris.push(1);

  const advanceToNextTargetDay = (date: Date) => {
    date.setDate(date.getDate() + 1);
    while (!targetHaris.includes(date.getDay())) date.setDate(date.getDate() + 1);
  };

  while (!targetHaris.includes(currentDate.getDay())) {
    currentDate.setDate(currentDate.getDate() + 1);
  }

  for (let i = 1; i < pertemuanNum; i++) {
    if (schedule.customDates && schedule.customDates[i]) {
      const parsed = parseIndonesianDate(schedule.customDates[i]);
      if (parsed) currentDate = parsed;
    }
    advanceToNextTargetDay(currentDate);
  }

  return `${dayNames[currentDate.getDay()]}, ${currentDate.getDate()} ${monthNames[currentDate.getMonth()]} ${currentDate.getFullYear()}, ${schedule.jamMulai || '00:00'} - ${schedule.jamSelesai || '00:00'}`;
}
