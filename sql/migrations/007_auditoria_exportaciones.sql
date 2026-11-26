-- ============================================================================
-- Migración 007 - Acción DATA_EXPORTED en auditoría
--
-- Qué hace:
--   Actualiza la constraint audit_log_action_check para incluir 'DATA_EXPORTED'
--   junto a las 4 acciones existentes.
--
-- Idempotencia:
--   - Usa DO block que verifica si la acción ya está permitida.
--   - Se puede re-ejecutar sin errores.
--
-- Cómo ejecutarla:
--   Copia y ejecuta este archivo completo en el SQL Editor de Supabase.
-- ============================================================================

begin;

-- Verificar si DATA_EXPORTED ya está en la constraint antes de modificarla
do $$
declare
  constraint_def text;
begin
  select pg_get_constraintdef(oid)
    into constraint_def
  from pg_constraint
  where conname = 'audit_log_action_check'
    and conrelid = 'public.audit_log'::regclass;

  -- Si DATA_EXPORTED ya está presente, no hacer nada
  if constraint_def like '%DATA_EXPORTED%' then
    raise notice 'DATA_EXPORTED ya está en audit_log_action_check';
  else
    -- Eliminar constraint existente
    alter table public.audit_log drop constraint if exists audit_log_action_check;

    -- Crear nueva constraint con las 5 acciones
    alter table public.audit_log
      add constraint audit_log_action_check
      check (action in (
        'PAYMENT_VOIDED',
        'ATTENDANCE_DELETED',
        'CLIENT_DELETED',
        'CASH_CLOSED',
        'DATA_EXPORTED'
      ));
    raise notice 'Constraint audit_log_action_check actualizada con DATA_EXPORTED';
  end if;
end $$;

commit;