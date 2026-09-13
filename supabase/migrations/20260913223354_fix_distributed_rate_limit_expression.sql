CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_key_hash TEXT,
  p_max_requests INTEGER,
  p_window_seconds INTEGER
) RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  bucket public.rate_limit_buckets%ROWTYPE;
  now_value TIMESTAMPTZ := pg_catalog.clock_timestamp();
  reset_seconds INTEGER;
BEGIN
  IF p_key_hash !~ '^[0-9a-f]{64}$'
    OR p_max_requests < 1 OR p_max_requests > 1000
    OR p_window_seconds < 1 OR p_window_seconds > 86400 THEN
    RAISE EXCEPTION 'Invalid rate-limit parameters' USING ERRCODE = '22023';
  END IF;

  INSERT INTO public.rate_limit_buckets AS existing (
    key_hash, window_started_at, request_count, updated_at
  ) VALUES (
    p_key_hash, now_value, 1, now_value
  )
  ON CONFLICT (key_hash) DO UPDATE SET
    window_started_at = CASE
      WHEN existing.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= now_value
      THEN now_value ELSE existing.window_started_at END,
    request_count = CASE
      WHEN existing.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) <= now_value
      THEN 1 ELSE existing.request_count + 1 END,
    updated_at = now_value
  RETURNING * INTO bucket;

  reset_seconds := greatest(
    0,
    pg_catalog.ceil(extract(epoch FROM (
      bucket.window_started_at + pg_catalog.make_interval(secs => p_window_seconds) - now_value
    )))::INTEGER
  );

  RETURN pg_catalog.jsonb_build_object(
    'success', bucket.request_count <= p_max_requests,
    'count', bucket.request_count,
    'remaining', greatest(0, p_max_requests - bucket.request_count),
    'reset_seconds', reset_seconds
  );
END;
$$;

REVOKE EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER) TO anon, authenticated;
