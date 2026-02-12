-- Este script corrige las políticas de visualización de los detalles (records)
-- para que el rol 'lider' pueda calcular correctamente los gráficos.
-- El problema anterior es que podía ver la observación (id) pero no los registros (checklist),
-- por lo que todo contaba como "Seguro" o no sumaba.

-- 1. Eliminar políticas antiguas para evitar conflictos
DROP POLICY IF EXISTS "Enable read access for records" ON public.observation_records;
DROP POLICY IF EXISTS "Admin and Lider see all records" ON public.observation_records;

-- 2. Política para Admin y Líder: Ver TODOS los registros
CREATE POLICY "Admin and Lider see all records" ON public.observation_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.profiles 
    WHERE id = auth.uid() 
    AND role IN ('admin', 'lider')
  )
);

-- 3. Política para Usuarios Normales (Observer, etc): Ver solo SUYOS
CREATE POLICY "Users see their own observation records" ON public.observation_records
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.observations
    WHERE id = public.observation_records.observation_id
    AND supervisor_id = auth.uid()
  )
);

-- Habilitar RLS si no estaba
ALTER TABLE public.observation_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.observation_records ENABLE ROW LEVEL SECURITY;
