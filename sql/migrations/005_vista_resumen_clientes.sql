-- 005_vista_resumen_clientes.sql
-- Crear una vista para el resumen de clientes optimizada para paginación y filtrado.

BEGIN;

CREATE OR REPLACE VIEW public.client_overview WITH (security_invoker = true) AS 
WITH 
  valid_payments AS (
    SELECT 
      client_id, 
      paid_at, 
      period_end 
    FROM public.membership_payments 
    WHERE voided_at IS NULL
  ),
  last_payments AS (
    SELECT 
      client_id, 
      max(paid_at) as last_payment_at,
      -- Debe coincidir con getMembershipExpiration() en src/lib/utils.ts: si cambia la regla, cámbiala en ambos sitios
      max(COALESCE(period_end, paid_at + interval '720 hours')) as expiration
    FROM valid_payments
    GROUP BY client_id
  ),
  attendances AS (
    SELECT 
      client_id, 
      max(check_in) as last_attendance,
      count(*) filter (
        WHERE check_in >= date_trunc('month', now() at time zone 'America/Bogota') at time zone 'America/Bogota'
      ) as attendance_this_month
    FROM public.attendance
    GROUP BY client_id
  )
SELECT 
  c.id as client_id,
  lp.expiration,
  lp.last_payment_at,
  a.last_attendance,
  COALESCE(a.attendance_this_month, 0) as attendance_this_month
FROM public.clients c
LEFT JOIN last_payments lp ON c.id = lp.client_id
LEFT JOIN attendances a ON c.id = a.client_id
WHERE c.active = true;

REVOKE ALL ON public.client_overview FROM anon, authenticated;

COMMIT;
