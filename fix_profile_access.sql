-- ==========================================================
-- CORRECCIÓN EMERGENCIA: PERMITIR QUE USUARIOS VEAN PERFILES
-- ==========================================================

-- PROBLEMA: Las reglas anteriores eran tan estrictas que solo el 'admin' podía leer la tabla de perfiles.
-- RESULTADO: Los usuarios normales ('observer', 'reader') no podían leer SU PROPIO rol al iniciar sesión.

-- SOLUCIÓN: Permitir que cualquier usuario autenticado vea la información básica de los perfiles.
-- (Necesario para el Dashboard que muestra nombres de observadores y para el propio Login)

DROP POLICY IF EXISTS "Ver perfiles" ON profiles;
DROP POLICY IF EXISTS "Admin ve todos los perfiles" ON profiles; -- Limliamos la anterior restrictiva

CREATE POLICY "Usuarios autenticados ven perfiles" ON profiles FOR SELECT USING (
  auth.role() = 'authenticated'
);

-- Confirmación visual
-- SELECT * FROM profiles LIMIT 5;
