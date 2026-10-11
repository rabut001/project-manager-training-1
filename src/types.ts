export const CHOICES = ["ア", "イ", "ウ", "エ"] as const;
export type Choice = (typeof CHOICES)[number];
export type Question = {
  no: number;
  answer: Choice;
  image: string;
  stem: string;
  choices: Record<Choice, string>;
  visuals: ("figure" | "table" | "image")[];
  explanation: string;
  references: string[];
};
export type Exam = {
  id: string;
  title: string;
  sourceUrl: string;
  questions: Question[];
};
