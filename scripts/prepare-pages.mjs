import { readFile, writeFile, mkdir } from "node:fs/promises";

// GitHub Pagesで年度URLを直接開いても200応答で同じアプリを起動する。
const exams = JSON.parse(await readFile("public/data/index.json", "utf8"));
const html = await readFile("dist/index.html", "utf8");
for (const { id } of exams) {
  await mkdir(`dist/${id}`, { recursive: true });
  await writeFile(`dist/${id}/index.html`, html);
}
await writeFile("dist/404.html", html);
