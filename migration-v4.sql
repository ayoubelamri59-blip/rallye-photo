-- ============================================
-- MIGRATION v4 : vote séquentiel + divers
-- À exécuter dans le SQL Editor de Supabase
-- ============================================

-- État du vote séquentiel, stocké sur la partie
alter table games add column if not exists vote_challenge_id uuid references challenges(id);
alter table games add column if not exists vote_started_at timestamptz;
alter table games add column if not exists vote_duration_seconds integer default 30;
alter table games add column if not exists vote_revealed boolean default false;

-- Liste ordonnée des défis déjà votés (pour piloter "défi suivant")
alter table games add column if not exists vote_order jsonb default '[]'::jsonb;
alter table games add column if not exists vote_index integer default 0;
