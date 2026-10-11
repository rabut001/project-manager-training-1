"""原本・明示した切り出し範囲から画像と正解を抽出する。解説JSONは上書きしない。"""
import argparse
import hashlib
import json
import re
import subprocess
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]

def official_answers(pdf_path):
    with pymupdf.open(pdf_path) as doc:
        text = "\n".join(page.get_text() for page in doc)
    answers = {int(no): answer for no, answer in re.findall(r"問\s*(\d+)\s*([アイウエ])", text)}
    if set(answers) != set(range(1, 26)):
        raise ValueError("公式正解の抽出が25問と一致しません。原本を確認してください。")
    return answers

def extract(exam_id, ocr=False, review_dir="test-results/extraction"):
    source = ROOT / "sources/ipa" / exam_id
    out = ROOT / "public/data" / exam_id
    review = ROOT / review_dir / exam_id
    crops = json.loads((source / "crops.json").read_text())
    if [crop["no"] for crop in crops] != list(range(1, 26)):
        raise ValueError("切り出し範囲の問番号が不正です。")
    answers = official_answers(source / "am2-kaitou.pdf")
    out.mkdir(parents=True, exist_ok=True)
    review.mkdir(parents=True, exist_ok=True)
    with pymupdf.open(source / "am2-mondai.pdf") as doc:
        for crop in crops:
            if not isinstance(crop["page"], int) or not 1 <= crop["page"] <= len(doc):
                raise ValueError(f"問{crop['no']}のページ番号が不正です。")
            page = doc[crop["page"] - 1]
            rect = pymupdf.Rect(crop["rect"])
            if rect.is_empty or not page.rect.contains(rect):
                raise ValueError(f"問{crop['no']}の切り出し範囲が不正です。")
            image = out / f"q{crop['no']:02}.png"
            page.get_pixmap(matrix=pymupdf.Matrix(3, 3), clip=rect, colorspace=pymupdf.csGRAY).save(image)
            if ocr:
                result = subprocess.run(["tesseract", str(image), "stdout", "-l", "jpn+eng", "--psm", "6"], check=True, capture_output=True, text=True)
                (review / f"q{crop['no']:02}.txt").write_text(result.stdout)
    # 執筆済みのquestions.jsonを変更しない。公式正解の抽出結果だけ別ファイルに保存。
    (review / "answers.json").write_text(json.dumps(answers, ensure_ascii=False, indent=2) + "\n")
    hashes = {name: hashlib.sha256((source / name).read_bytes()).hexdigest() for name in ["am2-mondai.pdf", "am2-kaitou.pdf"]}
    (source / "sha256.json").write_text(json.dumps(hashes, indent=2) + "\n")
    print(f"{exam_id}: 25画像・公式正解を抽出。問題・解説JSONは変更していません。")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exam_id")
    parser.add_argument("--ocr", action="store_true")
    parser.add_argument("--review-dir", default="test-results/extraction", help="抽出下書きの出力先。完了案件は指定しない。")
    args = parser.parse_args()
    extract(args.exam_id, args.ocr, args.review_dir)
