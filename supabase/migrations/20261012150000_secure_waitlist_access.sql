-- Public waitlist registration is mediated by the validated/rate-limited Server Action.
-- Direct Data API inserts bypass those checks and are therefore disabled.

DROP POLICY IF EXISTS "waitlist public insert" ON public.waitlist;
REVOKE INSERT ON TABLE public.waitlist FROM anon, authenticated;
