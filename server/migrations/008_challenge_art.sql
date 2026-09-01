ALTER TABLE challenges
  ADD COLUMN IF NOT EXISTS image_key TEXT;

UPDATE challenges
SET image_key = CASE sort_order
  WHEN 1 THEN 'strategy'
  WHEN 2 THEN 'fan-command'
  WHEN 3 THEN 'logistics'
  ELSE 'innovation'
END
WHERE image_key IS NULL OR image_key = '';

ALTER TABLE challenges
  ALTER COLUMN image_key SET DEFAULT 'strategy',
  ALTER COLUMN image_key SET NOT NULL;
