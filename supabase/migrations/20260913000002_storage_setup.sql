-- Migration para garantir o bucket público barbershop-media e políticas de acesso
INSERT INTO storage.buckets (id, name, public) 
VALUES ('barbershop-media', 'barbershop-media', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "Public Read Media" ON storage.objects;
CREATE POLICY "Public Read Media" ON storage.objects
  FOR SELECT TO anon, authenticated USING (bucket_id = 'barbershop-media');

DROP POLICY IF EXISTS "Tenant Owner Upload Media" ON storage.objects;
CREATE POLICY "Tenant Owner Upload Media" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'barbershop-media');
