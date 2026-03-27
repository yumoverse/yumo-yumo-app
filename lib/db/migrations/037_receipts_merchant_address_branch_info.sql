-- Migration 037: receipts tablosuna merchant_address ve branch_info sütunları ekle
-- Bu sütunlar receipt_data JSONB içindeki merchant.address ve branchInfo'yu
-- doğrudan sorgulanabilir kolonlara taşır.

ALTER TABLE receipts
  ADD COLUMN IF NOT EXISTS merchant_address text,
  ADD COLUMN IF NOT EXISTS branch_info       text;

-- Mevcut kayıtları receipt_data'dan backfill et
UPDATE receipts
SET
  merchant_address = COALESCE(
    receipt_data->>'merchantAddress',
    receipt_data->'merchant'->>'address'
  ),
  branch_info = receipt_data->>'branchInfo'
WHERE
  (
    receipt_data->>'merchantAddress' IS NOT NULL
    OR receipt_data->'merchant'->>'address' IS NOT NULL
    OR receipt_data->>'branchInfo' IS NOT NULL
  )
  AND (merchant_address IS NULL OR branch_info IS NULL);

-- Index: merchant bazlı konum sorguları için
CREATE INDEX IF NOT EXISTS idx_receipts_merchant_address
  ON receipts (merchant_address)
  WHERE merchant_address IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_receipts_branch_info
  ON receipts (branch_info)
  WHERE branch_info IS NOT NULL;
