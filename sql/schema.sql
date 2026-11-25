-- ============================================================================
-- Esquema de base de datos - Gimnasio MVP
--
-- Diseño service-role-only:
--   - RLS habilitado en las 4 tablas y SIN políticas para anon/authenticated.
--   - RLS sin políticas equivale a deny-all para los clientes públicos.
--   - Solo la service role (exclusivamente del servidor) accede a los datos.
--   - La anon key se usa únicamente para Supabase Auth (login).
--
-- Instalación limpia:
--   Copia y ejecuta este archivo completo en el SQL Editor de Supabase.
--
-- Cómo crear un dueño:
--   1. En Authentication > Providers > Email, desactiva "Allow new users to sign up".
--   2. En Authentication > Users, crea el usuario con su email y contraseña.
--   3. Registra el mismo email en la tabla owners, sin datos reales:
--
--        insert into owners (name, email)
--        values ('Nombre del dueño', 'email@dominio.com');
--
--   La contraseña la gestiona Supabase Auth; owners no almacena contraseñas.
--   La aplicación relaciona al dueño con el usuario por email (sin distinguir
--   mayúsculas), por eso owners.id es independiente de auth.users.id.
-- ============================================================================

-- 1. Dueños
create table if not exists public.owners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null,
  created_at timestamptz not null default now()
);

-- Unicidad del email sin distinguir mayúsculas/minúsculas.
create unique index if not exists owners_email_lower_idx
  on public.owners (lower(email));

-- 2. Clientes
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  age integer check (age is null or age between 10 and 100),
  address text,
  phone text not null unique,
  payment_method text not null check (
    payment_method in ('EFECTIVO', 'NEQUI', 'DAVPLATA', 'PSE', 'OTRO')
  ),
  consent_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- El unique de phone ya crea su propio índice; no se duplica.
create index if not exists idx_clients_active
  on public.clients (active);

-- 3. Pagos de membresía
create table if not exists public.membership_payments (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  amount_cop integer not null check (amount_cop > 0),
  paid_at timestamptz not null default now(),
  period_start timestamptz,
  period_end timestamptz,
  recorded_by text,
  note text,
  created_at timestamptz not null default now(),
  voided_at timestamptz,
  voided_by text,
  void_reason text,
  payment_method text
);

-- Constraint idempotente para payment_method
do $$
declare
  constraint_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'payments_method_check'
      and conrelid = 'public.membership_payments'::regclass
  ) into constraint_exists;

  if not constraint_exists then
    alter table public.membership_payments
      add constraint payments_method_check
      check (payment_method is null or payment_method in ('EFECTIVO','PSE','NEQUI','DAVPLATA','OTRO'));
  end if;
end $$;

create index if not exists idx_payments_client_paid_at
  on public.membership_payments (client_id, paid_at desc);

-- Índice parcial para pagos activos (no anulados)
create index if not exists idx_payments_client_active
  on public.membership_payments (client_id, paid_at desc)
  where voided_at is null;

-- Constraint de consistencia: si voided_at tiene valor, void_reason debe tener valor
alter table public.membership_payments
  add constraint payments_void_consistency
  check (voided_at is null or void_reason is not null);

-- 3c. Tabla de cierres de caja (cash_closings)
create table if not exists public.cash_closings (
  id uuid primary key default gen_random_uuid(),
  business_date date not null,
  expected_cash_cop integer not null check (expected_cash_cop >= 0),
  counted_cash_cop integer not null check (counted_cash_cop >= 0),
  difference_cop integer not null,
  note text,
  closed_by text not null,
  closed_by_id uuid references public.owners (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Índice para consultas por fecha de negocio (desc) y created_at (desc)
create index if not exists idx_cash_closings_business_date_created_at
  on public.cash_closings (business_date desc, created_at desc);

-- Habilitar RLS en cash_closings (sin políticas = deny-all)
alter table public.cash_closings enable row level security;

revoke all on table public.cash_closings from anon;
revoke all on table public.cash_closings from authenticated;

-- 3b. Tabla de auditoría
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_id uuid references public.owners (id),
  owner_name text not null,
  action text not null check (
    action in ('PAYMENT_VOIDED', 'ATTENDANCE_DELETED', 'CLIENT_DELETED', 'CASH_CLOSED')
  ),
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);

create index if not exists idx_audit_log_created_at_desc
  on public.audit_log (created_at desc);

-- 4. Asistencias
create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients (id) on delete cascade,
  check_in timestamptz not null default now(),
  note text,
  recorded_by text,
  created_at timestamptz not null default now()
);

create index if not exists idx_attendance_client_check_in
  on public.attendance (client_id, check_in desc);

create index if not exists idx_attendance_check_in
  on public.attendance (check_in desc);

-- Una asistencia por cliente y día de Bogotá (zona horaria America/Bogota).
create unique index if not exists attendance_client_day_idx
  on public.attendance (client_id, ((check_in at time zone 'America/Bogota')::date));

-- 5. Seguridad: RLS deny-all para anon/authenticated
-- No se crean políticas a propósito: la service role omite RLS y es la única
-- vía de acceso a los datos. La anon key solo se usa para autenticarse.
alter table public.owners enable row level security;
alter table public.clients enable row level security;
alter table public.membership_payments enable row level security;
alter table public.attendance enable row level security;
alter table public.audit_log enable row level security;

-- Vista resumen
create or replace view public.client_overview with (security_invoker = true) as 
with 
  valid_payments as (
    select 
      client_id, 
      paid_at, 
      period_end 
    from public.membership_payments 
    where voided_at is null
  ),
  last_payments as (
    select 
      client_id, 
      max(paid_at) as last_payment_at,
      -- Debe coincidir con getMembershipExpiration() en src/lib/utils.ts: si cambia la regla, cámbiala en ambos sitios
      max(coalesce(period_end, paid_at + interval '720 hours')) as expiration
    from valid_payments
    group by client_id
  ),
  attendances as (
    select 
      client_id, 
      max(check_in) as last_attendance,
      count(*) filter (
        where check_in >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
      ) as attendance_this_month
    from public.attendance
    group by client_id
  )
select 
  c.id as client_id,
  lp.expiration,
  lp.last_payment_at,
  a.last_attendance,
  coalesce(a.attendance_this_month, 0) as attendance_this_month
from public.clients c
left join last_payments lp on c.id = lp.client_id
left join attendances a on c.id = a.client_id
where c.active = true;

revoke all on public.client_overview from anon, authenticated;

revoke all on table
  public.owners,
  public.clients,
  public.membership_payments,
  public.attendance,
  public.audit_log
from anon, authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;
