-- Push Subscriptions Schema
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  roll_number VARCHAR(25) PRIMARY KEY REFERENCES public."UserTable"(rollno),
  subscription JSONB NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Allow anon to see/insert/update. Since this is an anon client, we allow it to manage subscriptions based on roll_number.
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
