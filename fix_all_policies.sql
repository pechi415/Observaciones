-- Este script RESTAURA y ESTANDARIZA todas las políticas de RLS para Observaciones y sus Detalles.
-- Incluye DROP al inicio para evitar errores de "policy already exists".

-- ==========================================
-- 1. Políticas para OBSERVATIONS (Cabeceras)
-- ==========================================
ALTER TABLE public.observations ENABLE ROW LEVEL SECURITY;

-- A. Eliminar TODAS las políticas posibles (viejas y nuevas)
DROP POLICY IF EXISTS "Enable read access for users based on role" ON public.observations;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.observations;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.observations;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.observations;
DROP POLICY IF EXISTS "Enable all access for users based on role" ON public.observations;
-- Eliminar las NUEVAS que pudimos haber creado parcialmente
DROP POLICY IF EXISTS "Enable SELECT for observations" ON public.observations;
DROP POLICY IF EXISTS "Enable INSERT for observations" ON public.observations;
DROP POLICY IF EXISTS "Enable UPDATE for observations" ON public.observations;
DROP POLICY IF EXISTS "Enable DELETE for observations" ON public.observations;


-- B. Crear políticas DEFINITIVAS
-- 1. SELECT (Ver): Admin/Líder ven TODO. Supervisores ven SUYO.
CREATE POLICY "Enable SELECT for observations" ON public.observations
FOR SELECT USING (
  auth.uid() = supervisor_id 
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
);

-- 2. INSERT (Crear): Cualquier usuario autenticado puede crear.
CREATE POLICY "Enable INSERT for observations" ON public.observations
FOR INSERT WITH CHECK (
  auth.role() = 'authenticated'
);

-- 3. UPDATE (Editar): Admin/Líder editan CUALQUIERA. Supervisor edita SUYA.
CREATE POLICY "Enable UPDATE for observations" ON public.observations
FOR UPDATE USING (
  auth.uid() = supervisor_id 
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
);

-- 4. DELETE (Eliminar): Admin/Líder eliminan CUALQUIERA. Supervisor elimina SUYA.
CREATE POLICY "Enable DELETE for observations" ON public.observations
FOR DELETE USING (
  auth.uid() = supervisor_id 
  OR 
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
);


-- ==================================================
-- 2. Políticas para OBSERVATION_RECORDS (Detalles)
-- ==================================================
ALTER TABLE public.observation_records ENABLE ROW LEVEL SECURITY;

-- A. Eliminar TODAS las políticas posibles
DROP POLICY IF EXISTS "Enable read access for records" ON public.observation_records;
DROP POLICY IF EXISTS "Admin and Lider see all records" ON public.observation_records;
DROP POLICY IF EXISTS "Users see their own observation records" ON public.observation_records;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.observation_records;
DROP POLICY IF EXISTS "Enable update for users based on email" ON public.observation_records;
DROP POLICY IF EXISTS "Enable delete for users based on email" ON public.observation_records;
-- Eliminar las NUEVAS
DROP POLICY IF EXISTS "Enable SELECT for observation_records" ON public.observation_records;
DROP POLICY IF EXISTS "Enable INSERT for observation_records" ON public.observation_records;
DROP POLICY IF EXISTS "Enable UPDATE for observation_records" ON public.observation_records;
DROP POLICY IF EXISTS "Enable DELETE for observation_records" ON public.observation_records;


-- B. Crear políticas DEFINITIVAS
-- 1. SELECT (Ver): Admin/Líder ven TODO. Supervisor ve SUYOS.
CREATE POLICY "Enable SELECT for observation_records" ON public.observation_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.observations obs
    WHERE obs.id = observation_records.observation_id
    AND (
      obs.supervisor_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
    )
  )
);

-- 2. INSERT (Crear): Si puedes ver la observación padre, puedes insertar detalles.
CREATE POLICY "Enable INSERT for observation_records" ON public.observation_records
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.observations obs
    WHERE obs.id = observation_records.observation_id
    AND (
      obs.supervisor_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
    )
  )
);

-- 3. UPDATE (Editar): Igual que INSERT.
CREATE POLICY "Enable UPDATE for observation_records" ON public.observation_records
FOR UPDATE USING (
  EXISTS (
    SELECT 1 FROM public.observations obs
    WHERE obs.id = observation_records.observation_id
    AND (
      obs.supervisor_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
    )
  )
);

-- 4. DELETE (Eliminar): Igual que INSERT.
CREATE POLICY "Enable DELETE for observation_records" ON public.observation_records
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.observations obs
    WHERE obs.id = observation_records.observation_id
    AND (
      obs.supervisor_id = auth.uid()
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider'))
    )
  )
);
