-- ============================================================
-- Récu — Dimensions v2: hierarchical accounts + categories
-- Replace the flat v1 dimensions table with a self-referencing
-- parent_id model where accounts own sub-lists of categories.
-- ============================================================

-- Drop old table (no user data exists yet for this feature)
DROP TABLE IF EXISTS public.dimensions;

-- New hierarchical dimensions table
CREATE TABLE public.dimensions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type       text NOT NULL CHECK (type IN ('account', 'category')),
  name       text NOT NULL,
  parent_id  uuid REFERENCES public.dimensions(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimensions: own rows"
  ON public.dimensions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
