import { EXAMS } from "./exam.ts";
import { examPath, listPath, type LinkClick } from "./route.ts";

export function ExamList({ onLinkClick }: { onLinkClick: LinkClick }) {
  return <div className="sheet">
    <h1>プロジェクトマネージャ 午前Ⅱ</h1>
    <p className="note">2026年度の科目A-2に相当する過去問演習です。</p>
    <nav aria-label="試験の回"><ul className="exam-list">
      {EXAMS.map((exam) => {
        const href = examPath(exam.id);
        return <li key={exam.id}><a href={href} onClick={(event) => onLinkClick(event, href)}>{exam.title}</a></li>;
      })}
    </ul></nav>
    <footer>出典: <a href="https://www.ipa.go.jp/shiken/mondai-kaiotu/index.html">IPA の過去問題</a></footer>
  </div>;
}
export function MissingExam({ onLinkClick }: { onLinkClick: LinkClick }) {
  const href = listPath();
  return <div className="sheet"><p>この回はありません。</p>
    <a className="back" href={href} onClick={(event) => onLinkClick(event, href)}>一覧へ戻る</a>
  </div>;
}
