import { useEffect, useRef, useState } from "react";
import {
  CHOICES,
  imageUrl,
  type Choice,
  type Exam,
  type Question,
} from "./exam.ts";
import {
  loadProgress,
  saveProgress,
  type AnswerRecord,
  type Progress,
  selectAnswer, confirmSelection, gradeSelections, resetAnswers,
} from "./progress.ts";
import { ImageZoom } from "./ImageZoom.tsx";
import type { LinkClick } from "./route.ts";

type PracticeProps = {
  exam: Exam;
  listHref: string;
  onLinkClick: LinkClick;
};

function questionByNo(exam: Exam, no: number): Question {
  const question = exam.questions.find((item) => item.no === no);
  if (!question) {
    return exam.questions[0];
  }
  return question;
}

function statusLabel(answer: AnswerRecord | undefined, question: Question): string {
  if (question.answer === null) return "出題取消、採点対象外";
  if (!answer) {
    return "未選択";
  }
  if (!answer.confirmed) {
    return "選択済み、未確認";
  }
  return answer.choice === question.answer ? "正解" : "誤答";
}

function numberLabel(
  no: number,
  answer: AnswerRecord | undefined,
  question: Question,
  checked: boolean,
): string {
  const mark = checked ? "チェック済み、" : "";
  return `問${no}、${mark}${statusLabel(answer, question)}`;
}

type DialogKind = "clear" | "grade";

export function Practice({ exam, listHref, onLinkClick }: PracticeProps) {
  const questionNos = new Set(exam.questions.map((question) => question.no));
  const [progress, setProgress] = useState<Progress>(() =>
    loadProgress(exam.id, questionNos),
  );
  const [zoomOpen, setZoomOpen] = useState(false);
  const [dialogKind, setDialogKind] = useState<DialogKind | null>(null);
  const dialog = useRef<HTMLDialogElement>(null);
  const imageScroll = useRef<HTMLDivElement>(null);
  const lower = useRef<HTMLDivElement>(null);
  const shownKind = useRef<DialogKind>("clear");
  if (dialogKind) {
    shownKind.current = dialogKind;
  }

  const currentNo = questionNos.has(progress.currentNo)
    ? progress.currentNo
    : exam.questions[0].no;
  const question = questionByNo(exam, currentNo);
  const answer = progress.answers[question.no];
  const cancelled = question.answer === null;
  const confirmed = !cancelled && (answer?.confirmed ?? false);

  useEffect(() => {
    saveProgress(exam.id, progress);
  }, [exam.id, progress]);

  useEffect(() => {
    imageScroll.current?.scrollTo(0, 0);
    lower.current?.scrollTo(0, 0);
  }, [question.no]);

  useEffect(() => {
    const element = dialog.current;
    if (!element) {
      return;
    }
    if (dialogKind && !element.open) {
      element.showModal();
    }
    if (!dialogKind && element.open) {
      element.close();
    }
  }, [dialogKind]);

  const draftCount = exam.questions.filter((item) => {
    const record = progress.answers[item.no];
    return item.answer !== null && record !== undefined && !record.confirmed;
  }).length;
  const confirmedQuestions = exam.questions.filter(
    (item) => item.answer !== null && progress.answers[item.no]?.confirmed,
  );
  const correctCount = confirmedQuestions.filter(
    (item) => progress.answers[item.no].choice === item.answer,
  ).length;
  const score =
    confirmedQuestions.length === 0
      ? "—"
      : `${correctCount}/${confirmedQuestions.length}（${Math.round(
          (correctCount / confirmedQuestions.length) * 100,
        )}%）`;

  function select(choice: Choice) {
    if (confirmed || cancelled) {
      return;
    }
    setProgress((current) => selectAnswer(current, question.no, choice));
  }

  function confirmAnswer() {
    if (cancelled) return;
    setProgress((current) => confirmSelection(current, question.no));
  }

  function moveTo(no: number) {
    if (!questionNos.has(no)) {
      return;
    }
    setProgress((current) => ({ ...current, currentNo: no }));
  }

  function dismissDialog() {
    dialog.current?.close();
    setDialogKind(null);
  }

  function gradeDrafts() {
    dialog.current?.close();
    setProgress((current) => {
      const answers = Object.fromEntries(Object.entries(current.answers).filter(([no]) => questionByNo(exam, Number(no)).answer !== null));
      return gradeSelections({ ...current, answers });
    });
    setDialogKind(null);
  }

  function toggleCheck() {
    setProgress((current) => {
      const checked = current.checked.includes(question.no)
        ? current.checked.filter((no) => no !== question.no)
        : [...current.checked, question.no];
      return { ...current, checked };
    });
  }

  function clearSession() {
    dialog.current?.close();
    setProgress(resetAnswers);
    setDialogKind(null);
  }

  const firstNo = exam.questions[0].no;
  const lastNo = exam.questions[exam.questions.length - 1].no;

  return (
    <div className="practice">
      <header className="top">
        <a
          className="back"
          href={listHref}
          onClick={(event) => onLinkClick(event, listHref)}
        >
          一覧へ戻る
        </a>
        <div className="heading">
          <h1>{exam.title}</h1>
          <p className="score">
            正解 <span>{score}</span>
          </p>
        </div>
        <nav className="numbers" aria-label="問題番号">
          {exam.questions.map((item) => {
            const itemAnswer = item.answer === null ? undefined : progress.answers[item.no];
            const classes = ["number"];
            if (item.no === question.no) {
              classes.push("current");
            }
            if (itemAnswer?.confirmed) {
              classes.push(
                itemAnswer.choice === item.answer ? "correct" : "incorrect",
              );
            } else if (itemAnswer) {
              classes.push("draft");
            }
            return (
              <button
                key={item.no}
                type="button"
                className={classes.join(" ")}
                aria-current={item.no === question.no ? "true" : undefined}
                aria-label={numberLabel(
                  item.no,
                  itemAnswer,
                  item,
                  progress.checked.includes(item.no),
                )}
                onClick={() => moveTo(item.no)}
              >
                <span>{item.no}</span>
                <span className="badges" aria-hidden="true">
                  {itemAnswer?.confirmed && (
                    <span className="mark">
                      {itemAnswer.choice === item.answer ? "○" : "×"}
                    </span>
                  )}
                  {progress.checked.includes(item.no) && (
                    <span className="flag">
                      <svg viewBox="0 0 16 16">
                        <path d="M2.6 8.2 6.4 12.2 13.4 3.8" />
                      </svg>
                    </span>
                  )}
                </span>
              </button>
            );
          })}
        </nav>
      </header>

      <div className="image-pane">
        <div className="check-row">
          <label className="check">
            <input
              type="checkbox"
              checked={progress.checked.includes(question.no)}
              aria-label={`問${question.no}をチェック`}
              onChange={toggleCheck}
            />
          </label>
        </div>
        <div className="image-scroll" ref={imageScroll}>
          <button type="button" className="image-expand" onClick={() => setZoomOpen(true)} aria-label={`問${question.no}の画像を拡大`}>
            <img src={imageUrl(question.image)} alt={`問${question.no}`} />
          </button>
        </div>
      </div>

      <div className="lower" ref={lower}>
        {!cancelled && <div className="choices" role="group" aria-label="選択肢">
          {CHOICES.map((choice) => (
            <button
              key={choice}
              type="button"
              className={answer?.choice === choice ? "selected" : undefined}
              aria-pressed={answer?.choice === choice}
              disabled={confirmed}
              onClick={() => select(choice)}
            >
              {choice}
            </button>
          ))}
        </div>}

        {cancelled ? (
          <section className="result">
            <p>出題取消（採点対象外）</p>
            <p>{question.explanation}</p>
            <p className="note">IPA の公式解説ではない</p>
          </section>
        ) : confirmed && answer ? (
          <section className="result" aria-live="polite">
            <p className={answer.choice === question.answer ? "ok" : "ng"}>
              {answer.choice === question.answer ? "正解" : "不正解"}
            </p>
            <p>
              正答 <strong>{question.answer}</strong>
            </p>
            <p>{question.explanation}</p>
            <p className="note">IPA の公式解説ではない</p>
          </section>
        ) : (
          <button
            type="button"
            className="confirm"
            disabled={!answer}
            onClick={confirmAnswer}
          >
            結果を確認
          </button>
        )}

        <div className="pager">
          <button
            type="button"
            disabled={question.no === firstNo}
            onClick={() => moveTo(question.no - 1)}
          >
            前へ
          </button>
          <button
            type="button"
            disabled={question.no === lastNo}
            onClick={() => moveTo(question.no + 1)}
          >
            次へ
          </button>
        </div>

        <button
          type="button"
          className="grade"
          disabled={draftCount === 0}
          onClick={() => setDialogKind("grade")}
        >
          一括採点
        </button>

        <button
          type="button"
          className="clear"
          onClick={() => setDialogKind("clear")}
        >
          回答をすべてクリア
        </button>

        <footer>
          出典: {exam.title} プロジェクトマネージャ試験 午前Ⅱ 問{question.no}{" "}
          <a href={exam.sourceUrl}>
            IPA の過去問題
          </a>
        </footer>
      </div>

      {zoomOpen && <ImageZoom src={imageUrl(question.image)} no={question.no} onClose={() => setZoomOpen(false)} />}

      <dialog
        ref={dialog}
        onClose={() => setDialogKind(null)}
        aria-labelledby="dialog-title"
      >
        {shownKind.current === "grade" ? (
          <>
            <h2 id="dialog-title">選択済みの問をまとめて採点します</h2>
            <p>
              選択済みで未確認の{draftCount}問を確認済みにします。採点後は、その問の選択を変えられません。未選択の問は採点しません。
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={dismissDialog}>
                中止
              </button>
              <button type="button" onClick={gradeDrafts}>
                採点する
              </button>
            </div>
          </>
        ) : (
          <>
            <h2 id="dialog-title">この回の解答を消します</h2>
            <p>
              {exam.title}の確認済みの解答と、まだ確認していない選択を消して、問1に戻ります。チェックはそのまま残します。
            </p>
            <div className="dialog-actions">
              <button type="button" onClick={dismissDialog}>
                中止
              </button>
              <button type="button" className="danger" onClick={clearSession}>
                消してやり直す
              </button>
            </div>
          </>
        )}
      </dialog>
    </div>
  );
}
