import catalog from "../public/data/index.json";
import { CHOICES, type Exam, type Question } from "./types.ts";
export { CHOICES, type Choice, type Exam, type Question } from "./types.ts";

export const EXAMS = catalog;
export function isExamId(value: string): boolean {
  return EXAMS.some((exam) => exam.id === value);
}

export function parseExam(value: unknown): Exam {
  if (!value || typeof value !== "object") throw new Error("問題データの形式が不正です。");
  const exam = value as Record<string, unknown>;
  if (typeof exam.id !== "string" || typeof exam.title !== "string" ||
      typeof exam.sourceUrl !== "string" || !Array.isArray(exam.questions) || exam.questions.length !== 25) {
    throw new Error("問題データの形式が不正です。");
  }
  const questions = exam.questions as Question[];
  if (!questions.every((q, i) => q && q.no === i + 1 && CHOICES.includes(q.answer) &&
      typeof q.image === "string" && q.image.startsWith(`${exam.id}/`) &&
      typeof q.explanation === "string" && q.explanation.trim())) {
    throw new Error("問題データの形式が不正です。");
  }
  return { id: exam.id, title: exam.title, sourceUrl: exam.sourceUrl, questions };
}

const examCache = new Map<string, Promise<Exam>>();
const resolvedExams = new Map<string, Exam>();
export function peekExam(id: string): Exam | undefined { return resolvedExams.get(id); }
export function loadExam(id: string): Promise<Exam> {
  const cached = examCache.get(id);
  if (cached) return cached;
  const pending = fetchExam(id).then((exam) => {
    resolvedExams.set(id, exam);
    return exam;
  }).catch((error: unknown) => { examCache.delete(id); throw error; });
  examCache.set(id, pending);
  return pending;
}
async function fetchExam(id: string): Promise<Exam> {
  const response = await fetch(`${import.meta.env.BASE_URL}data/${id}/questions.json`);
  if (!response.ok) throw new Error("問題データを読み込めませんでした。");
  const exam = parseExam(await response.json());
  if (exam.id !== id) throw new Error("問題データの回が一致しません。");
  return exam;
}
export function imageUrl(image: string): string {
  return `${import.meta.env.BASE_URL}data/${image}`;
}
