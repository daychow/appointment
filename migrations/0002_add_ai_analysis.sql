-- AI 分析結果儲存
CREATE TABLE IF NOT EXISTS ai_analysis (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    analysis_type TEXT NOT NULL,
    content TEXT NOT NULL,
    data_snapshot TEXT,
    created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- AI 設定
CREATE TABLE IF NOT EXISTS ai_config (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
);

-- 插入預設設定
INSERT OR IGNORE INTO ai_config (key, value) VALUES ('openrouter_model', 'minimax/minimax-m2.5:free');
INSERT OR IGNORE INTO ai_config (key, value) VALUES ('openrouter_api_key', '');
