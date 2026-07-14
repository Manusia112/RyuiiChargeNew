-- Tambahkan kolom mapping Digiflazz ke tabel categories
ALTER TABLE categories ADD COLUMN IF NOT EXISTS digiflazz_category TEXT;
ALTER TABLE categories ADD COLUMN IF NOT EXISTS markup_percent NUMERIC DEFAULT 20;
