-- Enforce server-side limits without changing each bucket's public/private state.

UPDATE storage.buckets
SET file_size_limit = 4194304,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
WHERE id = 'avatars';

UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
WHERE id = 'barbershop-media';

UPDATE storage.buckets
SET file_size_limit = 8388608,
    allowed_mime_types = ARRAY['image/png', 'image/jpeg', 'image/webp']::text[]
WHERE id = 'gallery';

UPDATE storage.buckets
SET file_size_limit = 10485760,
    allowed_mime_types = ARRAY['application/pdf', 'image/png', 'image/jpeg', 'image/webp']::text[]
WHERE id = 'receipts';

UPDATE storage.buckets
SET file_size_limit = 2097152,
    allowed_mime_types = ARRAY['image/png']::text[]
WHERE id = 'signatures';
