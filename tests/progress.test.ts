import assert from "node:assert/strict";
import { afterEach, test } from "node:test";
import { confirmSelection, emptyProgress, gradeSelections, loadProgress, resetAnswers, saveProgress, selectAnswer, storageKey } from "../src/progress.ts";

const nos = new Set(Array.from({ length: 25 }, (_, i) => i + 1));
function memoryStorage() {
  const entries = new Map<string, string>();
  Object.defineProperty(globalThis, "localStorage", { configurable: true, value: {
    getItem: (key: string) => entries.get(key) ?? null,
    setItem: (key: string, value: string) => entries.set(key, value),
  } });
}
afterEach(() => { Reflect.deleteProperty(globalThis, "localStorage"); });

test("結果確認前は選び直せる。確認後は固定し、未選択は採点しない", () => {
  let p = emptyProgress();
  assert.equal(confirmSelection(p, 1), p);
  p = selectAnswer(p, 1, "ア");
  p = selectAnswer(p, 1, "エ");
  assert.deepEqual(p.answers[1], { choice: "エ", confirmed: false });
  p = confirmSelection(p, 1);
  assert.equal(selectAnswer(p, 1, "ア"), p);
  p = selectAnswer(p, 2, "イ");
  const graded = gradeSelections(p);
  assert.deepEqual(graded.answers, { 1: { choice: "エ", confirmed: true }, 2: { choice: "イ", confirmed: true } });
  assert.equal(graded.answers[3], undefined);
  assert.equal(p.answers[2].confirmed, false);
});

test("クリアは現在位置と回答をリセットし、チェックを残す", () => {
  const p = { ...selectAnswer(emptyProgress(), 25, "ウ"), checked: [2, 25] };
  assert.deepEqual(resetAnswers(p), { currentNo: 1, answers: {}, checked: [2, 25] });
  assert.equal(p.currentNo, 25);
});

test("年度単位で未確認の選択も保存し、SAの保存には触れない", () => {
  memoryStorage();
  localStorage.setItem("sa-am2:v1:2025", "reference-progress");
  const a = { ...selectAnswer(emptyProgress(), 7, "ウ"), checked: [1, 7] };
  const b = confirmSelection(selectAnswer(emptyProgress(), 2, "イ"), 2);
  saveProgress("2025-r07-aki", a);
  saveProgress("2024-r06-aki", b);
  assert.deepEqual(loadProgress("2025-r07-aki", nos), a);
  assert.deepEqual(loadProgress("2024-r06-aki", nos), b);
  saveProgress("2025-r07-aki", resetAnswers(a));
  assert.deepEqual(loadProgress("2024-r06-aki", nos), b);
  assert.equal(localStorage.getItem("sa-am2:v1:2025"), "reference-progress");
});

test("壊れた保存や範囲外の番号・不正な値は取り込まない", () => {
  memoryStorage();
  const key = storageKey("2025-r07-aki");
  for (const raw of ["broken-json", "null", "[]", "42"]) {
    localStorage.setItem(key, raw);
    assert.deepEqual(loadProgress("2025-r07-aki", nos), emptyProgress());
  }
  localStorage.setItem(key, JSON.stringify({ currentNo: 26, answers: {
    1: { choice: "エ", confirmed: true }, 2: { choice: "オ", confirmed: false },
    3: { choice: "イ", confirmed: "false" }, 26: { choice: "ア", confirmed: false },
  }, checked: [2, 2, 25, 26, "1", null] }));
  assert.deepEqual(loadProgress("2025-r07-aki", nos), {
    currentNo: 1, answers: { 1: { choice: "エ", confirmed: true } }, checked: [2, 25],
  });
});

test("保存が拒否されても演習の状態を変更できる", () => {
  Object.defineProperty(globalThis, "localStorage", { configurable: true, get() { throw new Error("Storage denied"); } });
  const p = selectAnswer(loadProgress("2025-r07-aki", nos), 1, "エ");
  assert.doesNotThrow(() => saveProgress("2025-r07-aki", p));
  assert.equal(confirmSelection(p, 1).answers[1].confirmed, true);
});
