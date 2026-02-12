-- ==========================================
-- SCRIPT COMPLETO DE MIGRACIÓN RBAC (Roles)
-- ==========================================

-- PASO 0: Migrar datos existentes para evitar errores
-- Si existen usuarios con rol 'supervisor', los pasamos a 'observer'
UPDATE public.profiles 
SET role = 'observer' 
WHERE role = 'supervisor' OR role IS NULL;

-- PASO 1: Actualizar Constraint para nuevos roles
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check 
CHECK (role IN ('admin', 'observer', 'reader'));

-- PASO 2: Políticas para PROFILES
-- Admin ve todo
DROP POLICY IF EXISTS "Admin ve todos los perfiles" ON profiles;
CREATE POLICY "Admin ve todos los perfiles" ON profiles FOR SELECT USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin'
);

-- Admin edita roles
DROP POLICY IF EXISTS "Admin edita todos, Usuario edita propio" ON profiles;
CREATE POLICY "Admin edita todos, Usuario edita propio" ON profiles FOR UPDATE USING (
  (SELECT role FROM profiles WHERE id = auth.uid()) = 'admin' 
  OR 
  id = auth.uid()
);

-- PASO 3: Políticas para OBSERVATIONS
DROP POLICY IF EXISTS "Ver todas las observaciones" ON observations;
CREATE POLICY "Ver todas las observaciones" ON observations FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'observer', 'reader')
  )
);

DROP POLICY IF EXISTS "Crear editar observaciones" ON observations;
DROP POLICY IF EXISTS "Crear observaciones propias" ON observations; -- Limpieza antigua
CREATE POLICY "Crear editar observaciones" ON observations FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'observer')
  )
);

DROP POLICY IF EXISTS "Editar observaciones" ON observations;
CREATE POLICY "Editar observaciones" ON observations FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'observer')
  )
);

-- PASO 4: Políticas para OBSERVATION_RECORDS
DROP POLICY IF EXISTS "Ver todos los registros" ON observation_records;
CREATE POLICY "Ver todos los registros" ON observation_records FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'observer', 'reader')
  )
);

DROP POLICY IF EXISTS "Gestionar registros" ON observation_records;
DROP POLICY IF EXISTS "Crear registros vinculados" ON observation_records; -- Limpieza antigua
CREATE POLICY "Gestionar registros" ON observation_records FOR ALL USING (
  EXISTS (
    SELECT 1 FROM profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'observer')
  )
);

-- PASO 5: Confirmación (Opcional, solo para ver qué pasó)
-- SELECT * FROM profiles;
