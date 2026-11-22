-- ============================================================================
-- Migración 003 - Una asistencia por cliente y día de Bogotá
--
-- Qué hace:
--   Crea un índice único en public.attendance para evitar que un mismo cliente
--   tenga más de un registro de asistencia en un mismo día de Bogotá
--   (zona horaria America/Bogota, UTC-5 fijo, sin horario de verano).
--
--   Expresión del índice: (client_id, ((check_in at time zone 'America/Bogota')::date))
--   La expresión es IMMUTABLE porque la zona horaria es un literal fijo, no depende
--   de la configuración de sesión (TimeZone) ni de la hora del proceso.
--
-- Seguridad:
--   - Es idempotente: ejecutarla varias veces no falla (IF NOT EXISTS).
--   - Todo se ejecuta dentro de una sola transacción.
--   - NO borra ni modifica datos existentes.
--   - Antes de crear el índice, un bloque DO cuenta duplicados (client_id, día de
--     Bogotá). Si los hay, aborta con RAISE EXCEPTION y el conteo, sin borrar datos,
--     para que el dueño los resuelva a mano.
--
-- Cómo ejecutarla:
--   Copia y ejecuta este archivo completo en el SQL Editor de Supabase.
--
-- Consulta de diagnóstico para listar los duplicados que bloquean el índice:
--
--   select
--     client_id,
--     ((check_in at time zone 'America/Bogota')::date) as fecha_bogota,
--     count(*) as asistencias
--   from public.attendance
--   group by 1, 2
--   having count(*) > 1
--   order by 1, 2;
--
--   Resuelve cada caso a mano (borrando o corrigendo registros sobrantes) y
--   vuelve a ejecutar esta migración.
-- ============================================================================

begin;

-- Evita que se inserten nuevas asistencias entre la comprobación de duplicados
-- y la creación del índice.
lock table public.attendance in share row exclusive mode;

-- 1. Comprobar duplicados antes de crear el índice único.
do $$
declare
  duplicados bigint;
begin
  select count(*)
  into duplicados
  from (
    select
      client_id,
      ((check_in at time zone 'America/Bogota')::date) as fecha_bogota,
      count(*) as cantidad
    from public.attendance
    group by 1, 2
    having count(*) > 1
  ) d;

  if duplicados > 0 then
    raise exception
      'No se puede crear el índice único: hay % par(es) de cliente/día con asistencias duplicadas.',
      duplicados
      using hint = 'Revisa la consulta de diagnóstico en el comentario de esta migración, borra los registros sobrantes y vuelve a ejecutarla.';
  end if;
end $$;

-- 2. Crear el índice único (idempotente).
create unique index if not exists attendance_client_day_idx
  on public.attendance (client_id, ((check_in at time zone 'America/Bogota')::date));

commit;
