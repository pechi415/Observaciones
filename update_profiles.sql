-- Agregar columnas para datos del supervisor
alter table public.profiles 
add column if not exists observer_id text unique,
add column if not exists site_default text,
add column if not exists group_default text;

-- Crear un índice para buscar rápido por observer_id
create index if not exists idx_profiles_observer_id on public.profiles(observer_id);
