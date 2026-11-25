-- ============================================================================
-- Migración 006 - Método de Pago en Pagos y Cierres de Caja
--
-- Qué hace:
--   1. Añade columna payment_method a membership_payments (nullable, para no tocar historial).
--   2. Añade constraint idempotente payments_method_check (EFECTIVO, PSE, NEQUI, DAVPLATA, OTRO).
--   3. Crea tabla cash_closings para cierres de caja diarios (repetibles, sin unique en business_date).
--   4. Actualiza la constraint de action en audit_log para incluir 'CASH_CLOSED'.
--
-- Idempotencia:
--   - Todas las operaciones usan IF NOT EXISTS o bloques DO que verifican existencia.
--   - La migración se puede re-ejecutar sin errores.
--
-- Cómo ejecutarla:
--   Copia y ejecuta este archivo completo en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- 1. Añadir columna payment_method a membership_payments (si no existe)
alter table if exists public.membership_payments
  add column if not exists payment_method text;

-- 2. Constraint idempotente para payment_method
-- Verifica si el constraint ya existe antes de crearlo
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

-- 3. Crear tabla cash_closings
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

-- 4. Habilitar RLS en cash_closings (sin políticas = deny-all)
alter table public.cash_closings enable row level security;

-- Revocar acceso de anon y authenticated
revoke all on table public.cash_closings from anon;
revoke all on table public.cash_closings from authenticated;

-- 5. Actualizar constraint de action en audit_log para incluir 'CASH_CLOSED'
-- Primero eliminamos la constraint existente si existe
alter table if exists public.audit_log
  drop constraint if exists audit_log_action_check;

-- Creamos la nueva constraint con las 4 acciones
alter table public.audit_log
  add constraint audit_log_action_check
  check (action in ('PAYMENT_VOIDED', 'ATTENDANCE_DELETED', 'CLIENT_DELETED', 'CASH_CLOSED'));

-- Comentario explicativo (solo para documentación)
comment on table public.cash_closings is 'Cierres de caja diarios. Se puede registrar un cierre nuevo para corregir; el último por created_at es el vigente. expected_cash_cop se calcula en el servidor sumando pagos en EFECTIVO no anulados del día de Bogotá.';

commit;