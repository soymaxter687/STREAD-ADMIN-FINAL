-- StreamAdmin - Actualización de Schema (Corregida)
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
