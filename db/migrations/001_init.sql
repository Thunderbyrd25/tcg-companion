CREATE TABLE IF NOT EXISTS sets (
  id TEXT PRIMARY KEY,
  scrydex_id TEXT,
  name TEXT NOT NULL,
  ptcgo_code TEXT,
  series TEXT,
  total INT,
  printed_total INT,
  release_date DATE,
  data JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS cards (
  id TEXT PRIMARY KEY,
  scrydex_id TEXT NOT NULL,
  name TEXT NOT NULL,
  set_id TEXT REFERENCES sets(id),
  ptcgo_code TEXT,
  number TEXT,
  release_date DATE,
  national_pokedex_numbers INT[] NOT NULL DEFAULT '{}',
  legalities_standard TEXT,
  legalities_expanded TEXT,
  regulation_mark TEXT,
  data JSONB NOT NULL,
  raw_scrydex JSONB NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_cards_name ON cards (name);
CREATE INDEX IF NOT EXISTS idx_cards_set_id ON cards (set_id);
CREATE INDEX IF NOT EXISTS idx_cards_ptcgo_number ON cards (ptcgo_code, number);
CREATE INDEX IF NOT EXISTS idx_cards_pokedex ON cards USING gin (national_pokedex_numbers);

CREATE TABLE IF NOT EXISTS refresh_metadata (
  card_id TEXT PRIMARY KEY REFERENCES cards(id),
  scrydex_id TEXT NOT NULL,
  tier TEXT NOT NULL,
  last_refreshed_at TIMESTAMPTZ,
  next_due_at TIMESTAMPTZ NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_refresh_due ON refresh_metadata (next_due_at);
