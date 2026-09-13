-- 1. EXTENSIONS
create extension if not exists "uuid-ossp";
create extension if not exists "pgcrypto";

-- 2. ENUMS
do $$ begin
  if not exists (select 1 from pg_type where typname = 'user_role') then
    create type user_role as enum ('buyer', 'seller', 'admin');
  end if;
  if not exists (select 1 from pg_type where typname = 'user_status') then
    create type user_status as enum ('active', 'suspended', 'pending_verification');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_type') then
    create type listing_type as enum ('service', 'product');
  end if;
  if not exists (select 1 from pg_type where typname = 'pricing_type') then
    create type pricing_type as enum ('per_person', 'per_day', 'per_event', 'fixed_price');
  end if;
  if not exists (select 1 from pg_type where typname = 'listing_status') then
    create type listing_status as enum ('active', 'paused', 'draft', 'pending_review', 'rejected');
  end if;
  if not exists (select 1 from pg_type where typname = 'order_status') then
    create type order_status as enum (
      'pending_payment',
      'payment_confirmed',
      'in_progress',
      'completed_pending_approval',
      'completed',
      'cancellation_requested',
      'cancelled'
    );
  end if;
end $$;

-- 3. PROFILES TABLE
create table if not exists public.profiles (
  id uuid references auth.users on delete cascade primary key,
  email text unique not null,
  full_name text not null,
  avatar_url text,
  phone text,
  document text,
  account_type text default 'PF' check (account_type in ('PF', 'PJ')),
  trade_name text,
  corporate_name text,
  address text,
  location text,
  role user_role default 'buyer' not null,
  status user_status default 'active' not null,
  total_spent numeric(12, 2) default 0.00,
  total_earnings numeric(12, 2) default 0.00,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. CATEGORIES TABLE
create table if not exists public.categories (
  id text primary key,
  name text not null,
  slug text unique not null,
  icon_name text not null,
  subcategories text[] default '{}',
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. LISTINGS TABLE
create table if not exists public.listings (
  id uuid default gen_random_uuid() primary key,
  user_id uuid references public.profiles(id) on delete cascade not null,
  title text not null,
  code text,
  category text not null,
  subcategory text,
  type listing_type default 'service' not null,
  price numeric(10, 2) not null check (price >= 0),
  pricing_type pricing_type default 'per_event' not null,
  travel_fee numeric(10, 2) default 0.00,
  deposit_fee numeric(10, 2) default 0.00,
  description text not null,
  included_items text[] default '{}',
  requirements text,
  available_extras jsonb default '[]'::jsonb,
  availability text[] default '{}',
  images text[] default '{}' not null,
  youtube_video_url text,
  location text not null,
  rating numeric(3, 2) default 5.00,
  reviews_count integer default 0,
  status listing_status default 'pending_review' not null,
  moderation_notes text,
  is_featured boolean default false,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. ORDERS TABLE
create table if not exists public.orders (
  id uuid default gen_random_uuid() primary key,
  contract_code text,
  buyer_id uuid references public.profiles(id) on delete cascade not null,
  buyer_name text,
  buyer_email text,
  seller_id uuid references public.profiles(id) on delete cascade not null,
  seller_name text not null,
  seller_email text,
  listing_id uuid references public.listings(id) on delete set null,
  listing_title text not null,
  listing_image text not null,
  category text not null,
  order_date date default current_date not null,
  event_date date not null,
  event_time text,
  event_location text not null,
  total_amount numeric(10, 2) not null check (total_amount >= 0),
  platform_fee numeric(10, 2) default 0.00,
  quantity_or_guests integer default 1 not null,
  selected_extras jsonb default '[]'::jsonb,
  payment_method text,
  status order_status default 'pending_payment' not null,
  has_unread_messages boolean default false,
  notes text,
  cancellation_reason text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  updated_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 7. MESSAGES TABLE
create table if not exists public.messages (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  sender_id uuid references public.profiles(id) on delete cascade not null,
  receiver_id uuid references public.profiles(id) on delete cascade not null,
  content text not null,
  is_read boolean default false not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 8. REVIEWS TABLE
create table if not exists public.reviews (
  id uuid default gen_random_uuid() primary key,
  order_id uuid references public.orders(id) on delete cascade,
  listing_id uuid references public.listings(id) on delete cascade not null,
  reviewer_id uuid references public.profiles(id) on delete cascade not null,
  rating integer not null check (rating >= 1 and rating <= 5),
  comment text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 9. INDEXES ON FOREIGN KEYS AND SEARCH COLUMNS
create index if not exists idx_listings_user_id on public.listings(user_id);
create index if not exists idx_listings_status on public.listings(status);
create index if not exists idx_listings_category on public.listings(category);

create index if not exists idx_orders_buyer_id on public.orders(buyer_id);
create index if not exists idx_orders_seller_id on public.orders(seller_id);
create index if not exists idx_orders_listing_id on public.orders(listing_id);
create index if not exists idx_orders_status on public.orders(status);

create index if not exists idx_messages_order_id on public.messages(order_id);
create index if not exists idx_messages_sender_id on public.messages(sender_id);
create index if not exists idx_messages_receiver_id on public.messages(receiver_id);

create index if not exists idx_reviews_listing_id on public.reviews(listing_id);
create index if not exists idx_reviews_reviewer_id on public.reviews(reviewer_id);

-- 10. HELPER FUNCTIONS & TRIGGERS
create or replace function public.is_admin()
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
begin
  return exists (
    select 1 from public.profiles
    where id = (select auth.uid()) and role = 'admin'
  );
end;
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (
    id,
    email,
    full_name,
    avatar_url,
    phone,
    document,
    account_type,
    trade_name,
    corporate_name,
    address,
    role,
    status
  ) values (
    new.id,
    coalesce(new.email, ''),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'corporate_name',
      new.raw_user_meta_data->>'trade_name',
      split_part(new.email, '@', 1)
    ),
    coalesce(new.raw_user_meta_data->>'avatar_url', ''),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'document',
    coalesce(new.raw_user_meta_data->>'account_type', 'PF'),
    new.raw_user_meta_data->>'trade_name',
    new.raw_user_meta_data->>'corporate_name',
    new.raw_user_meta_data->>'address',
    case 
      when new.raw_user_meta_data->>'role' = 'seller' then 'seller'::public.user_role
      when new.raw_user_meta_data->>'role' = 'admin' then 'admin'::public.user_role
      else 'buyer'::public.user_role
    end,
    'active'::public.user_status
  )
  on conflict (id) do update set
    email = excluded.email,
    full_name = excluded.full_name,
    phone = coalesce(excluded.phone, public.profiles.phone),
    document = coalesce(excluded.document, public.profiles.document),
    account_type = coalesce(excluded.account_type, public.profiles.account_type),
    trade_name = coalesce(excluded.trade_name, public.profiles.trade_name),
    corporate_name = coalesce(excluded.corporate_name, public.profiles.corporate_name),
    address = coalesce(excluded.address, public.profiles.address),
    updated_at = timezone('utc'::text, now());
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- 11. ROW LEVEL SECURITY (RLS)
alter table public.profiles enable row level security;
alter table public.categories enable row level security;
alter table public.listings enable row level security;
alter table public.orders enable row level security;
alter table public.messages enable row level security;
alter table public.reviews enable row level security;

-- Profiles Policies
create policy "Perfis sao publicos para leitura" 
  on public.profiles for select 
  to anon, authenticated
  using (true);

create policy "Usuarios podem criar seu proprio perfil" 
  on public.profiles for insert 
  to authenticated 
  with check ((select auth.uid()) = id or public.is_admin());

create policy "Usuarios podem atualizar seu proprio perfil" 
  on public.profiles for update 
  to authenticated 
  using ((select auth.uid()) = id or public.is_admin())
  with check ((select auth.uid()) = id or public.is_admin());

-- Categories Policies
create policy "Categorias sao publicas para leitura" 
  on public.categories for select 
  to anon, authenticated
  using (true);

create policy "Apenas admins podem inserir categorias" 
  on public.categories for insert 
  to authenticated 
  with check (public.is_admin());

create policy "Apenas admins podem atualizar categorias" 
  on public.categories for update 
  to authenticated 
  using (public.is_admin())
  with check (public.is_admin());

create policy "Apenas admins podem remover categorias" 
  on public.categories for delete 
  to authenticated 
  using (public.is_admin());

-- Listings Policies
create policy "Anuncios ativos sao visiveis por todos" 
  on public.listings for select 
  to anon, authenticated
  using (status = 'active' or (select auth.uid()) = user_id or public.is_admin());

create policy "Vendedores e admins podem criar anuncios" 
  on public.listings for insert 
  to authenticated 
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "Vendedores e admins podem atualizar anuncios" 
  on public.listings for update 
  to authenticated 
  using ((select auth.uid()) = user_id or public.is_admin())
  with check ((select auth.uid()) = user_id or public.is_admin());

create policy "Vendedores e admins podem excluir anuncios" 
  on public.listings for delete 
  to authenticated 
  using ((select auth.uid()) = user_id or public.is_admin());

-- Orders Policies
create policy "Partes do pedido e admins podem ver pedidos" 
  on public.orders for select 
  to authenticated 
  using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id or public.is_admin());

create policy "Compradores e admins podem criar pedidos" 
  on public.orders for insert 
  to authenticated 
  with check ((select auth.uid()) = buyer_id or public.is_admin());

create policy "Partes do pedido e admins podem atualizar pedidos" 
  on public.orders for update 
  to authenticated 
  using ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id or public.is_admin())
  with check ((select auth.uid()) = buyer_id or (select auth.uid()) = seller_id or public.is_admin());

-- Messages Policies
create policy "Participantes e admins podem visualizar mensagens" 
  on public.messages for select 
  to authenticated 
  using ((select auth.uid()) = sender_id or (select auth.uid()) = receiver_id or public.is_admin());

create policy "Remetentes podem enviar mensagens" 
  on public.messages for insert 
  to authenticated 
  with check ((select auth.uid()) = sender_id or public.is_admin());

-- Reviews Policies
create policy "Avaliacoes sao publicas para leitura" 
  on public.reviews for select 
  to anon, authenticated
  using (true);

create policy "Compradores podem criar avaliacoes" 
  on public.reviews for insert 
  to authenticated 
  with check ((select auth.uid()) = reviewer_id or public.is_admin());

-- 12. SEED INITIAL CATEGORIES
insert into public.categories (id, name, slug, icon_name, subcategories)
values
  ('gastronomia', 'Gastronomia', 'gastronomia', 'Utensils', ARRAY[
    'Buffet Completo', 'Churrasco & Parrilla', 'Finger Food & Canapés', 
    'Doces Finos & Bolos', 'Chef a Domicílio', 'Bartenders & Coquetelaria', 
    'Coffee Break Corporativo', 'Food Trucks & Ilhas Gastronômicas'
  ]),
  ('profissionais', 'Profissionais', 'profissionais', 'Users', ARRAY[
    'Recepcionistas & Cerimonialistas', 'Garçons & Copeiras', 'Seguranças Especializados', 
    'Fotógrafos de Eventos', 'Videomakers & Editores', 'DJs & Sonoplastas', 
    'Recreadores & Animadores', 'Mestres de Cerimônias'
  ]),
  ('compras-bebidas', 'Compras e Bebidas', 'compras-bebidas', 'Wine', ARRAY[
    'Chopp Artesanal & Cervejas', 'Vinhos & Espumantes', 'Destilados Premium', 
    'Gelo, Carvão & Suprimentos', 'Refrigerantes & Sucos Naturais', 
    'Descartáveis Ecológicos', 'Copos & Taças Personalizadas'
  ]),
  ('espaco-locacao', 'Espaço e Locação', 'espaco-locacao', 'Home', ARRAY[
    'Salões de Festas Elegantes', 'Sítios & Chácaras para Casamento', 
    'Rooftops & Espaços Urbanos', 'Tendas, Galpões & Coberturas', 
    'Mesas, Cadeiras & Louças', 'Pistas de Dança & Tablados'
  ]),
  ('decoracao', 'Decoração', 'decoracao', 'Sparkles', ARRAY[
    'Flores & Arranjos Sofisticados', 'Painéis & Arcos de Balões', 
    'Cenografia Temática', 'Iluminação Cênica & Varal de Luzes', 
    'Lounges & Mobiliário para Eventos', 'Toalhas, Guardanapos & Passadeiras'
  ]),
  ('infantil', 'Infantil', 'infantil', 'Baby', ARRAY[
    'Brinquedos Infláveis & Tobogãs', 'Cama Elástica & Piscina de Bolinhas', 
    'Maquiagem Artística & Tatuagem Infantil', 'Oficinas Criativas & Slime', 
    'Personagens Vivos & Cosplays', 'Carrinho de Pipoca & Algodão Doce'
  ]),
  ('musica', 'Música', 'musica', 'Music', ARRAY[
    'Bandas de Baile & Covers', 'Cantores Solo & Acústico', 
    'DJs com Estrutura de Som', 'Quarteto de Cordas / Cerimônia', 
    'Saxofonista & Violino para Recepção', 'Grupos de Pagode & Samba'
  ]),
  ('vestuario', 'Vestuário', 'vestuario', 'Shirt', ARRAY[
    'Vestidos de Noiva & Madrinhas', 'Trajes a Rigor & Smoking Masculino', 
    'Fantasias & Adereços de Festa', 'Acessórios & Adornos', 
    'Camareiras & Ajustes Rápidos', 'Locação de Ternos & Vestidos'
  ])
on conflict (id) do update set
  name = excluded.name,
  slug = excluded.slug,
  icon_name = excluded.icon_name,
  subcategories = excluded.subcategories;
