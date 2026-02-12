-- Script para corregir permisos de visualización del rol "Líder"

-- 1. Actualizar políticas de "observations"
-- Permitir que admin y lider vean TODAS las observaciones
DROP POLICY IF EXISTS "Enable read access for users based on role" ON public.observations;

CREATE POLICY "Enable read access for users based on role" ON public.observations
FOR SELECT USING (
  auth.uid() = supervisor_id -- El usuario puede ver sus propias observaciones
  OR
  EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider')) -- Admin y Lider ven todo
);


-- 2. Actualizar políticas de "observation_records" (items de la observación)
DROP POLICY IF EXISTS "Enable read access for records" ON public.observation_records;

CREATE POLICY "Enable read access for records" ON public.observation_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.observations obs
    WHERE obs.id = observation_records.observation_id
    AND (
      obs.supervisor_id = auth.uid() -- Dueño de la observación
      OR
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role IN ('admin', 'lider')) -- Admin y Lider
    )
  )
);
