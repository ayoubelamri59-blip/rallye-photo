-- ============================================
-- MIGRATION : file de défis par équipe + mot de passe admin
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- Stocke l'ordre (mélangé) des IDs de défis assignés à chaque équipe.
-- C'est un tableau JSON d'UUIDs, ex: ["uuid1", "uuid2", "uuid3"]
-- Quand un défi est refusé, son ID est retiré puis ré-ajouté en fin de tableau.
alter table teams add column if not exists challenge_queue jsonb default '[]'::jsonb;

-- Index pour accélérer les recherches de jeu par code (si pas déjà fait)
create index if not exists idx_games_code on games(party_code);
