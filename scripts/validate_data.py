"""公開問題データ、原本ハッシュ、公式正解、確認記録を検証する。"""
import argparse
import hashlib
import json
from pathlib import Path

from extract_exam import official_answers

ROOT = Path(__file__).resolve().parents[1]
CHOICES = set("アイウエ")

def validate(release=False):
    catalog = json.loads((ROOT / "public/data/index.json").read_text())
    ids = [item["id"] for item in catalog]
    assert len(set(ids)) == len(ids), "収録回の重複"
    assert ids == sorted(ids, reverse=True), "収録回の並び順"
    manifest = json.loads((ROOT / "sources/ipa/manifest.json").read_text())
    sources = {item["id"]: item for item in manifest["exams"]}
    if release:
        assert set(ids) == set(sources) and len(ids) == 17, "全17回が未収録"
    count = 0
    scored_count = 0
    for item in catalog:
        exam_id = item["id"]
        data = json.loads((ROOT / f"public/data/{exam_id}/questions.json").read_text())
        assert data["id"] == exam_id and data["title"] == item["title"]
        assert data["sourceUrl"] == sources[exam_id]["pageUrl"]
        source = ROOT / f"sources/ipa/{exam_id}"
        hashes = json.loads((source / "sha256.json").read_text())
        for filename, expected in hashes.items():
            assert hashlib.sha256((source / filename).read_bytes()).hexdigest() == expected, f"原本の変更: {filename}"
        answers = official_answers(source / "am2-kaitou.pdf")
        questions = data["questions"]
        assert [q["no"] for q in questions] == list(range(1, 26)), "問番号の欠落・重複・並び"
        assert item["questionCount"] == len(questions) == 25
        for q in questions:
            assert q["answer"] == answers[q["no"]], f"{exam_id}問{q['no']}: 公式正解不一致"
            assert q["answer"] is None or q["answer"] in CHOICES
            scored_count += q["answer"] is not None
            assert q["stem"].strip() and q["explanation"].strip(), f"問{q['no']}: 未執筆"
            assert set(q["choices"]) == CHOICES and all(q["choices"].values())
            assert set(q["visuals"]) <= {"figure", "table", "image"}
            assert q["image"] == f"{exam_id}/q{q['no']:02}.png"
            image = ROOT / "public/data" / q["image"]
            assert image.is_file() and image.read_bytes()[:8] == b"\x89PNG\r\n\x1a\n"
            assert q["references"] and all(url.startswith("https://") for url in q["references"])
        review = json.loads((source / "review.json").read_text())
        assert review["dataSha256"] == hashlib.sha256((ROOT / f"public/data/{exam_id}/questions.json").read_bytes()).hexdigest(), "問題・解説の変更後に内容確認が必要"
        for q in questions:
            assert review["imagesSha256"][q["image"]] == hashlib.sha256((ROOT / "public/data" / q["image"]).read_bytes()).hexdigest(), f"問{q['no']}: 画像変更後に内容確認が必要"
        assert [r["no"] for r in review["questions"]] == list(range(1, 26))
        assert all(all(r[k] is True for k in ["image", "text", "answer", "explanation"]) and r["note"] for r in review["questions"]), "内容確認が未完了"
        count += len(questions)
    print(f"検証成功: {len(ids)}回・{count}問（採点対象{scored_count}問、{'全回リリース確認' if release else '収録済み範囲'}）")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--release", action="store_true")
    args = parser.parse_args()
    validate(args.release)
