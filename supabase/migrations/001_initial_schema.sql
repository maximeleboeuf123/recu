-- ============================================================
-- Récu — Initial Schema
-- ============================================================

-- ------------------------------------------------------------
-- 1. users
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.users (
  id                  uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email               text NOT NULL,
  plan                text NOT NULL DEFAULT 'free',
  language            text NOT NULL DEFAULT 'fr',
  drive_folder_id     text,
  drive_inbox_id      text,
  email_inbox_address text,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users: own row"
  ON public.users
  FOR ALL
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ------------------------------------------------------------
-- 2. dimensions
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.dimensions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  name       text NOT NULL,
  position   integer NOT NULL,
  required   boolean NOT NULL DEFAULT false,
  active     boolean NOT NULL DEFAULT true,
  values     jsonb NOT NULL DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.dimensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "dimensions: own rows"
  ON public.dimensions
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 3. recurring_entries (must exist before receipts FK)
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.recurring_entries (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id           uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor            text NOT NULL,
  labels            jsonb NOT NULL DEFAULT '{}',
  frequency         text NOT NULL,
  interval          integer NOT NULL DEFAULT 1,
  start_date        date NOT NULL DEFAULT CURRENT_DATE,
  end_date          date,
  next_due_date     date,
  amount_type       text NOT NULL DEFAULT 'variable',
  amount            numeric(10,2),
  invoice_type      text,
  active            boolean NOT NULL DEFAULT true,
  source            text NOT NULL DEFAULT 'manual',
  detection_data    jsonb,
  last_confirmed_at timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.recurring_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "recurring_entries: own rows"
  ON public.recurring_entries
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 4. receipts
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.receipts (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  invoice_date        date,
  captured_at         timestamptz NOT NULL DEFAULT now(),
  vendor              text,
  invoice_number      text,
  description         text,
  keyword             text,
  subtotal            numeric(10,2),
  gst                 numeric(10,2),
  qst                 numeric(10,2),
  hst                 numeric(10,2),
  total               numeric(10,2),
  currency            text NOT NULL DEFAULT 'CAD',
  currency_original   text,
  amount_original     numeric(10,2),
  vendor_gst_number   text,
  vendor_qst_number   text,
  vendor_neq          text,
  vendor_bn           text,
  filename            text,
  drive_url           text,
  source              text,
  status              text NOT NULL DEFAULT 'pending',
  labels              jsonb NOT NULL DEFAULT '{}',
  extracted_raw       jsonb,
  confidence_scores   jsonb,
  edit_history        jsonb NOT NULL DEFAULT '[]',
  recurring_entry_id  uuid REFERENCES public.recurring_entries(id) ON DELETE SET NULL,
  bank_transaction_id text,
  reconciled_at       timestamptz,
  captured_by         uuid REFERENCES public.users(id) ON DELETE SET NULL,
  created_at          timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.receipts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "receipts: own rows"
  ON public.receipts
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 5. patterns
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.patterns (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  vendor_pattern text NOT NULL,
  labels         jsonb NOT NULL DEFAULT '{}',
  created_at     timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.patterns ENABLE ROW LEVEL SECURITY;

CREATE POLICY "patterns: own rows"
  ON public.patterns
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 6. audit_log
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.audit_log (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  table_name text NOT NULL,
  record_id  uuid NOT NULL,
  operation  text NOT NULL,
  old_data   jsonb,
  new_data   jsonb,
  changed_at timestamptz NOT NULL DEFAULT now(),
  user_id    uuid
);

ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY;

-- Users may only SELECT their own audit rows; trigger writes via SECURITY DEFINER
CREATE POLICY "audit_log: read own rows"
  ON public.audit_log
  FOR SELECT
  USING (auth.uid() = user_id);

-- ------------------------------------------------------------
-- 7. team_members
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.team_members (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  account_id  uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  member_id   uuid REFERENCES public.users(id) ON DELETE CASCADE,
  role        text NOT NULL DEFAULT 'reviewer',
  email       text NOT NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.team_members ENABLE ROW LEVEL SECURITY;

-- Account owner can manage their team rows
CREATE POLICY "team_members: admin full access"
  ON public.team_members
  FOR ALL
  USING (auth.uid() = account_id)
  WITH CHECK (auth.uid() = account_id);

-- Member can see their own membership rows
CREATE POLICY "team_members: member read"
  ON public.team_members
  FOR SELECT
  USING (auth.uid() = member_id);

-- ------------------------------------------------------------
-- 8. Audit trigger
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION log_receipt_changes()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.audit_log (
    table_name, record_id, operation,
    old_data, new_data, user_id
  ) VALUES (
    TG_TABLE_NAME,
    COALESCE(NEW.id, OLD.id),
    TG_OP,
    CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE row_to_json(OLD) END,
    CASE WHEN TG_OP = 'DELETE' THEN NULL ELSE row_to_json(NEW) END,
    COALESCE(NEW.user_id, OLD.user_id)
  );
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER receipts_audit
  AFTER INSERT OR UPDATE OR DELETE ON public.receipts
  FOR EACH ROW EXECUTE FUNCTION log_receipt_changes();
