-- Schema SQL para Supabase
-- Copia todo este archivo en SQL Editor de Supabase y ejecuta

-- 1. Habilitar RLS (Row Level Security)
-- Esto asegura que solo usuarios autenticados puedan acceder

-- 2. Tabla de Dueños (Owners)
-- Para este MVP usamos autenticación de Supabase, pero guardamos metadata adicional aquí
create table owners (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  email text not null unique,
  password_hash text, -- solo usado si decides autenticar manualmente
  created_at timestamp with time zone default now()
);

-- 3. Tabla de Clientes
create table clients (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  age integer,
  address text,
  phone text not null unique,
  payment_method text not null check (payment_method in ('EFECTIVO', 'NEQUI', 'DAVPLATA', 'PSE', 'OTRO')),
  consent_at timestamp with time zone,
  active boolean default true,
  created_at timestamp with time zone default now()
);

-- Índices
create index idx_clients_active on clients(active);
create index idx_clients_phone on clients(phone);

-- 4. Tabla de Pagos de Membresía
create table membership_payments (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  amount_cop integer not null check (amount_cop > 0),
  paid_at timestamp with time zone default now(),
  period_start timestamp with time zone,
  period_end timestamp with time zone,
  recorded_by text,
  note text,
  created_at timestamp with time zone default now()
);

create index idx_payments_client on membership_payments(client_id);
create index idx_payments_paid on membership_payments(paid_at desc);

-- 5. Tabla de Asistencias
create table attendance (
  id uuid primary key default uuid_generate_v4(),
  client_id uuid references clients(id) on delete cascade,
  check_in timestamp with time zone default now(),
  note text,
  recorded_by text,
  created_at timestamp with time zone default now()
);

create index idx_attendance_client on attendance(client_id);
create index idx_attendance_checkin on attendance(check_in desc);

-- 6. Autenticación con Supabase Auth
-- La autenticación está integrada en el proyecto. Los dueños se registran vía Supabase Auth
-- Luego se sincronizan con la tabla owners usando triggers

-- Trigger para sincronizar usuarios de auth con tabla owners
create or replace function public.handle_new_user()
returns trigger as $$
begin
  -- Solo para usuarios que tengan rol 'owner' en metadata o email específico
  if (new.email = 'admin@admin.com' or new.user_metadata->>'role' = 'owner') then
    insert into owners (id, name, email)
    values (new.id, new.raw_user_meta_data->>'name' or split_part(new.email, '@', 1), new.email)
    on conflict (email) do nothing;
  end if;
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
after sign up
for each row
execute function public.handle_new_user();

-- 7. Views útiles
-- Vista con clientes y su estado actual de membresía
create or replace view client_membership_status as
select
  c.*,
  coalesce(
    (select paid_at from membership_payments mp 
     where mp.client_id = c.id 
     order by paid_at desc 
     limit 1
  ), c.created_at) as last_payment_at,
  case
    when last_payment_at is null then 'VENCIDO'::text
    else
      case
        when (now() - last_payment_at) < interval '5 days' then 'POR_VENCER'::text
        when (now() - last_payment_at) < interval '30 days' then 'ACTIVO'::text
        else 'VENCIDO'::text
      end
  end as status,
  coalesce(last_payment_at, c.created_at) + interval '30 days' as next_expiration
from clients c
where c.active = true;

-- 8. Políticas RLS para seguridad
-- Política para lectura de clientes (solo para usuarios autenticados)
create policy "authenticated can view clients"
on clients for select
using (auth.role() = 'authenticated');

-- Política para inserción de clientes
create policy "authenticated can create clients"
on clients for insert
with check (auth.role() = 'authenticated');

-- Política para actualización de clientes
create policy "authenticated can update clients"
on clients for update
using (auth.role() = 'authenticated');

-- Política para eliminación lógica de clientes
create policy "authenticated can delete clients"
on clients for update
using (auth.role() = 'authenticated');

-- Políticas para membership_payments
create policy "authenticated can view payments"
on membership_payments for select
using (auth.role() = 'authenticated');

create policy "authenticated can create payments"
on membership_payments for insert
with check (auth.role() = 'authenticated');

-- Políticas para attendance
create policy "authenticated can view attendance"
on attendance for select
using (auth.role() = 'authenticated');

create policy "authenticated can create attendance"
on attendance for insert
with check (auth.role() = 'authenticated');

-- Habilitar RLS en todas las tablas
alter table clients enable row level security;
alter table membership_payments enable row level security;
alter table attendance enable row level security;