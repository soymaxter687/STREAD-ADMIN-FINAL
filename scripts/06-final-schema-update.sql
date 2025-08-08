-- StreamAdmin - Actualización Final del Schema
-- Ejecutar para alinear con especificaciones finales

-- Actualizar tabla servicios para incluir imagen_portada
ALTER TABLE servicios 
ADD COLUMN IF NOT EXISTS imagen_portada TEXT;

-- Asegurar que servicio_pines tenga la estructura correcta
-- (Ya existe, solo verificamos)
-- servicio_pines representa la configuración de PINs por servicio

-- Actualizar tabla cuentas para asegurar nombres automáticos
-- (Ya implementado con triggers)

-- Actualizar tabla clientes para hacer email opcional
ALTER TABLE clientes 
ALTER COLUMN email DROP NOT NULL;

-- Actualizar usuarios_asignaciones para incluir todos los campos necesarios
ALTER TABLE usuarios_asignaciones 
ADD COLUMN IF NOT EXISTS perfil_numero INTEGER,
ADD COLUMN IF NOT EXISTS nombre_perfil VARCHAR(50),
ADD COLUMN IF NOT EXISTS pin_asignado VARCHAR(10),
ADD COLUMN IF NOT EXISTS costo_suscripcion DECIMAL(10,2) DEFAULT 0;

-- Actualizar datos existentes para compatibilidad
UPDATE usuarios_asignaciones ua
SET 
    perfil_numero = cu.usuario_numero,
    nombre_perfil = COALESCE(cu.nombre_usuario, 'Usuario ' || cu.usuario_numero),
    pin_asignado = cu.pin,
    costo_suscripcion = c.precio_cliente
FROM cuenta_usuarios cu
JOIN cuentas c ON cu.cuenta_id = c.id
WHERE ua.cuenta_usuario_id = cu.id
AND ua.perfil_numero IS NULL;

-- Función para sincronizar configuración de PINs desde servicios a cuentas
CREATE OR REPLACE FUNCTION sincronizar_configuracion_pines()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar todos los usuarios de cuentas de este servicio
    UPDATE cuenta_usuarios 
    SET 
        pin = NEW.pin,
        nombre_usuario = NEW.nombre_usuario,
        updated_at = NOW()
    WHERE servicio_id = NEW.servicio_id 
    AND usuario_numero = NEW.usuario_numero
    AND ocupado = false; -- Solo actualizar perfiles no ocupados
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar automáticamente
DROP TRIGGER IF EXISTS trigger_sincronizar_configuracion_pines ON servicio_pines;
CREATE TRIGGER trigger_sincronizar_configuracion_pines
    AFTER INSERT OR UPDATE ON servicio_pines
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_configuracion_pines();

-- Vista para exportación de usuarios con todos los datos
CREATE OR REPLACE VIEW vista_usuarios_exportacion AS
SELECT 
    c.nombre as cliente_nombre,
    c.telefono as cliente_telefono,
    c.email as cliente_email,
    s.nombre as servicio_nombre,
    s.emoji as servicio_emoji,
    ct.nombre as cuenta_nombre,
    ct.email as cuenta_email,
    ct.password as cuenta_password,
    ua.perfil_numero,
    ua.nombre_perfil,
    ua.pin_asignado,
    ua.fecha_contratacion,
    ua.fecha_vencimiento_usuario,
    ua.costo_suscripcion,
    ct.fecha_vencimiento as cuenta_vencimiento,
    ua.created_at as fecha_asignacion_sistema
FROM usuarios_asignaciones ua
JOIN clientes c ON ua.cliente_id = c.id
JOIN cuenta_usuarios cu ON ua.cuenta_usuario_id = cu.id
JOIN cuentas ct ON cu.cuenta_id = ct.id
JOIN servicios s ON ct.servicio_id = s.id
WHERE ua.activa = true
ORDER BY s.nombre, ct.nombre, ua.perfil_numero;

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_usuarios_asignaciones_perfil ON usuarios_asignaciones(perfil_numero);
CREATE INDEX IF NOT EXISTS idx_servicios_imagen ON servicios(imagen_portada);
