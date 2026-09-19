# お上手どすなぁ

Jev を使った、京言葉の嫌味バトルゲームです。画面に表示された場面に合わせて、褒め言葉の形を保ったまま、相手に悟られにくい嫌味を入力します。

アプリ本体はこのリポジトリに収めています。

## 起動方法

Node.js 22 以上と、TypeSafe AI の API キーを環境変数 `TYPESAFE_API_KEY` に設定したシェルが必要です。

```sh
npm start
```

起動すると `http://127.0.0.1:4173` でサーバーを開き、macOS ではブラウザも開きます。ブラウザを自動で開かない場合は次のようにします。

```sh
NO_OPEN=1 npm start
```

ポートを変える場合は `PORT=5173 npm start` を使います。API キーはサーバーから Jev に送るときだけ使い、ブラウザへは渡しません。

## 遊び方

相手は次の6人です。

1. 純真無垢な小学生
2. ちょっとやんちゃしてる中学生
3. 少し背伸びした高校生
4. 社会がなんとなくわかってきた大学生
5. 立派な社会人
6. 京都人

各相手と3ラウンド戦い、2勝以上で次の相手へ進みます。全員を突破するとエンディングです。通信に失敗したラウンドは消費せず、敗北した場合は同じ相手に再挑戦できます。

## 判定の仕組み

1ラウンドにつき、Jev に次の3つを別々に問い合わせます。

- 場面と隠したい本音に、入力文が結びついているか
- 入力文が表面上は褒め言葉として成立しているか
- 相手が好意・敵意・判断困難のどれとして受け取るか

本音を知る審査用の情報は、対戦相手の判定には渡しません。場面に合う嫌味として成立し、相手が敵意を確率0.7以上で選ばなければラウンド勝利です。相手が判断に迷った場合も、隠し通せたものとして扱います。

ラウンド後と対戦後の文章は生成させず、キャラクターごとに用意した候補から Jev に選ばせます。候補文、画像パターン、過去ラウンドの場面・入力・勝敗を渡して、状況に合う反応を選びます。

## 開発とテスト

外部パッケージは使っていません。

```sh
npm test
```

実 API を使う検証は API 利用料が発生します。環境変数を設定したシェルで、必要なときだけ実行してください。

```sh
node scripts/verify-game.mjs
node scripts/verify-playthrough.mjs
```

`verify-game.mjs` は判定ルールと役柄を実 API で確認し、`verify-playthrough.mjs` は HTTP サーバーを通して18ラウンドを最後まで進めます。実行結果は `results/` に保存されますが、結果ファイルは Git に含めません。

## ディレクトリ

- `src/` — ゲームルール、Jev 呼び出し、HTTP サーバー
- `web/` — ブラウザ画面、スタイル、キャラクター画像
- `fixtures/` — 検証用の入力例
- `scripts/` — 起動・検証スクリプト
- `test/` — API 呼び出しを模擬した回帰テスト
- `reports/` — 検証結果、設計検討、デモ入力
- `results/` — ローカル検証時に生成される応答。`.gitignore` 対象

## レポート

- [ゲーム判定の修正と実測](reports/BALANCE_FIX_REPORT.md)
- [デモ用入力例](reports/WALKTHROUGH.md)
- [初期バランス監査](reports/BALANCE_AUDIT.md)
- [初期実験レポート](reports/REPORT.md)
- [役柄比較](reports/PERSONA_REPORT.md)
- [段階的ヒントの検証](reports/PROGRESSIVE_HINT_REPORT.md)
- [シチュエーションなしの検証](reports/NO_SCENE_REPORT.md)
- [京都人ロールの検証](reports/KYOTO_SPECIAL_REPORT.md)
- [対象を絞った文脈の検証](reports/TARGETED_CONTEXT_REPORT.md)
- [キャラクター画像の生成記録](reports/CHARACTER_ART_PROMPTS.md)

## 一次資料

- [TypeSafe AI HTTP API](https://docs.typesafe.ai/api)
- [Choice](https://docs.typesafe.ai/primitives/choice)
- [Confidence と確率の違い](https://docs.typesafe.ai/confidence)
- [モデルと言語対応](https://docs.typesafe.ai/models)
- [Jev 1.13 の既知の制約](https://docs.typesafe.ai/model-jaggedness/jev-1.13)

Jev の日本語や間接表現の判定精度は、実際の入力とモデルの応答に依存します。検証結果は今回用意した例についての記録であり、京都の人々や京言葉全体への一般化ではありません。
