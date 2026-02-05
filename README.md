# Homurun Game

タイミングよくバットを振ってホームランを打つシンプルなブラウザゲーム。

## Play

**[Play Now](https://junhat6.github.io/homurun-game/)**

## How to Play

1. ボールがピッチャーから飛んでくる
2. **スペースキー** または **クリック/タップ** でバットを振る
3. タイミングよく打ってスコアを稼ごう！

### Scoring

| 判定 | ポイント |
|------|---------|
| HOME RUN!!! | 100点 |
| Nice Hit! | 50点 |
| Foul... | 10点 |
| Strike! | 0点 |

## Tech Stack

- HTML5
- CSS3
- JavaScript (Canvas API)

## Local Development

```bash
# HTTPサーバーを起動
python3 -m http.server 8000

# ブラウザで開く
open http://localhost:8000
```

## File Structure

```
homurun-game/
├── index.html   # メインページ
├── style.css    # スタイル
├── game.js      # ゲームロジック
└── README.md    # このファイル
```
