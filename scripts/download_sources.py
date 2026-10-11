"""取得元一覧に記録したIPA公式PDFを保存する。既存の原本は上書きしない。"""
import argparse
import concurrent.futures
import json
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def download(exam):
    folder = ROOT / "sources/ipa" / exam["id"]
    folder.mkdir(parents=True, exist_ok=True)
    for item in exam["files"]:
        path = folder / item["filename"]
        if path.exists():
            assert path.read_bytes().startswith(b"%PDF-"), f"不正な既存原本: {path}"
            continue
        request = urllib.request.Request(item["url"], headers={"User-Agent": "PM-training-source-import/1.0"})
        with urllib.request.urlopen(request, timeout=60) as response:
            data = response.read()
        if not data.startswith(b"%PDF-"):
            raise ValueError(f"取得結果がPDFではありません: {item['url']}")
        path.write_bytes(data)
    return exam["id"]

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exam_ids", nargs="*", help="省略すると取得元一覧の全回")
    args = parser.parse_args()
    manifest = json.loads((ROOT / "sources/ipa/manifest.json").read_text())
    exams = [e for e in manifest["exams"] if not args.exam_ids or e["id"] in args.exam_ids]
    if args.exam_ids and set(args.exam_ids) != {e["id"] for e in exams}:
        parser.error("取得元一覧にない年度IDです。")
    with concurrent.futures.ThreadPoolExecutor(max_workers=3) as pool:
        for result in pool.map(download, exams):
            print(f"{result}: 原本取得済み", flush=True)
