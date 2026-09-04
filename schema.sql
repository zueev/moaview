-- 개인용 단일 사용자 저장소.
CREATE TABLE IF NOT EXISTS campaigns (
  id      TEXT PRIMARY KEY,
  title   TEXT NOT NULL,
  platform TEXT NOT NULL,
  url     TEXT NOT NULL,
  kind    TEXT NOT NULL,
  status  TEXT NOT NULL,
  due     TEXT NOT NULL,
  notes   TEXT NOT NULL,
  tasks   TEXT NOT NULL,
  source  TEXT NOT NULL DEFAULT 'manual',
  created TEXT NOT NULL,
  updated TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON campaigns(status);
CREATE UNIQUE INDEX IF NOT EXISTS idx_campaigns_url ON campaigns(url) WHERE url <> '';

-- 갱신되는 29CM refresh_token 등, 실행 사이에 남겨야 하는 값.
CREATE TABLE IF NOT EXISTS store (
  key     TEXT PRIMARY KEY,
  value   TEXT NOT NULL,
  updated TEXT NOT NULL
);
