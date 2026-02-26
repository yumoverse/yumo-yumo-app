-- Add blob_url to receipts so GET /api/receipts/[id] can return it for admin download
-- (Pipeline renames blob and updates this column after analysis)
ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS blob_url TEXT;
