# Suggested Commands

## Development

### ローカルでの実行
```bash
# シンプルなHTTPサーバーを起動（Python 3）
python3 -m http.server 8000

# または npx を使用
npx serve .

# ブラウザで開く
open http://localhost:8000
```

### ファイルを直接開く
```bash
# macOS
open index.html
```

## Git Operations

### 基本的なコミット
```bash
git add .
git commit -m "メッセージ"
git push origin main
```

### GitHub Pages用にプッシュ
```bash
git push origin main
# GitHub設定でPages有効化後、自動デプロイ
```

## System Utilities (macOS/Darwin)

```bash
# ファイル検索
find . -name "*.js"

# テキスト検索
grep -r "function" .

# ディレクトリ構造表示
ls -la

# ファイル内容確認
cat game.js
```

## GitHub Pages Setup
1. GitHubリポジトリの Settings > Pages
2. Source: Deploy from a branch
3. Branch: main, / (root)
4. Save

公開URL: `https://junhat6.github.io/homurun-game/`
