-- Add drive_file_id to receipts if it doesn't already exist.
-- This column stores the Google Drive file ID for the original receipt file,
-- used for Drive preview (iframe) and rename-on-confirm.
ALTER TABLE public.receipts ADD COLUMN IF NOT EXISTS drive_file_id text;
