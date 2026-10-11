"""画像PDFの問番号を検出し、切り出し・OCRの下書きを作る。内容確認は行わない。"""
import argparse
import concurrent.futures
import csv
import io
import json
import os
import re
import subprocess
import tempfile
from pathlib import Path

import pymupdf

from extract_exam import ROOT, extract, official_answers

REVIEW = ROOT / "specs/0001-initial-release/review/extraction"

def headers(page):
    clip = pymupdf.Rect(20, 35, 150, page.rect.height - 35)
    with tempfile.TemporaryDirectory() as folder:
        image = Path(folder) / "strip.png"
        page.get_pixmap(matrix=pymupdf.Matrix(3, 3), colorspace=pymupdf.csGRAY, clip=clip).save(image)
        result = subprocess.run(["tesseract", str(image), "stdout", "-l", "jpn", "--psm", "6", "tsv"], capture_output=True, text=True, check=True)
    lines = {}
    for row in csv.DictReader(io.StringIO(result.stdout), delimiter="\t"):
        if row["level"] == "5" and row["text"].strip():
            lines.setdefault((row["block_num"], row["par_num"], row["line_num"]), []).append(row)
    found = []
    for words in lines.values():
        words.sort(key=lambda word: int(word["left"]))
        text = "".join(word["text"].strip() for word in words).lstrip("・･.．-* ")
        match = re.match(r"[問間聞](\d{1,2})(?!\d)", text)
        if match:
            found.append((int(match[1]), 35 + min(int(word["top"]) for word in words) / 3))
    return sorted(found, key=lambda item: item[1])

def footer_top(pix):
    # 冊子下部の中央にある短い「- n -」を検出。本文全体を保つ。
    width, height, data = pix.width, pix.height, pix.samples
    for y in range(height - 1, int(height * 0.90), -1):
        row = data[y * width:(y + 1) * width]
        dark = [x for x, pixel in enumerate(row) if pixel < 150]
        if dark and 20 < dark[-1] - dark[0] < 160 and abs((dark[0] + dark[-1]) / 2 - width / 2) < 120:
            for above in range(y - 1, max(y - 60, 0), -1):
                center = data[above * width + width // 2 - 100:above * width + width // 2 + 100]
                if not any(pixel < 150 for pixel in center):
                    return above / 2
    return height * 0.91 / 2

def content_bottom(page, top, limit):
    clip = pymupdf.Rect(page.rect.width * 0.07, top, page.rect.width * 0.94, limit)
    pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), colorspace=pymupdf.csGRAY, clip=clip)
    threshold = bytes(0 if value < 170 else 255 for value in range(256))
    mask = pix.samples.translate(threshold)
    rows = [y for y in range(pix.height) if mask[y * pix.width:(y + 1) * pix.width].count(0) >= 6]
    return min(limit, top + (rows[-1] + 1) / 2 + 7) if rows else limit

def title(exam_id):
    year = int(exam_id[:4])
    era = f"令和{year - 2018}年度" if year >= 2020 else f"平成{year - 1988}年度"
    period = "特別" if year == 2011 else "10月" if year == 2020 else "秋期" if year >= 2021 else "春期"
    return f"{era} {period}"

def prepare(exam):
    exam_id = exam["id"]
    source = ROOT / "sources/ipa" / exam_id
    data_path = ROOT / "public/data" / exam_id / "questions.json"
    if data_path.exists():
        return f"{exam_id}: 執筆済みデータがあるため下書きを変更しない"
    crop_path = source / "crops.json"
    if not crop_path.exists():
        candidates = []
        with pymupdf.open(source / "am2-mondai.pdf") as doc:
            for page_no, page in enumerate(doc, 1):
                starts = headers(page)
                if not starts:
                    continue
                pix = page.get_pixmap(matrix=pymupdf.Matrix(2, 2), colorspace=pymupdf.csGRAY)
                footer = footer_top(pix)
                for i, (no, y) in enumerate(starts):
                    limit = starts[i + 1][1] - 8 if i + 1 < len(starts) else footer - 8
                    top = max(0, y - 6)
                    bottom = content_bottom(page, top, limit)
                    candidates.append({"no": no, "page": page_no, "rect": [round(page.rect.width * 0.07, 2), round(top, 2), round(page.rect.width * 0.94, 2), round(bottom, 2)]})
        if len(candidates) == 25:
            # 10→19、20→29などのOCR誤認を下書きとして補正。原画像の番号確認は別工程。
            for expected, q in enumerate(candidates, 1):
                if q["no"] != expected:
                    q["detectedNo"] = q["no"]
                    q["no"] = expected
        if [q["no"] for q in candidates] != list(range(1, 26)):
            (source / "crop-candidates.json").write_text(json.dumps(candidates, indent=2) + "\n")
            return f"{exam_id}: 問番号検出を要確認 {[q['no'] for q in candidates]}"
        crop_path.write_text(json.dumps(candidates, indent=2) + "\n")
    extract(exam_id, ocr=True, review_dir="specs/0001-initial-release/review/extraction")
    answers = official_answers(source / "am2-kaitou.pdf")
    questions = []
    for no in range(1, 26):
        text = (REVIEW / exam_id / f"q{no:02}.txt").read_text()
        text = re.sub(r"^[\s・]*[問間聞]\s*\d+\s*", "", text)
        markers = list(re.finditer(r"(?:^|[\s　])([アイウエ])[\s　]+", text))
        # 四肢が一意に検出できないときは空欄。執筆時に原画像と照合して補正する。
        choices = dict.fromkeys("アイウエ", "")
        stem = text.strip()
        if len(markers) == 4 and [m[1] for m in markers] == list("アイウエ"):
            stem = text[:markers[0].start()].strip()
            for i, match in enumerate(markers):
                end = markers[i + 1].start() if i < 3 else len(text)
                choices[match[1]] = text[match.end():end].strip()
        questions.append({"no": no, "answer": answers[no], "image": f"{exam_id}/q{no:02}.png", "stem": stem, "choices": choices, "visuals": [], "explanation": "", "references": [exam["pageUrl"]]})
    draft = {"id": exam_id, "title": title(exam_id), "sourceUrl": exam["pageUrl"], "questions": questions}
    (REVIEW / exam_id / "draft.json").write_text(json.dumps(draft, ensure_ascii=False, indent=2) + "\n")
    return f"{exam_id}: 25問の画像と執筆用下書きを準備（未確認）"

if __name__ == "__main__":
    os.environ["OMP_THREAD_LIMIT"] = "1"
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exam_ids", nargs="*")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "sources/ipa/manifest.json").read_text())
    exams = [e for e in manifest["exams"] if not args.exam_ids or e["id"] in args.exam_ids]
    with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
        for result in pool.map(prepare, exams):
            print(result, flush=True)
