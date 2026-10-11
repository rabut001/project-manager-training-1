import { CHOICES, type Choice } from "./types.ts";

export type AnswerRecord = { choice: Choice; confirmed: boolean };
export type Progress = { currentNo: number; answers: Record<number, AnswerRecord>; checked: number[] };
export function storageKey(id: string): string { return `pm-am2:v1:${id}`; }
export function emptyProgress(): Progress { return { currentNo: 1, answers: {}, checked: [] }; }

export function loadProgress(id: string, questionNos: ReadonlySet<number>): Progress {
  try {
    const raw = localStorage.getItem(storageKey(id));
    if (raw === null) return emptyProgress();
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return emptyProgress();
    const p = parsed as Record<string, unknown>;
    const answers: Record<number, AnswerRecord> = {};
    if (p.answers && typeof p.answers === "object" && !Array.isArray(p.answers)) {
      for (const [key, value] of Object.entries(p.answers)) {
        const no = Number(key);
        if (!questionNos.has(no) || !value || typeof value !== "object") continue;
        const a = value as Record<string, unknown>;
        if (CHOICES.includes(a.choice as Choice) && typeof a.confirmed === "boolean") {
          answers[no] = { choice: a.choice as Choice, confirmed: a.confirmed };
        }
      }
    }
    const checked = Array.isArray(p.checked)
      ? [...new Set(p.checked.filter((no): no is number => typeof no === "number" && questionNos.has(no)))].sort((a, b) => a - b)
      : [];
    return { currentNo: typeof p.currentNo === "number" && questionNos.has(p.currentNo) ? p.currentNo : 1, answers, checked };
  } catch { return emptyProgress(); }
}
export function saveProgress(id: string, progress: Progress): void {
  try { localStorage.setItem(storageKey(id), JSON.stringify(progress)); }
  catch { /* 保存できないブラウザでも、演習はメモリ上で続ける。通知は仕様外。 */ }
}
export function selectAnswer(p: Progress, no: number, choice: Choice): Progress {
  if (p.answers[no]?.confirmed) return p;
  return { ...p, currentNo: no, answers: { ...p.answers, [no]: { choice, confirmed: false } } };
}
export function confirmSelection(p: Progress, no: number): Progress {
  const a = p.answers[no];
  if (!a || a.confirmed) return p;
  return { ...p, answers: { ...p.answers, [no]: { ...a, confirmed: true } } };
}
export function gradeSelections(p: Progress): Progress {
  return { ...p, answers: Object.fromEntries(Object.entries(p.answers).map(([no, a]) => [no, { ...a, confirmed: true }])) };
}
export function resetAnswers(p: Progress): Progress { return { currentNo: 1, answers: {}, checked: [...p.checked] }; }
