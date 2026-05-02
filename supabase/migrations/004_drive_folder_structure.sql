-- Track Drive folder per account dimension
ALTER TABLE public.dimensions ADD COLUMN IF NOT EXISTS drive_folder_id text;

-- Store folder IDs for exports and to-process roots
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS drive_exports_id text;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS drive_to_process_id text;

-- Track year-based receipt subfolders (one row per account×year)
CREATE TABLE IF NOT EXISTS public.drive_year_folders (
  user_id         uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  dimension_id    uuid NOT NULL REFERENCES public.dimensions(id) ON DELETE CASCADE,
  year            integer NOT NULL,
  drive_folder_id text NOT NULL,
  created_at      timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, dimension_id, year)
);
ALTER TABLE public.drive_year_folders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "drive_year_folders: own rows"
  ON public.drive_year_folders FOR ALL
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
