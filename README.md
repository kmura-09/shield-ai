# ShieldAI - 機密情報フィルタ

ローカルで動作する機密情報検出・マスクツール。
外部AIサービス（ChatGPT/Claude等）に送信する前に、テキスト内の個人情報や機密情報を検出してマスクします。

## 特徴

- **ローカル完結** - データは外部に送信されません
- **日本語特化** - 日本の電話番号、住所、敬称付き名前等に対応
- **カスタム辞書** - 取引先名やプロジェクト名をNGワード登録可能
- **Microsoft Presidio ベース** - 実績のあるOSSを活用

## スクリーンショット

```
入力: 田中様（03-1234-5678）にメール info@example.com で連絡。金額は¥500,000です。
出力: [個人名]（[電話番号]）にメール [メールアドレス] で連絡。金額は[金額]です。
```

## セットアップ

### 1. バックエンド (Python)

```bash
cd backend

# 仮想環境作成
python -m venv venv
venv\Scripts\activate  # Windows
# source venv/bin/activate  # Mac/Linux

# 依存関係インストール
pip install -r requirements.txt

# spaCyモデルダウンロード
python -m spacy download en_core_web_lg

# サーバー起動
python main.py
```

サーバーは `http://127.0.0.1:8765` で起動します。

### 2. フロントエンド (Electron)

```bash
cd frontend

# 依存関係インストール
npm install

# アプリ起動
npm start
```

## 検出対象

### パターン検出（自動）

| カテゴリ | 例 |
|---------|-----|
| 敬称付き名前 | 田中様、山田さん、佐藤氏 |
| 会社名 | 株式会社ABC、XYZ Inc. |
| メールアドレス | example@test.com |
| 電話番号 | 03-1234-5678、090-1234-5678 |
| 金額 | ¥100,000、500万円 |
| 住所 | 東京都渋谷区... |
| 郵便番号 | 〒123-4567 |
| マイナンバー | 1234-5678-9012 |
| APIキー | sk-xxx...、AKIA... |
| クレジットカード | 4111-1111-1111-1111 |

### 辞書検出（登録制）

カスタム辞書に登録した単語を検出：
- 取引先名（トヨタ自動車、A社 等）
- プロジェクト名（案件X 等）
- 個人名（山田太郎 等）
- その他NGワード

## API

### POST /detect
テキストの機密情報を検出・マスク

### GET /dictionary
登録済み辞書を取得

### POST /dictionary/add
辞書に単語を追加

### POST /dictionary/import
CSVから一括インポート

### DELETE /dictionary/{value}
辞書から単語を削除

## 技術スタック

- **バックエンド**: Python, FastAPI, Microsoft Presidio
- **フロントエンド**: Electron
- **NLP**: spaCy

## ライセンス

MIT
