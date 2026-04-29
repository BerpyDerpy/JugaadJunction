-- Push Subscriptions Schema (Multi-device support)
-- Each user can have multiple push subscriptions (one per device/browser)

-- Drop old single-device table if migrating
DROP TABLE IF EXISTS public.push_subscriptions CASCADE;

CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id SERIAL PRIMARY KEY,
  roll_number VARCHAR(25) REFERENCES public."UserTable"(rollno) ON DELETE CASCADE,
  endpoint TEXT NOT NULL,
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(roll_number, endpoint)
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anon to see/insert/update/delete. Since this is an anon client, we allow it to manage subscriptions based on roll_number.
-- In a fully authenticated app, we would match auth.uid().
CREATE POLICY "Allow anon to select push subscriptions"
ON public.push_subscriptions FOR SELECT
USING (true);

CREATE POLICY "Allow anon to insert push subscriptions"
ON public.push_subscriptions FOR INSERT
WITH CHECK (true);

CREATE POLICY "Allow anon to update push subscriptions"
ON public.push_subscriptions FOR UPDATE
USING (true);

CREATE POLICY "Allow anon to delete push subscriptions"
ON public.push_subscriptions FOR DELETE
USING (true);

-- Adding a trigger to update 'updated_at' automatically
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_push_subscriptions_updated_at
BEFORE UPDATE ON public.push_subscriptions
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();
