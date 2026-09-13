create or replace function public.is_admin()
returns boolean
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
end;
$$;
