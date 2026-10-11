import { useEffect, useState } from "react";
import { ExamList, MissingExam } from "./ExamList.tsx";
import { loadExam, peekExam, type Exam } from "./exam.ts";
import { Practice } from "./Practice.tsx";
import { listPath, useRoute, type LinkClick } from "./route.ts";

type ExamScreenProps = {
  examId: string;
  onLinkClick: LinkClick;
};

function ExamScreen({ examId, onLinkClick }: ExamScreenProps) {
  const [exam, setExam] = useState<Exam | null>(() => peekExam(examId) ?? null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    loadExam(examId)
      .then((loaded) => {
        if (active) {
          setExam(loaded);
        }
      })
      .catch((reason: unknown) => {
        if (active) {
          setError(reason instanceof Error ? reason.message : "読み込みに失敗しました。");
        }
      });
    return () => {
      active = false;
    };
  }, [examId]);

  if (error) {
    return <p className="status">{error}</p>;
  }
  if (!exam) {
    return <p className="status">問題を読み込んでいます。</p>;
  }
  return <Practice exam={exam} listHref={listPath()} onLinkClick={onLinkClick} />;
}

export function App() {
  const { route, onLinkClick } = useRoute();

  if (route.name === "list") {
    return <ExamList onLinkClick={onLinkClick} />;
  }
  if (route.name === "missing") {
    return <MissingExam onLinkClick={onLinkClick} />;
  }
  return <ExamScreen key={route.id} examId={route.id} onLinkClick={onLinkClick} />;
}
