-- Agregar columna para obligar cambio de contraseña
ALTER TABLE profiles 
ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN DEFAULT TRUE;

-- Asegurar que los usuarios existentes también tengan el flag en true
-- (O pcionalmente en false si no quieres obligar a los que ya están activos)
-- UPDATE profiles SET must_change_password = TRUE; 
