-- ============================================
-- POLICIES DE STORAGE pour le bucket "rallye-photos"
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- Autorise tout le monde à uploader des fichiers dans ce bucket
create policy "public_upload_rallye_photos"
on storage.objects for insert
to public
with check (bucket_id = 'rallye-photos');

-- Autorise tout le monde à lire/voir les fichiers de ce bucket
create policy "public_read_rallye_photos"
on storage.objects for select
to public
using (bucket_id = 'rallye-photos');

-- Autorise tout le monde à mettre à jour les fichiers de ce bucket
-- (utile si une équipe reprend une photo pour le même défi)
create policy "public_update_rallye_photos"
on storage.objects for update
to public
using (bucket_id = 'rallye-photos');
