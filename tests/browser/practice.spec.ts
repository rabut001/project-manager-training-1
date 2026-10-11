import { expect, test, type Page } from "@playwright/test";
import { readFileSync } from "node:fs";
import type { Exam } from "../../src/types.ts";

const catalog: { id: string; title: string; questionCount: number }[] = JSON.parse(
  readFileSync(new URL("../../public/data/index.json", import.meta.url), "utf8"),
);

const id = "2025-r07-aki";
const key = `pm-am2:v1:${id}`;
const number = (page: Page, no: number) => page.locator(".number").nth(no - 1);
const choice = (page: Page, label: string) => page.getByRole("group", { name: "選択肢" }).getByRole("button", { name: label, exact: true });
const saved = (page: Page) => page.evaluate((storageKey) => JSON.parse(localStorage.getItem(storageKey)!), key);

test("25問の画像・直接URL・戻る進む・狭い画面の表示", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("./");
  await page.getByRole("link", { name: "令和7年度 秋期" }).click();
  await expect(page.locator(".numbers button")).toHaveCount(25);
  for (let no = 1; no <= 25; no++) {
    await number(page, no).click();
    const img = page.locator(".image-expand img");
    await expect(img).toHaveAttribute("alt", `問${no}`);
    await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
    const bounds = await page.evaluate(() => ({
      overflow: document.documentElement.scrollWidth > window.innerWidth,
      height: document.querySelector(".image-scroll")!.getBoundingClientRect().height,
      touchTargets: [...document.querySelectorAll(".number, .choices button, .pager button, .confirm")].every((el) => el.getBoundingClientRect().height >= 44),
    }));
    expect(bounds.overflow).toBe(false);
    expect(bounds.height).toBeGreaterThan(20);
    expect(bounds.touchTargets).toBe(true);
  }
  await page.reload();
  await expect(page.locator(".number.current")).toHaveText("25");
  await expect(page.getByRole("button", { name: "次へ", exact: true })).toBeDisabled();
  await page.getByRole("link", { name: "一覧へ戻る" }).click();
  await page.goBack();
  await expect(page.locator(".number.current")).toHaveText("25");
  await page.goForward();
  await expect(page.getByRole("heading", { name: "プロジェクトマネージャ 午前Ⅱ" })).toBeVisible();
  await page.goto(`./${id}/`);
  await expect(page.locator(".number.current")).toHaveText("25");
  expect(errors).toEqual([]);
});

test("選択・正誤・固定・一括採点とクリアの中止／実行・保存", async ({ page }) => {
  await page.goto(`./${id}/`);
  const confirm = page.getByRole("button", { name: "結果を確認", exact: true });
  await expect(confirm).toBeDisabled();
  await choice(page, "ア").click();
  await choice(page, "エ").click();
  await expect(confirm).toHaveCSS("background-color", "rgb(31, 78, 121)");
  await page.getByRole("checkbox").check();
  await confirm.click();
  await expect(page.locator(".result .ok")).toHaveText("正解");
  await expect(choice(page, "ア")).toBeDisabled();
  await expect(page.locator(".score")).toContainText("1/1（100%）");
  await number(page, 2).click();
  await choice(page, "ア").click();
  await page.reload();
  await expect(choice(page, "ア")).toHaveAttribute("aria-pressed", "true");
  await expect(confirm).toBeEnabled();
  await number(page, 3).click();
  await page.getByRole("button", { name: "一括採点", exact: true }).click();
  let dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("未確認の1問");
  await dialog.getByRole("button", { name: "中止" }).click();
  expect((await saved(page)).answers[2].confirmed).toBe(false);
  await page.getByRole("button", { name: "一括採点", exact: true }).click();
  await dialog.getByRole("button", { name: "採点する" }).click();
  await expect(page.locator(".score")).toContainText("1/2（50%）");
  await expect(confirm).toBeDisabled();
  expect((await saved(page)).answers[3]).toBeUndefined();
  await number(page, 2).click();
  await expect(page.locator(".result .ng")).toHaveText("不正解");
  await expect(page.locator(".result")).toContainText("正答 イ");
  await page.getByRole("button", { name: "回答をすべてクリア" }).click();
  await dialog.getByRole("button", { name: "中止" }).click();
  expect(Object.keys((await saved(page)).answers)).toHaveLength(2);
  await page.getByRole("button", { name: "回答をすべてクリア" }).click();
  await dialog.getByRole("button", { name: "消してやり直す" }).click();
  await expect(page.locator(".number.current")).toContainText("1");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.locator(".score")).toContainText("—");
  await page.reload();
  expect(await saved(page)).toEqual({ currentNo: 1, answers: {}, checked: [1] });
});

test("画像拡大の倍率・スクロール・閉じると状態を維持", async ({ page }) => {
  await page.goto(`./${id}/`);
  await number(page, 7).click();
  await choice(page, "ウ").click();
  await page.getByRole("checkbox").check();
  const before = await saved(page);
  await page.getByRole("button", { name: "問7の画像を拡大" }).click();
  const dialog = page.getByRole("dialog", { name: "問7", exact: true });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole("button", { name: "2倍", exact: true })).toHaveAttribute("aria-pressed", "true");
  for (const scale of [3, 1, 2]) {
    await dialog.getByRole("button", { name: `${scale}倍`, exact: true }).click();
    const ratio = await dialog.locator("img").evaluate((img) => img.getBoundingClientRect().width / img.parentElement!.clientWidth);
    expect(ratio).toBeCloseTo(scale, 1);
  }
  const scroll = await dialog.locator(".zoom-scroll").evaluate((el) => {
    el.scrollTo(100, 100);
    return { x: el.scrollLeft, y: el.scrollTop };
  });
  expect(scroll.x).toBeGreaterThan(0);
  expect(scroll.y).toBeGreaterThan(0);
  await dialog.getByRole("button", { name: "閉じる" }).click();
  await expect(dialog).toHaveCount(0);
  expect(await saved(page)).toEqual(before);
  await expect(choice(page, "ウ")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await page.getByRole("button", { name: "問7の画像を拡大" }).click();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  const viewport = await page.locator('meta[name="viewport"]').getAttribute("content");
  expect(viewport).not.toMatch(/user-scalable\s*=\s*no|maximum-scale\s*=\s*1/);
});

test("保存不可の場合も解答を続けられる", async ({ page }) => {
  await page.addInitScript(() => Object.defineProperty(window, "localStorage", { get() { throw new Error("Denied"); } }));
  await page.goto(`./${id}/`);
  await choice(page, "エ").click();
  await page.getByRole("button", { name: "結果を確認", exact: true }).click();
  await expect(page.locator(".result .ok")).toHaveText("正解");
  await page.getByRole("button", { name: "次へ", exact: true }).click();
  await expect(page.locator(".number.current")).toHaveText("2");
});

test("公式の出題取消は正誤・正解率・一括採点から除外し、拡大とチェックを利用できる", async ({ page }) => {
  await page.route(`**/data/${id}/questions.json`, async (route) => {
    const response = await route.fetch();
    const exam = await response.json();
    exam.questions[1].answer = null;
    exam.questions[1].explanation = "IPAが問題として成立しないと判断し、公式正解を取り消した。";
    await route.fulfill({ response, json: exam });
  });
  await page.addInitScript((storageKey) => {
    if (localStorage.getItem(storageKey)) return;
    localStorage.setItem(storageKey, JSON.stringify({ currentNo: 2, checked: [], answers: {
      1: { choice: "エ", confirmed: false }, 2: { choice: "ア", confirmed: true },
    } }));
  }, key);
  await page.goto(`./${id}/`);
  await expect(page.locator(".result")).toContainText("出題取消（採点対象外）");
  await expect(page.getByRole("group", { name: "選択肢" })).toHaveCount(0);
  await expect(page.locator(".score")).toContainText("—");
  await expect(number(page, 2)).not.toHaveClass(/incorrect|correct/);
  await page.getByRole("checkbox").check();
  await page.getByRole("button", { name: "問2の画像を拡大" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "閉じる" }).click();
  await page.getByRole("button", { name: "一括採点", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await expect(dialog).toContainText("未確認の1問");
  await dialog.getByRole("button", { name: "採点する" }).click();
  await expect(page.locator(".score")).toContainText("1/1（100%）");
  expect((await saved(page)).answers[2]).toBeUndefined();
  await page.reload();
  await expect(page.locator(".result")).toContainText("出題取消（採点対象外）");
  await expect(page.getByRole("checkbox")).toBeChecked();
});

for (const entry of catalog) {
  const exam: Exam = JSON.parse(readFileSync(
    new URL(`../../public/data/${entry.id}/questions.json`, import.meta.url), "utf8",
  ));
  test(`${entry.title}: 全25画像と公式正解での採点・直接URL`, async ({ page }) => {
    const errors: string[] = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.goto(`./${entry.id}/`);
    await expect(page.getByRole("heading", { name: entry.title, exact: true })).toBeVisible();
    await expect(page.locator(".numbers button")).toHaveCount(25);
    for (const question of exam.questions) {
      await number(page, question.no).click();
      const img = page.locator(".image-expand img");
      await expect(img).toHaveAttribute("src", `/project-manager-training-1/data/${question.image}`);
      await expect.poll(() => img.evaluate((node: HTMLImageElement) => node.complete && node.naturalWidth > 0)).toBe(true);
      if (question.answer === null) {
        await expect(page.locator(".result")).toContainText("出題取消（採点対象外）");
        await expect(page.locator(".result")).toContainText(question.explanation);
        await expect(page.getByRole("group", { name: "選択肢" })).toHaveCount(0);
      } else {
        await choice(page, question.answer).click();
      }
    }
    const scoredCount = exam.questions.filter((question) => question.answer !== null).length;
    await page.getByRole("button", { name: "一括採点", exact: true }).click();
    const dialog = page.getByRole("dialog");
    await expect(dialog).toContainText(`未確認の${scoredCount}問`);
    await dialog.getByRole("button", { name: "採点する" }).click();
    await expect(page.locator(".score")).toContainText(`${scoredCount}/${scoredCount}（100%）`);
    await expect(page.locator(".number.correct")).toHaveCount(scoredCount);
    await expect(page.locator(".result")).toContainText(exam.questions[24].explanation);
    await page.reload();
    await expect(page.locator(".number.current > span").first()).toHaveText("25");
    await expect(page.locator(".score")).toContainText(`${scoredCount}/${scoredCount}（100%）`);
    if (scoredCount < 25) {
      await number(page, 2).click();
      await expect(number(page, 2)).not.toHaveClass(/correct|incorrect|draft/);
      await expect(page.locator(".result")).toContainText("出題取消（採点対象外）");
    }
    expect(errors).toEqual([]);
  });
}

test("年度移動・再読み込み・クリアでも他年度の回答とチェックを保持", async ({ page }) => {
  await page.goto("./");
  await expect(page.locator(".exam-list a")).toHaveCount(catalog.length);
  await page.getByRole("link", { name: "令和7年度 秋期", exact: true }).click();
  await number(page, 7).click();
  await choice(page, "ウ").click();
  await page.getByRole("checkbox").check();
  await page.getByRole("link", { name: "一覧へ戻る" }).click();
  await page.getByRole("link", { name: "平成22年度 春期", exact: true }).click();
  await number(page, 8).click();
  await choice(page, "イ").click();
  await page.getByRole("button", { name: "結果を確認", exact: true }).click();
  await page.getByRole("checkbox").check();
  await page.getByRole("link", { name: "一覧へ戻る" }).click();
  await page.getByRole("link", { name: "令和7年度 秋期", exact: true }).click();
  await expect(page.locator(".number.current")).toHaveText("7");
  await expect(choice(page, "ウ")).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.getByRole("button", { name: "結果を確認", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "回答をすべてクリア" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "消してやり直す" }).click();
  await page.goto("./2010-h22-haru/");
  await expect(page.locator(".number.current > span").first()).toHaveText("8");
  await expect(page.locator(".result .ok")).toHaveText("正解");
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(page.locator(".score")).toContainText("1/1（100%）");
  await page.goto(`./${id}/`);
  await expect(page.locator(".number.current")).toHaveText("1");
  await expect(page.locator(".score")).toContainText("—");
  await number(page, 7).click();
  await expect(page.getByRole("checkbox")).toBeChecked();
  await expect(choice(page, "ウ")).toHaveAttribute("aria-pressed", "false");
});
