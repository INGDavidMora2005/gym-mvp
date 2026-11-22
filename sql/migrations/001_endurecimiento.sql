-- ============================================================================
-- Migración 001 - Endurecimiento de seguridad
--
-- Para bases de datos YA existentes creadas con el esquema anterior.
-- Es idempotente: se puede ejecutar varias veces sin fallar.
--
-- Qué hace:
--   - Habilita RLS en las 4 tablas (deny-all: sin políticas para clientes).
--   - Elimina las políticas antiguas de "authenticated".
--   - Revoca todos los permisos de anon y authenticated.
--   - Elimina la vista, el trigger y la función obsoletos.
--   - Retira la columna de contraseña que ya no se usa (Auth la gestiona).
--   - Actualiza los defaults de id a gen_random_uuid().
--   - Crea el índice único de email sin distinguir mayúsculas.
--
-- No agrega NOT NULL ni CHECK nuevos: eso podría fallar con datos existentes.
-- ============================================================================

begin;

-- 1. RLS deny-all en las 4 tablas
alter table if exists public.owners enable row level security;
alter table if exists public.clients enable row level security;
alter table if exists public.membership_payments enable row level security;
alter table if exists public.attendance enable row level security;

-- 2. Eliminar las 8 políticas antiguas (si existen)
drop policy if exists "authenticated can view clients" on public.clients;
drop policy if exists "authenticated can create clients" on public.clients;
drop policy if exists "authenticated can update clients" on public.clients;
drop policy if exists "authenticated can delete clients" on public.clients;

drop policy if exists "authenticated can view payments" on public.membership_payments;
drop policy if exists "authenticated can create payments" on public.membership_payments;

drop policy if exists "authenticated can view attendance" on public.attendance;
drop policy if exists "authenticated can create attendance" on public.attendance;

-- 3. Revocar acceso directo a los roles públicos
revoke all on table
  public.owners,
  public.clients,
  public.membership_payments,
  public.attendance
from anon, authenticated;

-- 4. Eliminar objetos obsoletos
drop view if exists public.client_membership_status;

drop trigger if exists on_auth_user_created on auth.users;
drop function if exists public.handle_new_user();

-- 5. Retirar la columna de contraseña (Supabase Auth es la fuente de verdad)
alter table public.owners drop column if exists password_hash;

-- 6. Defaults de id con gen_random_uuid()
alter table public.owners alter column id set default gen_random_uuid();
alter table public.clients alter column id set default gen_random_uuid();
alter table public.membership_payments alter column id set default gen_random_uuid();
alter table public.attendance alter column id set default gen_random_uuid();

-- 7. Email único sin distinguir mayúsculas/minúsculas
create unique index if not exists owners_email_lower_idx
  on public.owners (lower(email));

commit;
