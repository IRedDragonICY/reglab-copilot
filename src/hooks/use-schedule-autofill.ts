import { useCallback } from 'react';
import { toast } from 'sonner';
import { useAppStore } from '@/lib/store';
import type {
  PracticumSchedule,
  ReportMetadata,
  ReportSession,
} from '@/lib/types';
import { calculateSessionDate } from '@/lib/schedule/calculate-session-date';

export interface ScheduleAutofillArgs {
  metadata: ReportMetadata;
  setMetadata: (m: ReportMetadata) => void;
  modulContext: string;
  setModulContext: (s: string) => void;
  setPreTest: (s: string) => void;
  setPostTest: (s: string) => void;
  session: ReportSession | null | undefined;
}

export interface ScheduleAutofillHandlers {
  onMataPraktikumChange: (v: string | null) => void;
  onPertemuanChange: (p: number) => void;
  onSaveCustomDate: () => void;
}

/**
 * Bundles the three "selecting a schedule / changing pertemuan auto-fills
 * metadata + modulContext + pre/post-test" callbacks that used to live
 * directly inside `session-tab.tsx`. Reads `store.schedules` and
 * `store.setSchedules` from Zustand; everything else is injected.
 *
 * The handler bodies are deliberately preserved verbatim — same toasts,
 * same in-place mutation of `session.preTest`/`session.postTest`,
 * same fallthrough behavior. The only structural change is that
 * `calculateSessionDate` and the embedded date parser now live in
 * `@/lib/schedule/*`.
 */
export function useScheduleAutofill(args: ScheduleAutofillArgs): ScheduleAutofillHandlers {
  const { metadata, setMetadata, modulContext, setModulContext, setPreTest, setPostTest, session } = args;
  const schedules = useAppStore((s) => s.schedules);
  const setSchedules = useAppStore((s) => s.setSchedules);

  const applyModuleData = (
    schedule: PracticumSchedule,
    p: number,
    currentJudul: string,
    currentModulContext: string,
  ): { newJudul: string; newModulContext: string; toasted: boolean } => {
    const modData = schedule.moduleData?.[p];
    if (!modData) {
      return { newJudul: currentJudul, newModulContext: currentModulContext, toasted: false };
    }

    const newJudul = modData.judul || currentJudul;
    const compiledContext = modData.config?.includeLangkah !== false ? modData.langkah || '' : '';
    const newModulContext = compiledContext || currentModulContext;

    if (modData.config?.includePreTest && modData.pre_test) {
      setPreTest(modData.pre_test);
      if (session) (session as ReportSession).preTest = modData.pre_test;
    }
    if (modData.config?.includePostTest && modData.post_test) {
      setPostTest(modData.post_test);
      if (session) (session as ReportSession).postTest = modData.post_test;
    }

    toast.success(`Data modul pertemuan ${p} otomatis terisi!`);
    return { newJudul, newModulContext, toasted: true };
  };

  const onMataPraktikumChange = useCallback(
    (v: string | null) => {
      if (!v) return;
      if (v.startsWith('sch:')) {
        const id = v.replace('sch:', '');
        const schedule = schedules.find((s) => s.id === id);
        if (schedule) {
          const p = metadata.pertemuan || 1;
          const { newJudul, newModulContext } = applyModuleData(
            schedule,
            p,
            metadata.judulPertemuan,
            modulContext,
          );

          setMetadata({
            ...metadata,
            mataPraktikum: schedule.mataPraktikum,
            hariTanggalSesi: calculateSessionDate(p, schedule, metadata.hariTanggalSesi),
            laboratorium: schedule.laboratorium,
            dosen: schedule.dosen,
            judulPertemuan: newJudul,
          });
          setModulContext(newModulContext);
          toast.success(`Jadwal "${schedule.mataPraktikum}" terpilih! Sesi diatur otomatis.`);
          return;
        }
      }
      setMetadata({ ...metadata, mataPraktikum: v || '' });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadata, modulContext, schedules, session],
  );

  const onPertemuanChange = useCallback(
    (p: number) => {
      const schedule = schedules.find((s) => s.mataPraktikum === metadata.mataPraktikum);
      if (schedule) {
        const { newJudul, newModulContext } = applyModuleData(
          schedule,
          p,
          metadata.judulPertemuan,
          modulContext,
        );

        setMetadata({
          ...metadata,
          pertemuan: p,
          hariTanggalSesi: calculateSessionDate(p, schedule, metadata.hariTanggalSesi),
          judulPertemuan: newJudul,
        });
        setModulContext(newModulContext);
      } else {
        setMetadata({ ...metadata, pertemuan: p });
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [metadata, modulContext, schedules, session],
  );

  const onSaveCustomDate = useCallback(() => {
    const schedule = schedules.find((s) => s.mataPraktikum === metadata.mataPraktikum);
    if (schedule && metadata.pertemuan && metadata.hariTanggalSesi) {
      const p = metadata.pertemuan;
      setSchedules(
        schedules.map((s) =>
          s.id === schedule.id
            ? {
                ...schedule,
                customDates: { ...(schedule.customDates || {}), [p]: metadata.hariTanggalSesi },
              }
            : s,
        ),
      );
      toast.success(`Jadwal tersimpan permanen untuk Pertemuan ${p}!`);
    } else {
      toast.info('Pilih jadwal praktikum resmi untuk menyimpan jadwal custom.');
    }
  }, [metadata, schedules, setSchedules]);

  return { onMataPraktikumChange, onPertemuanChange, onSaveCustomDate };
}
