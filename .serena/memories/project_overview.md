# Homurun Game - Project Overview

## Purpose
HTML/CSS/JavaScriptで作成するホームラン（野球）ゲーム。
GitHub Pagesで公開し、学校のゲーム制作課題として提出する。

## Deadline
- **提出期限**: 2025/2/5(木) 15:00
- **公開URL形式**: `https://USERNAME.github.io/REPO/`

## Constraints
- AIを使用しての開発可（ただし企画は自分たちで考える）
- 過去作品の使いまわし禁止
- ネット上のコードの完コピ禁止
- 公序良俗に反するものは禁止

## Tech Stack
- **HTML5**: ページ構造
- **CSS3**: スタイリング、アニメーション
- **JavaScript (Vanilla)**: ゲームロジック、Canvas API
- **Planck.js**: 2D物理エンジン (Box2Dベース、CDN経由)
- **No build tools**: 直接ブラウザで実行可能

## File Structure
```
homurun-game/
├── index.html      # メインHTMLファイル（エントリーポイント）
├── style.css       # スタイルシート
├── game.js         # ゲームロジック
└── README.md       # プロジェクト説明
```

## Game Concept
スマブラのホームランコンテスト風ゲーム。

### ゲームフロー
1. 制限時間10秒でサンドバッグ（坪内先生）を殴ってダメージを溜める
2. スペースキーでバットスイング（吹っ飛ばし）
3. Planck.js物理エンジンでリアルな放物線
4. 飛距離を計測

### 操作方法
- `A` / `←` : 左パンチ
- `D` / `→` : 右パンチ
- `SPACE` : バットスイング（吹っ飛ばし）

### Scoring
- ダメージ％が高いほど飛距離が伸びる
- 最終飛距離(m)がスコア