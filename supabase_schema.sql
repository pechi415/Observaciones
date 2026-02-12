-- 1. Tabla de Perfiles (Usuarios del sistema)
create table public.profiles (
  id uuid references auth.users not null primary key,
  email text,
  full_name text,
  role text default 'supervisor', -- 'admin' o 'supervisor'
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS (Seguridad) para Perfiles
alter table profiles enable row level security;
create policy "Perfiles visibles para todos" on profiles for select using (true);
create policy "Usuario edita su propio perfil" on profiles for update using (auth.uid() = id);

-- Trigger para crear perfil automáticamente al registrarse
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, email, full_name)
  values (new.id, new.email, new.raw_user_meta_data->>'full_name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- 2. Tabla de Cabecera de Observaciones
create table public.observations (
  id uuid default gen_random_uuid() primary key,
  supervisor_id uuid references public.profiles(id) not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null,
  date date not null default CURRENT_DATE,
  shift text check (shift in ('Diurno', 'Nocturno')),
  site text not null, -- Sede
  group_info text, -- Grupo (renombrado para evitar palabra reservada)
  observation_type text,
  status text default 'completed'
);

-- RLS para Observaciones
alter table observations enable row level security;
create policy "Ver todas las observaciones" on observations for select using (true);
create policy "Crear observaciones propias" on observations for insert with check (auth.uid() = supervisor_id);

-- 3. Tabla de Detalles (Registros por Operador)
create table public.observation_records (
  id uuid default gen_random_uuid() primary key,
  observation_id uuid references public.observations(id) on delete cascade not null,
  operator_name text not null,
  checklist jsonb not null, -- Aquí se guardan las respuestas SI/NO
  comments text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS para Detalles
alter table observation_records enable row level security;
create policy "Ver todos los registros" on observation_records for select using (true);
create policy "Crear registros vinculados" on observation_records for insert with check (
  exists (
    select 1 from observations
    where id = observation_records.observation_id
    and supervisor_id = auth.uid()
  )
);
