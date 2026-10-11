# プロジェクトマネージャ 午前Ⅱ 演習

[system-arch-training](https://github.com/rabut001/system-arch-training)の画面・演習操作を引き継いだ、小さな静的アプリです。React・TypeScript・Viteを使用し、回答・チェック・現在位置はブラウザに保存します。ログインやバックエンドはありません。

**2009〜2025年度の全17回・425問**を収録しています。IPAの原問題画像と公式正解を使い、正解の根拠・各誤答の理由・必要な計算手順を説明します。2016年度春期問2の公式取消を反映し、採点対象は424問です。問題画像はタップして1・2・3倍で読めます。

リポジトリ: [rabut001/project-manager-training-1](https://github.com/rabut001/project-manager-training-1)。GitHub Pages公開先: [PM午前Ⅱ演習](https://rabut001.github.io/project-manager-training-1/)。

## 開発コンテナで起動

Node.js・npm・Pythonの依存関係はすべて開発コンテナに入れます。ホストLinuxにはインストールしません。ホストにはDockerと、Dev Containers対応のエディタを用意してください。

1. このフォルダを開き、VS Codeなら「Dev Containers: Reopen in Container」を実行します。
2. コンテナの構築後、`postCreateCommand`が`npm ci`を実行します。
3. **コンテナのターミナル**で以下を実行します。

```bash
npm run dev
```

転送された5173番ポートの`http://localhost:5173/project-manager-training-1/`を開きます。

エディタを使わない場合も、リポジトリのルートからDockerで起動できます。以下の`npm`はコンテナ内で実行されます。

```bash
docker build -t pm-training-dev:local -f .devcontainer/Dockerfile .
docker run --rm -it --init --user "$(id -u):$(id -g)" \
  -p 127.0.0.1:5173:5173 -p 127.0.0.1:4173:4173 \
  -v "$PWD:/workspaces/project-manager-training-1" \
  -w /workspaces/project-manager-training-1 \
  pm-training-dev:local bash
```

起動したコンテナの中で`npm ci`、`npm run dev`を実行してください。Node.jsは24 LTS。`package-lock.json`でnpm依存を固定し、Python依存は`requirements.txt`で固定しています。

## 検証とビルド

以下もコンテナのターミナルで実行します。

```bash
npm test
npm run build
```

ビルド前に、原本のハッシュ・25問の連続・公式正解・画像・執筆済みの解説・内容確認記録を検証します。`dist/`が公開成果物です。PDF原本、開発文書、確認記録は含まれません。年度URLにもHTMLを配置し、GitHub Pagesで直接開けるようにします。

ブラウザの検証には、初回だけ**コンテナ内**でChromiumを入れます。

```bash
sudo env PLAYWRIGHT_BROWSERS_PATH=/opt/pm-browsers npx playwright install --with-deps chromium
npm run build
npm run test:browser
```

390×844、320×568、1280×900のChromiumで、全17回・425画像、公式正解による採点、取消問題の除外、年度別保存、選択・クリア・直接URL・拡大を確認します。iPhone SafariやAndroid Chromeの実機確認は未実施です。

## 構成

|場所|役割|
|---|---|
|`src/`|画面・ルーティング・年度別の保存・採点|
|`public/data/`|配信する年度一覧、問題・解説JSON、原問題画像|
|`sources/ipa/`|公式PDF、取得元一覧、ハッシュ、切り出し座標、現在の内容確認記録|
|`scripts/`|画像・正解・OCRの抽出、画像一覧、データ検証、PagesのHTML配置|
|`tests/`|採点・保存のテスト、主要操作のブラウザテスト|
|`docs/product.md`|現行の製品仕様|
|`specs/`|初回開発とリリース後の改修案件・内容確認記録|
|`.devcontainer/`|ホストを変更しない開発環境|
|`.github/workflows/`|検証と、手動実行するPages公開|

単一アプリとして管理します。モノレポ、独立パッケージ、DB、認証、実行時の解説生成は設けていません。

## 過去問の追加・修正

1. `specs/`に改修案件を作り、必要なら`docs/product.md`を更新します。
2. `sources/ipa/manifest.json`の公式URLから問題と正解PDFを取得し、対応する年度フォルダに保存します。原本は編集しません。
3. PDFを目視し、`crops.json`に各問のページ番号（1始まり）と切り出し座標（PDFポイント）を記録します。
4. コンテナ内で抽出します。

```bash
python scripts/extract_exam.py 2025-r07-aki --ocr
python scripts/review_images.py 2025-r07-aki
```

画像は`public/data/<id>/`、OCRの下書きと抽出した正解は`test-results/extraction/<id>/`、確認用画像一覧は`test-results/image-review/<id>/`に作られます。下書きを進行中の案件に保存したい場合は`--review-dir specs/0001-initial-release/review/extraction`のように指定します。完了案件は指定しません。抽出は執筆済みの`questions.json`や内容確認記録を上書きしません。

5. OCRを原本と照合して`questions.json`の補助テキストを整え、正解・解説・参考資料を記録します。補助テキストは意味を保った要約を含み、図表は原画像を参照します。アプリの出題本文は原画像です。誤答の計算過程は推測しません。
6. 執筆後の別工程で、原画像、転記、公式正解、各肢の解説、計算、出題当時の版・制度を確認します。現在の内容確認記録は`sources/ipa/<id>/review.json`に保存し、その写しを進行中の案件の`review/<id>.json`に残します（初回案件の記録を雛形にできます）。実際に確認した後で、`questions.json`のSHA-256を`dataSha256`、各画像のSHA-256を`imagesSha256`に記録します。内容を変更すると再確認が必要です。既存データの修正では、現在の記録を更新して新しい案件に写しと修正理由を残し、完了済みの過去案件は変更しません。
7. 確認が済んだ年度だけ`public/data/index.json`に追加します。問題の年度ID・番号は進捗保存に使うため、変更しません。
8. データ検証・テスト・ビルドを実行し、改修案件に結果を記録します。

完了した案件は書き換えず、次の改修は新しい番号の案件にします。手順・雛形は[specs/README.md](specs/README.md)を参照してください。

## GitHub Pagesへの公開

リポジトリは`rabut001/project-manager-training-1`、公開パスは`/project-manager-training-1/`です。Viteの`base`もこのパスに設定しています。名前や公開パスを変える場合は`vite.config.ts`とブラウザテストのURLを合わせて変更してください。

更新を`main`にpushし、[Actionsの公開ワークフロー](https://github.com/rabut001/project-manager-training-1/actions/workflows/pages.yml)から「Run workflow」を実行します。PagesのSourceはGitHub Actionsを使います。公開ワークフローでは、次の検証で全17回の収録と確認記録を必須にします。

```bash
python scripts/validate_data.py --release
```

通常のCIは収録済み範囲を検証します。CIでも同じ開発コンテナを構築し、依存導入・ビルド・テストをその中で実行します。公開ワークフローは全回検証、テスト、ビルドを通した`dist/`だけを配信します。

GitHub CLIを使用する場合もコンテナ内に導入・実行し、WSL2のLinux本体には導入しません。ブラウザ認証は利用者本人が行い、認証情報はリポジトリへ保存しません。

問題・正解の出典は[IPAの過去問題](https://www.ipa.go.jp/shiken/mondai-kaiotu/index.html)。解説はこのアプリで作成したもので、IPAの公式解説ではありません。各問の参考資料と確認記録はリポジトリに保存しています。
