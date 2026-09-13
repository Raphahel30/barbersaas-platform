-- 1. Covering index for reviews(order_id)
create index if not exists idx_reviews_order_id on public.reviews(order_id);

-- 2. Restrict execution on internal security definer functions from public/anon API
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.rls_auto_enable() from public, anon, authenticated;

-- Allow only authenticated users to call is_admin
revoke execute on function public.is_admin() from public, anon;
grant execute on function public.is_admin() to authenticated;
