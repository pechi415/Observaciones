-- Inserta el perfil del usuario actual si no existe
-- Esto corrige el error de "foreign key constraint" si el trigger falló
insert into public.profiles (id, email, full_name, role)
select 
  id, 
  email, 
  coalesce(raw_user_meta_data->>'full_name', 'Supervisor'),
  'supervisor'
from auth.users
where id = auth.uid()
on conflict (id) do nothing;
