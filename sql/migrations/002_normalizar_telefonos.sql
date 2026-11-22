-- ============================================================================
-- Migración 002 - Normalizar teléfonos de clientes
--
-- Qué hace:
--   Convierte public.clients.phone a la forma canónica colombiana de 10 dígitos:
--     - elimina todo lo que no sea dígito;
--     - si quedan 12 dígitos y empiezan por 57, quita ese prefijo.
--   Solo actualiza las filas cuyo resultado cumpla ^3[0-9]{9}$.
--   Las filas que no cumplan el patrón se dejan intactas y se reportan con
--   RAISE NOTICE (cantidad).
--
-- Seguridad:
--   - Es idempotente: ejecutarla varias veces deja el mismo resultado.
--   - Todo se ejecuta dentro de una sola transacción.
--   - NO borra ni fusiona clientes.
--   - Antes de actualizar comprueba si la normalización generaría teléfonos
--     duplicados entre clientes. Si los hay, aborta con RAISE EXCEPTION y el
--     dueño debe resolverlos a mano.
--
-- Cómo ejecutarla:
--   Copia este archivo completo y ejecútalo en el SQL Editor de Supabase.
--
-- Consulta de ejemplo para listar los duplicados que bloquean la migración:
--
--   select
--     case
--       when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 12
--        and left(regexp_replace(phone, '[^0-9]', '', 'g'), 2) = '57'
--       then substr(regexp_replace(phone, '[^0-9]', '', 'g'), 3)
--       else regexp_replace(phone, '[^0-9]', '', 'g')
--     end as telefono_normalizado,
--     count(*) as clientes,
--     array_agg(id order by created_at) as client_ids,
--     array_agg(phone order by created_at) as telefonos_originales
--   from public.clients
--   group by 1
--   having count(*) > 1
--      and telefono_normalizado ~ '^3[0-9]{9}$'
--   order by 1;
--
--   Resuelve cada caso a mano (corrigiendo el teléfono de uno de los clientes)
--   y vuelve a ejecutar esta migración.
-- ============================================================================

begin;

-- Bloquea escrituras sobre clients mientras se valida y actualiza, para que no
-- entren teléfonos nuevos entre la comprobación de duplicados y el update.
lock table public.clients in share row exclusive mode;

-- 1. Comprobar que la normalización no genere duplicados.
do $$
declare
  telefonos_duplicados bigint;
  clientes_afectados bigint;
begin
  select
    count(*),
    coalesce(sum(cantidad), 0)
  into telefonos_duplicados, clientes_afectados
  from (
    select
      case
        when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 12
         and left(regexp_replace(phone, '[^0-9]', '', 'g'), 2) = '57'
        then substr(regexp_replace(phone, '[^0-9]', '', 'g'), 3)
        else regexp_replace(phone, '[^0-9]', '', 'g')
      end as telefono_normalizado,
      count(*) as cantidad
    from public.clients
    group by 1
    having count(*) > 1
  ) duplicados
  where telefono_normalizado ~ '^3[0-9]{9}$';

  if telefonos_duplicados > 0 then
    raise exception
      'Normalización abortada: % teléfono(s) quedarían duplicados entre % cliente(s).',
      telefonos_duplicados, clientes_afectados
      using hint = 'Revisa la consulta de ejemplo en el comentario de esta migración, corrige los teléfonos a mano y vuelve a ejecutarla.';
  end if;
end $$;

-- 2. Reportar las filas que no se pueden normalizar y quedan intactas.
do $$
declare
  sin_normalizar bigint;
begin
  select count(*)
  into sin_normalizar
  from public.clients
  where not (
    case
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 12
       and left(regexp_replace(phone, '[^0-9]', '', 'g'), 2) = '57'
      then substr(regexp_replace(phone, '[^0-9]', '', 'g'), 3)
      else regexp_replace(phone, '[^0-9]', '', 'g')
    end ~ '^3[0-9]{9}$'
  );

  if sin_normalizar > 0 then
    raise notice
      'Clientes con teléfono fuera de ^3[0-9]{9}$: % (se dejaron intactos).',
      sin_normalizar;
  else
    raise notice 'Todos los teléfonos se pueden normalizar o ya están normalizados.';
  end if;
end $$;

-- 3. Actualizar únicamente los teléfonos normalizables que cambian.
with normalizados as (
  select
    id,
    case
      when length(regexp_replace(phone, '[^0-9]', '', 'g')) = 12
       and left(regexp_replace(phone, '[^0-9]', '', 'g'), 2) = '57'
      then substr(regexp_replace(phone, '[^0-9]', '', 'g'), 3)
      else regexp_replace(phone, '[^0-9]', '', 'g')
    end as telefono_normalizado
  from public.clients
)
update public.clients c
set phone = n.telefono_normalizado
from normalizados n
where c.id = n.id
  and n.telefono_normalizado ~ '^3[0-9]{9}$'
  and c.phone is distinct from n.telefono_normalizado;

commit;
