"""確認用の画像一覧を作る。欠落や正確性の判断・確認記録は人が行う。"""
import argparse
from pathlib import Path

import pymupdf

ROOT = Path(__file__).resolve().parents[1]

def render(exam_id):
    images = sorted((ROOT / "public/data" / exam_id).glob("q*.png"))
    out = ROOT / "test-results/image-review" / exam_id
    out.mkdir(parents=True, exist_ok=True)
    for start in range(0, len(images), 6):
        group = images[start:start + 6]
        widths = 640
        pixmaps = [pymupdf.Pixmap(str(path)) for path in group]
        heights = [pix.height * widths / pix.width for pix in pixmaps]
        rows = [max(heights[i:i + 2]) + 24 for i in range(0, len(group), 2)]
        doc = pymupdf.open()
        page = doc.new_page(width=widths * 2 + 24, height=sum(rows) + 12)
        y = 12
        for i, (path, height) in enumerate(zip(group, heights)):
            x = 8 + (i % 2) * (widths + 8)
            page.insert_text((x, y + 10), path.stem, fontsize=10)
            page.insert_image(pymupdf.Rect(x, y + 14, x + widths, y + 14 + height), filename=str(path))
            if i % 2 == 1:
                y += rows[i // 2]
        page.get_pixmap().save(out / f"sheet-{start // 6 + 1}.png")
        doc.close()
    print(out)

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("exam_id")
    render(parser.parse_args().exam_id)
