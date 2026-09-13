-- =====================================================================
-- SCHÉMA DE LA BASE DE DONNÉES — Mail Interne
-- -----------------------------------------------------------------
-- À exécuter une seule fois dans l'éditeur SQL de Supabase
-- (Table Editor -> SQL Editor -> colle ce fichier -> Run)
-- =====================================================================

create table if not exists users (
  id serial primary key,
  username text unique not null,
  password_hash text not null,
  created_at timestamptz not null default now()
);

create table if not exists messages (
  id serial primary key,
  sender_id integer not null references users(id),
  recipient_id integer not null references users(id),
  subject text not null default '(Sans objet)',
  body text not null default '',
  is_read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists idx_messages_recipient on messages(recipient_id);
create index if not exists idx_messages_sender on messages(sender_id);
