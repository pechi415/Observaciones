-- Este script actualiza la tabla de perfiles para permitir el nuevo rol "lider"

-- 1. Eliminar la restricción (constraint) actual si existe
ALTER TABLE public.profiles
DROP CONSTRAINT IF EXISTS profiles_role_check;

-- 2. Agregar la nueva restricción incluyendo 'lider'
-- (Asegúrate de incluir todos los roles que usas: admin, observer, reader, lider)
ALTER TABLE public.profiles
ADD CONSTRAINT profiles_role_check
CHECK (role IN ('admin', 'observer', 'reader', 'lider', 'editor'));

-- Nota: Si tu constraint tenía otro nombre, puedes verificarlo con:
-- SELECT conname FROM pg_constraint WHERE conrelid = 'public.profiles'::regclass;
