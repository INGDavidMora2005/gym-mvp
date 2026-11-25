-- ============================================================================
-- Migración 004 - Anulaciones y Auditoría
--
-- Qué hace:
--   1. Añade columnas de anulación a membership_payments:
--      - voided_at: timestamptz, fecha y hora de la anulación (NULL si no está anulado)
--      - voided_by: text, nombre de quien anuló el pago
--      - void_reason: text, motivo de la anulación
--
--   2. Crea constraint (payments_void_consistency) que garantiza que
--      si voided_at es NOT NULL, entonces void_reason NO puede ser NULL.
--      La condición inversa (voided_at IS NULL) permite voided_by y void_reason NULL.
--
--   3. Crea índice parcial idx_payments_client_active que solo incluye
--      pagos no anulados, optimizando las consultas de vencimientos e ingresos.
--
--   4. Crea tabla audit_log para registro de acciones críticas:
--      - PAYMENT_VOIDED: pago anulado
--      - ATTENDANCE_DELETED: asistencia eliminada
--      - CLIENT_DELETED: cliente eliminado
--
-- Seguridad:
--   - RLS está habilitado en audit_log sin políticas (deny-all).
--   - Solo la service role puede leer/escribir en audit_log.
--   - Se revoca todo acceso de anon y authenticated.
--
-- Idempotencia:
--   - Todas las operaciones usan IF NOT EXISTS.
--   - El constraint se crea dentro de un bloque DO que verifica primero si existe.
--   - La migración también se puede re-ejecutar sin errores.
--
-- Cómo ejecutarla:
--   Copia y ejecuta este archivo completo en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- 1. Añadir columnas de anulación a membership_payments (si no existen)
alter table if exists public.membership_payments
  add column if not exists voided_at timestamptz,
  add column if not exists voided_by text,
  add column if not exists void_reason text;

-- 2. Crear constraint de consistencia entre void fields
-- Primero verificamos si el constraint ya existe para hacerlo idempotente
do $$
declare
  constraint_exists boolean;
begin
  select exists (
    select 1
    from pg_constraint
    where conname = 'payments_void_consistency'
      and conrelid = 'public.membership_payments'::regclass
  ) into constraint_exists;

  if not constraint_exists then
    alter table public.membership_payments
      add constraint payments_void_consistency
      check (voided_at is null or void_reason is not null);
  end if;
end $$;

-- 3. Crear índice parcial en pagos no anulados
create index if not exists idx_payments_client_active
  on public.membership_payments (client_id, paid_at desc)
  where voided_at is null;

-- 4. Crear tabla audit_log
create table if not exists public.audit_log (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  owner_id uuid references public.owners (id),
  owner_name text not null,
  action text not null check (
    action in ('PAYMENT_VOIDED', 'ATTENDANCE_DELETED', 'CLIENT_DELETED')
  ),
  entity text not null,
  entity_id uuid,
  details jsonb not null default '{}'::jsonb
);

-- Índice en created_at para búsquedas recientes
create index if not exists idx_audit_log_created_at_desc
  on public.audit_log (created_at desc);

-- 5. Habilitar RLS en audit_log (sin políticas = deny-all)
alter table public.audit_log enable row level security;

-- Revocar acceso de anon y authenticated
revoke all on table public.audit_log from anon;
revoke all on table public.audit_log from authenticated;

alter default privileges in schema public revoke all on tables from anon, authenticated;

-- Comentario explicativo (solo para documentación)
comment on table public.audit_log is 'Registro de auditoría para acciones críticas: anulaciones de pagos, eliminación de asistencias y borrado de clientes.';

commit;