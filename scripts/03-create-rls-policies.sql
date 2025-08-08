-- StreamAdmin - Row Level Security Policies
-- Ejecutar después de crear funciones

-- Habilitar RLS en todas las tablas
ALTER TABLE servicios ENABLE ROW LEVEL SECURITY;
ALTER TABLE servicio_pines ENABLE ROW LEVEL SECURITY;
ALTER TABLE clientes ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuentas ENABLE ROW LEVEL SECURITY;
ALTER TABLE cuenta_usuarios ENABLE ROW LEVEL SECURITY;
ALTER TABLE usuarios_asignaciones ENABLE ROW LEVEL SECURITY;

-- Políticas para servicios (acceso completo para usuarios autenticados)
CREATE POLICY "Servicios acceso completo" ON servicios
    FOR ALL USING (true);

-- Políticas para servicio_pines
CREATE POLICY "Servicio pines acceso completo" ON servicio_pines
    FOR ALL USING (true);

-- Políticas para clientes
CREATE POLICY "Clientes acceso completo" ON clientes
    FOR ALL USING (true);

-- Políticas para cuentas
CREATE POLICY "Cuentas acceso completo" ON cuentas
    FOR ALL USING (true);

-- Políticas para cuenta_usuarios
CREATE POLICY "Cuenta usuarios acceso completo" ON cuenta_usuarios
    FOR ALL USING (true);

-- Políticas para usuarios_asignaciones
CREATE POLICY "Usuarios asignaciones acceso completo" ON usuarios_asignaciones
    FOR ALL USING (true);

-- Nota: En producción, estas políticas deberían ser más restrictivas
-- basadas en roles de usuario y autenticación
