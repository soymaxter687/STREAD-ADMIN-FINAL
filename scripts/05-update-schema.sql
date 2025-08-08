-- StreamAdmin - Actualización de Schema
-- Ejecutar después de los scripts anteriores

-- Agregar campos de precios a la tabla cuentas
ALTER TABLE cuentas 
ADD COLUMN IF NOT EXISTS precio_base DECIMAL(10,2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS precio_cliente DECIMAL(10,2) DEFAULT 0;

-- Actualizar precio_mensual existente como precio_base si no hay precio_base
UPDATE cuentas 
SET precio_base = precio_mensual 
WHERE precio_base = 0 AND precio_mensual > 0;

-- Agregar campos de fechas a usuarios_asignaciones
ALTER TABLE usuarios_asignaciones 
ADD COLUMN IF NOT EXISTS fecha_contratacion DATE DEFAULT CURRENT_DATE,
ADD COLUMN IF NOT EXISTS fecha_vencimiento_usuario DATE;

-- Actualizar fecha_contratacion con fecha_asignacion existente
UPDATE usuarios_asignaciones 
SET fecha_contratacion = fecha_asignacion 
WHERE fecha_contratacion IS NULL;

-- Crear índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_cuentas_precios ON cuentas(precio_base, precio_cliente);
CREATE INDEX IF NOT EXISTS idx_asignaciones_fechas ON usuarios_asignaciones(fecha_contratacion, fecha_vencimiento_usuario);

-- Función para actualizar precios automáticamente
CREATE OR REPLACE FUNCTION actualizar_precios_cuenta()
RETURNS TRIGGER AS $$
BEGIN
    -- Si no se especifica precio_cliente, usar precio_base + 20%
    IF NEW.precio_cliente = 0 OR NEW.precio_cliente IS NULL THEN
        NEW.precio_cliente := NEW.precio_base * 1.2;
    END IF;
    
    -- Mantener precio_mensual para compatibilidad
    NEW.precio_mensual := NEW.precio_base;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para actualizar precios automáticamente
DROP TRIGGER IF EXISTS trigger_actualizar_precios_cuenta ON cuentas;
CREATE TRIGGER trigger_actualizar_precios_cuenta
    BEFORE INSERT OR UPDATE ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_precios_cuenta();

-- Vista para obtener información completa de usuarios con estado
CREATE OR REPLACE VIEW vista_usuarios_completa AS
SELECT 
    cu.id as cuenta_usuario_id,
    cu.usuario_numero,
    cu.pin,
    cu.nombre_usuario,
    cu.ocupado,
    s.id as servicio_id,
    s.nombre as servicio_nombre,
    s.emoji as servicio_emoji,
    s.usuarios_por_cuenta,
    c.id as cuenta_id,
    c.nombre as cuenta_nombre,
    c.email as cuenta_email,
    c.password as cuenta_password,
    c.precio_base,
    c.precio_cliente,
    c.fecha_vencimiento as cuenta_vencimiento,
    cl.id as cliente_id,
    cl.nombre as cliente_nombre,
    cl.telefono as cliente_telefono,
    cl.email as cliente_email,
    ua.id as asignacion_id,
    ua.fecha_contratacion,
    ua.fecha_vencimiento_usuario,
    ua.activa as asignacion_activa
FROM cuenta_usuarios cu
LEFT JOIN servicios s ON cu.servicio_id = s.id
LEFT JOIN cuentas c ON cu.cuenta_id = c.id
LEFT JOIN usuarios_asignaciones ua ON cu.id = ua.cuenta_usuario_id AND ua.activa = true
LEFT JOIN clientes cl ON ua.cliente_id = cl.id
ORDER BY s.nombre, c.nombre, cu.usuario_numero;
