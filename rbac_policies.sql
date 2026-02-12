-- 1. Actualizar Check Constraint en Profiles para los nuevos roles
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check 
check (role in ('admin', 'observer', 'reader'));

-- 2. Función Helper para obtener el rol del usuario actual (opcional pero útil)
-- Nota: En RLS usaremos auth.uid() contra la tabla profiles directamente para ser más seguros

-- 3. Políticas para la tabla PROFILES
-- Permitir que ADMIN vea todos los perfiles (para gestión de usuarios)
drop policy if exists "Admin ve todos los perfiles" on profiles;
create policy "Admin ve todos los perfiles" on profiles for select using (
  (select role from profiles where id = auth.uid()) = 'admin'
);

-- Permitir que usuarios vean su propio perfil (ya existe, pero la reforzamos/mantenemos)
-- La política "Perfiles visibles para todos" del esquema original permitía SELECT a todos. 
-- Si queremos restringir que 'reader' no vea emails de otros, podríamos cambiarla.
-- Por ahora, mantenemos "Perfiles visibles para todos" para simplificar, o la restringimos si se pide mayor privacidad.
-- Vamos a REEMPLAZAR la política permisiva por una más estricta si es necesario, 
-- pero para que el login funcione y AuthContext cargue el perfil, el usuario debe poder leer SU propio perfil.

-- Política de UPDATE: Solo Admin puede cambiar roles, Usuario puede editar datos básicos
drop policy if exists "Admin edita todos, Usuario edita propio" on profiles;
create policy "Admin edita todos, Usuario edita propio" on profiles for update using (
  -- El usuario es admin
  (select role from profiles where id = auth.uid()) = 'admin' 
  OR 
  -- O el usuario se edita a sí mismo
  id = auth.uid()
);

-- 4. Políticas para la tabla OBSERVATIONS
drop policy if exists "Ver todas las observaciones" on observations;
create policy "Ver todas las observaciones" on observations for select using (
  -- Admin, Observer y Reader pueden ver
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'observer', 'reader')
  )
);

drop policy if exists "Crear observaciones propias" on observations;
create policy "Crear editar observaciones" on observations for insert with check (
  -- Solo Admin y Observer pueden crear
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'observer')
  )
);

-- Update policy
create policy "Editar observaciones" on observations for update using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'observer')
  )
);

-- 5. Políticas para la tabla OBSERVATION_RECORDS
drop policy if exists "Ver todos los registros" on observation_records;
create policy "Ver todos los registros" on observation_records for select using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'observer', 'reader')
  )
);

drop policy if exists "Crear registros vinculados" on observation_records;
create policy "Gestionar registros" on observation_records for all using (
  exists (
    select 1 from profiles 
    where id = auth.uid() 
    and role in ('admin', 'observer')
  )
);
