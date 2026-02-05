# Code Style and Conventions

## JavaScript

### Naming Conventions
- **変数・関数**: camelCase (`gameState`, `handleSwing`)
- **定数**: UPPER_SNAKE_CASE (`CONFIG`, `MAX_SCORE`)
- **クラス**: PascalCase (`Ball`, `Batter`)

### Structure
- グローバル設定は `CONFIG` オブジェクトにまとめる
- ゲーム状態は `state` オブジェクトで管理
- クラスベースでゲームオブジェクトを定義

### Code Pattern
```javascript
// 設定
const CONFIG = {
    canvasWidth: 800,
    canvasHeight: 600
};

// 状態管理
const state = {
    score: 0,
    gameRunning: true
};

// クラス定義
class GameObject {
    constructor() { }
    update() { }
    draw() { }
}

// ゲームループ
function gameLoop() {
    // update
    // draw
    requestAnimationFrame(gameLoop);
}
```

## CSS

### Naming
- クラス名: kebab-case (`game-container`, `score-display`)
- ID: camelCase (`gameCanvas`, `scoreElement`)

### Organization
1. Reset/Base styles
2. Layout
3. Components
4. Animations

## HTML

- セマンティックな構造
- `id` はJavaScriptから参照する要素に使用
- `class` はスタイリング用
