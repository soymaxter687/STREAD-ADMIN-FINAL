-- StreamAdmin - Módulo de Control Financiero
-- Sistema completo de seguimiento de gastos, ventas y utilidades

-- Tabla principal de movimientos financieros
CREATE TABLE IF NOT EXISTS movimientos_financieros (
    id SERIAL PRIMARY KEY,
    tipo VARCHAR(10) NOT NULL CHECK (tipo IN ('gasto', 'venta')),
    monto DECIMAL(10,2) NOT NULL,
    fecha TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    mes INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM NOW()),
    año INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM NOW()),
    referencia_id INTEGER NOT NULL,
    referencia_tipo VARCHAR(20) NOT NULL CHECK (referencia_tipo IN ('cuenta', 'asignacion')),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_movimientos_tipo ON movimientos_financieros(tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_fecha ON movimientos_financieros(fecha);
CREATE INDEX IF NOT EXISTS idx_movimientos_mes_año ON movimientos_financieros(mes, año);
CREATE INDEX IF NOT EXISTS idx_movimientos_referencia ON movimientos_financieros(referencia_id, referencia_tipo);
CREATE INDEX IF NOT EXISTS idx_movimientos_activo ON movimientos_financieros(activo);

-- Función para registrar gasto automáticamente al crear cuenta
CREATE OR REPLACE FUNCTION registrar_gasto_cuenta()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO movimientos_financieros (
        tipo,
        monto,
        fecha,
        mes,
        año,
        referencia_id,
        referencia_tipo,
        descripcion
    ) VALUES (
        'gasto',
        COALESCE(NEW.precio_base, NEW.precio_mensual, 0),
        NEW.created_at,
        EXTRACT(MONTH FROM NEW.created_at),
        EXTRACT(YEAR FROM NEW.created_at),
        NEW.id,
        'cuenta',
        'Gasto por creación de cuenta: ' || NEW.nombre || ' (' || 
        (SELECT nombre FROM servicios WHERE id = NEW.servicio_id) || ')'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar venta automáticamente al asignar perfil
CREATE OR REPLACE FUNCTION registrar_venta_asignacion()
RETURNS TRIGGER AS $$
DECLARE
    servicio_nombre VARCHAR(100);
    cuenta_nombre VARCHAR(100);
BEGIN
    -- Obtener nombres para la descripción
    SELECT s.nombre, c.nombre
    INTO servicio_nombre, cuenta_nombre
    FROM cuenta_usuarios cu
    JOIN cuentas c ON cu.cuenta_id = c.id
    JOIN servicios s ON c.servicio_id = s.id
    WHERE cu.id = NEW.cuenta_usuario_id;
    
    INSERT INTO movimientos_financieros (
        tipo,
        monto,
        fecha,
        mes,
        año,
        referencia_id,
        referencia_tipo,
        descripcion
    ) VALUES (
        'venta',
        COALESCE(NEW.costo_suscripcion, 0),
        COALESCE(NEW.fecha_contratacion::timestamp, NEW.created_at),
        EXTRACT(MONTH FROM COALESCE(NEW.fecha_contratacion::timestamp, NEW.created_at)),
        EXTRACT(YEAR FROM COALESCE(NEW.fecha_contratacion::timestamp, NEW.created_at)),
        NEW.id,
        'asignacion',
        'Venta por asignación de perfil ' || COALESCE(NEW.perfil_numero, 0) || 
        ' en ' || COALESCE(cuenta_nombre, 'cuenta') || ' (' || COALESCE(servicio_nombre, 'servicio') || ')'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar venta cuando se modifica asignación
CREATE OR REPLACE FUNCTION actualizar_venta_asignacion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE movimientos_financieros 
    SET 
        monto = COALESCE(NEW.costo_suscripcion, 0),
        fecha = COALESCE(NEW.fecha_contratacion::timestamp, NEW.created_at),
        mes = EXTRACT(MONTH FROM COALESCE(NEW.fecha_contratacion::timestamp, NEW.created_at)),
        año = EXTRACT(YEAR FROM COALESCE(NEW.fecha_contratacion::timestamp, NEW.created_at)),
        updated_at = NOW()
    WHERE referencia_id = NEW.id AND referencia_tipo = 'asignacion' AND tipo = 'venta';
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para desactivar venta cuando se elimina asignación
CREATE OR REPLACE FUNCTION desactivar_venta_asignacion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE movimientos_financieros 
    SET activo = false, updated_at = NOW()
    WHERE referencia_id = OLD.id AND referencia_tipo = 'asignacion' AND tipo = 'venta';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Función para desactivar gasto cuando se elimina cuenta
CREATE OR REPLACE FUNCTION desactivar_gasto_cuenta()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE movimientos_financieros 
    SET activo = false, updated_at = NOW()
    WHERE referencia_id = OLD.id AND referencia_tipo = 'cuenta' AND tipo = 'gasto';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trigger_registrar_gasto_cuenta ON cuentas;
DROP TRIGGER IF EXISTS trigger_registrar_venta_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_actualizar_venta_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_desactivar_venta_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_desactivar_gasto_cuenta ON cuentas;

-- Crear triggers para automatizar el registro financiero
CREATE TRIGGER trigger_registrar_gasto_cuenta
    AFTER INSERT ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION registrar_gasto_cuenta();

CREATE TRIGGER trigger_registrar_venta_asignacion
    AFTER INSERT ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION registrar_venta_asignacion();

CREATE TRIGGER trigger_actualizar_venta_asignacion
    AFTER UPDATE ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_venta_asignacion();

CREATE TRIGGER trigger_desactivar_venta_asignacion
    AFTER DELETE ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION desactivar_venta_asignacion();

CREATE TRIGGER trigger_desactivar_gasto_cuenta
    AFTER DELETE ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION desactivar_gasto_cuenta();

-- Vista para resumen financiero mensual
CREATE OR REPLACE VIEW vista_resumen_financiero_mensual AS
SELECT 
    año,
    mes,
    CASE mes
        WHEN 1 THEN 'Enero'
        WHEN 2 THEN 'Febrero'
        WHEN 3 THEN 'Marzo'
        WHEN 4 THEN 'Abril'
        WHEN 5 THEN 'Mayo'
        WHEN 6 THEN 'Junio'
        WHEN 7 THEN 'Julio'
        WHEN 8 THEN 'Agosto'
        WHEN 9 THEN 'Septiembre'
        WHEN 10 THEN 'Octubre'
        WHEN 11 THEN 'Noviembre'
        WHEN 12 THEN 'Diciembre'
    END as mes_nombre,
    COALESCE(gastos.total_gastos, 0) as gastos_totales,
    COALESCE(ventas.total_ventas, 0) as ventas_totales,
    COALESCE(ventas.total_ventas, 0) - COALESCE(gastos.total_gastos, 0) as utilidad,
    CASE 
        WHEN COALESCE(gastos.total_gastos, 0) > 0 
        THEN ROUND(((COALESCE(ventas.total_ventas, 0) - COALESCE(gastos.total_gastos, 0)) / COALESCE(gastos.total_gastos, 0)) * 100, 2)
        ELSE 0 
    END as margen_utilidad_porcentaje,
    COALESCE(gastos.cantidad_gastos, 0) as cantidad_gastos,
    COALESCE(ventas.cantidad_ventas, 0) as cantidad_ventas
FROM (
    SELECT DISTINCT año, mes FROM movimientos_financieros WHERE activo = true
) fechas
LEFT JOIN (
    SELECT 
        año, 
        mes, 
        SUM(monto) as total_gastos,
        COUNT(*) as cantidad_gastos
    FROM movimientos_financieros 
    WHERE tipo = 'gasto' AND activo = true
    GROUP BY año, mes
) gastos ON fechas.año = gastos.año AND fechas.mes = gastos.mes
LEFT JOIN (
    SELECT 
        año, 
        mes, 
        SUM(monto) as total_ventas,
        COUNT(*) as cantidad_ventas
    FROM movimientos_financieros 
    WHERE tipo = 'venta' AND activo = true
    GROUP BY año, mes
) ventas ON fechas.año = ventas.año AND fechas.mes = ventas.mes
ORDER BY año DESC, mes DESC;

-- Vista para resumen global (histórico total)
CREATE OR REPLACE VIEW vista_resumen_financiero_global AS
SELECT 
    'Histórico Total' as periodo,
    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as gastos_totales,
    COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) as ventas_totales,
    COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as utilidad,
    CASE 
        WHEN COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) > 0 
        THEN ROUND(((COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) - 
                     COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) / 
                     COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) * 100, 2)
        ELSE 0 
    END as margen_utilidad_porcentaje,
    COUNT(CASE WHEN tipo = 'gasto' THEN 1 END) as cantidad_gastos,
    COUNT(CASE WHEN tipo = 'venta' THEN 1 END) as cantidad_ventas,
    MIN(fecha) as fecha_inicio,
    MAX(fecha) as fecha_fin
FROM movimientos_financieros 
WHERE activo = true;

-- Función para obtener resumen de un período específico
CREATE OR REPLACE FUNCTION obtener_resumen_periodo(
    año_param INTEGER DEFAULT NULL,
    mes_param INTEGER DEFAULT NULL
)
RETURNS TABLE (
    periodo TEXT,
    gastos_totales DECIMAL(10,2),
    ventas_totales DECIMAL(10,2),
    utilidad DECIMAL(10,2),
    margen_utilidad_porcentaje DECIMAL(5,2),
    cantidad_gastos BIGINT,
    cantidad_ventas BIGINT
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        CASE 
            WHEN año_param IS NOT NULL AND mes_param IS NOT NULL THEN
                (CASE mes_param
                    WHEN 1 THEN 'Enero'
                    WHEN 2 THEN 'Febrero'
                    WHEN 3 THEN 'Marzo'
                    WHEN 4 THEN 'Abril'
                    WHEN 5 THEN 'Mayo'
                    WHEN 6 THEN 'Junio'
                    WHEN 7 THEN 'Julio'
                    WHEN 8 THEN 'Agosto'
                    WHEN 9 THEN 'Septiembre'
                    WHEN 10 THEN 'Octubre'
                    WHEN 11 THEN 'Noviembre'
                    WHEN 12 THEN 'Diciembre'
                END || ' ' || año_param::TEXT)
            WHEN año_param IS NOT NULL THEN año_param::TEXT
            ELSE 'Total'
        END as periodo,
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as gastos_totales,
        COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) as ventas_totales,
        COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as utilidad,
        CASE 
            WHEN COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) > 0 
            THEN ROUND(((COALESCE(SUM(CASE WHEN tipo = 'venta' THEN monto ELSE 0 END), 0) - 
                         COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) / 
                         COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) * 100, 2)
            ELSE 0 
        END as margen_utilidad_porcentaje,
        COUNT(CASE WHEN tipo = 'gasto' THEN 1 END) as cantidad_gastos,
        COUNT(CASE WHEN tipo = 'venta' THEN 1 END) as cantidad_ventas
    FROM movimientos_financieros 
    WHERE 
        activo = true AND
        (año_param IS NULL OR año = año_param) AND
        (mes_param IS NULL OR mes = mes_param);
END;
$$ LANGUAGE plpgsql;

-- Migrar datos existentes
DO $$
DECLARE
    cuenta_record RECORD;
    asignacion_record RECORD;
BEGIN
    -- Registrar gastos para cuentas existentes
    FOR cuenta_record IN SELECT * FROM cuentas WHERE activa = true LOOP
        INSERT INTO movimientos_financieros (
            tipo,
            monto,
            fecha,
            mes,
            año,
            referencia_id,
            referencia_tipo,
            descripcion
        ) VALUES (
            'gasto',
            COALESCE(cuenta_record.precio_base, cuenta_record.precio_mensual, 0),
            cuenta_record.created_at,
            EXTRACT(MONTH FROM cuenta_record.created_at),
            EXTRACT(YEAR FROM cuenta_record.created_at),
            cuenta_record.id,
            'cuenta',
            'Gasto migrado de cuenta existente: ' || cuenta_record.nombre
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Registrar ventas para asignaciones existentes
    FOR asignacion_record IN 
        SELECT ua.*, s.nombre as servicio_nombre, c.nombre as cuenta_nombre
        FROM usuarios_asignaciones ua
        JOIN cuenta_usuarios cu ON ua.cuenta_usuario_id = cu.id
        JOIN cuentas c ON cu.cuenta_id = c.id
        JOIN servicios s ON c.servicio_id = s.id
        WHERE ua.activa = true 
    LOOP
        INSERT INTO movimientos_financieros (
            tipo,
            monto,
            fecha,
            mes,
            año,
            referencia_id,
            referencia_tipo,
            descripcion
        ) VALUES (
            'venta',
            COALESCE(asignacion_record.costo_suscripcion, 0),
            COALESCE(asignacion_record.fecha_contratacion::timestamp, asignacion_record.created_at),
            EXTRACT(MONTH FROM COALESCE(asignacion_record.fecha_contratacion::timestamp, asignacion_record.created_at)),
            EXTRACT(YEAR FROM COALESCE(asignacion_record.fecha_contratacion::timestamp, asignacion_record.created_at)),
            asignacion_record.id,
            'asignacion',
            'Venta migrada: perfil ' || COALESCE(asignacion_record.perfil_numero, 0) || 
            ' en ' || asignacion_record.cuenta_nombre || ' (' || asignacion_record.servicio_nombre || ')'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE '✅ Módulo de Control Financiero configurado exitosamente';
    RAISE NOTICE '💰 Datos existentes migrados correctamente';
END $$;
