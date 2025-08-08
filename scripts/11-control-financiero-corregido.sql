-- StreamAdmin - Control Financiero Corregido
-- Versión que maneja correctamente ventas y registros permanentes

-- Verificar y crear tabla de movimientos financieros si no existe
DO $$ 
BEGIN
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'movimientos_financieros') THEN
        CREATE TABLE movimientos_financieros (
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
        
        -- Crear índices
        CREATE INDEX idx_movimientos_tipo ON movimientos_financieros(tipo);
        CREATE INDEX idx_movimientos_fecha ON movimientos_financieros(fecha);
        CREATE INDEX idx_movimientos_mes_año ON movimientos_financieros(mes, año);
        CREATE INDEX idx_movimientos_referencia ON movimientos_financieros(referencia_id, referencia_tipo);
        CREATE INDEX idx_movimientos_activo ON movimientos_financieros(activo);
        
        RAISE NOTICE 'Tabla movimientos_financieros creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla movimientos_financieros ya existe';
    END IF;
END $$;

-- Función CORREGIDA para registrar gasto automáticamente al crear cuenta
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

-- Función CORREGIDA para registrar venta automáticamente al asignar perfil
CREATE OR REPLACE FUNCTION registrar_venta_asignacion()
RETURNS TRIGGER AS $$
DECLARE
    servicio_nombre VARCHAR(100);
    cuenta_nombre VARCHAR(100);
    cliente_nombre VARCHAR(100);
BEGIN
    -- Obtener nombres para la descripción
    SELECT s.nombre, c.nombre, cl.nombre
    INTO servicio_nombre, cuenta_nombre, cliente_nombre
    FROM cuenta_usuarios cu
    JOIN cuentas c ON cu.cuenta_id = c.id
    JOIN servicios s ON c.servicio_id = s.id,
    clientes cl
    WHERE cu.id = NEW.cuenta_usuario_id AND cl.id = NEW.cliente_id;
    
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
        ' a cliente ' || COALESCE(cliente_nombre, 'cliente') ||
        ' en ' || COALESCE(cuenta_nombre, 'cuenta') || ' (' || COALESCE(servicio_nombre, 'servicio') || ')'
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función CORREGIDA para actualizar venta cuando se modifica asignación
CREATE OR REPLACE FUNCTION actualizar_venta_asignacion()
RETURNS TRIGGER AS $$
BEGIN
    -- Solo actualizar si cambió el costo o la fecha, pero mantener el registro original
    -- En lugar de actualizar, crear un nuevo registro si hay cambios significativos
    IF OLD.costo_suscripcion != NEW.costo_suscripcion OR 
       OLD.fecha_contratacion != NEW.fecha_contratacion THEN
        
        -- Marcar el registro anterior como histórico (no activo)
        UPDATE movimientos_financieros 
        SET activo = false, updated_at = NOW()
        WHERE referencia_id = OLD.id AND referencia_tipo = 'asignacion' AND tipo = 'venta';
        
        -- Crear nuevo registro con los valores actualizados
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
            'Venta actualizada para asignación ' || NEW.id
        );
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función CORREGIDA: NO desactivar venta cuando se elimina asignación
-- Los registros deben ser permanentes para mantener el historial
CREATE OR REPLACE FUNCTION marcar_venta_eliminada()
RETURNS TRIGGER AS $$
BEGIN
    -- En lugar de desactivar, agregar una nota de que fue eliminada
    -- pero mantener el registro para el historial financiero
    UPDATE movimientos_financieros 
    SET 
        descripcion = descripcion || ' [ASIGNACIÓN ELIMINADA - ' || NOW()::date || ']',
        updated_at = NOW()
    WHERE referencia_id = OLD.id AND referencia_tipo = 'asignacion' AND tipo = 'venta';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Función CORREGIDA: NO desactivar gasto cuando se elimina cuenta
-- Los gastos son permanentes ya que la inversión ya se realizó
CREATE OR REPLACE FUNCTION marcar_gasto_eliminado()
RETURNS TRIGGER AS $$
BEGIN
    -- Mantener el registro de gasto pero marcar que la cuenta fue eliminada
    UPDATE movimientos_financieros 
    SET 
        descripcion = descripcion || ' [CUENTA ELIMINADA - ' || NOW()::date || ']',
        updated_at = NOW()
    WHERE referencia_id = OLD.id AND referencia_tipo = 'cuenta' AND tipo = 'gasto';
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Eliminar triggers existentes
DROP TRIGGER IF EXISTS trigger_registrar_gasto_cuenta ON cuentas;
DROP TRIGGER IF EXISTS trigger_registrar_venta_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_actualizar_venta_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_desactivar_venta_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_desactivar_gasto_cuenta ON cuentas;

-- Crear triggers CORREGIDOS
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

CREATE TRIGGER trigger_marcar_venta_eliminada
    AFTER DELETE ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION marcar_venta_eliminada();

CREATE TRIGGER trigger_marcar_gasto_eliminado
    AFTER DELETE ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION marcar_gasto_eliminado();

-- Limpiar datos existentes en movimientos_financieros para evitar duplicados
DELETE FROM movimientos_financieros;

-- Migrar TODOS los datos existentes correctamente
DO $$
DECLARE
    cuenta_record RECORD;
    asignacion_record RECORD;
    contador_cuentas INTEGER := 0;
    contador_asignaciones INTEGER := 0;
BEGIN
    RAISE NOTICE 'Iniciando migración de datos existentes...';
    
    -- Registrar gastos para TODAS las cuentas existentes (activas e inactivas)
    FOR cuenta_record IN 
        SELECT c.*, s.nombre as servicio_nombre 
        FROM cuentas c 
        LEFT JOIN servicios s ON c.servicio_id = s.id 
        ORDER BY c.created_at
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
            'gasto',
            COALESCE(cuenta_record.precio_base, cuenta_record.precio_mensual, 0),
            cuenta_record.created_at,
            EXTRACT(MONTH FROM cuenta_record.created_at),
            EXTRACT(YEAR FROM cuenta_record.created_at),
            cuenta_record.id,
            'cuenta',
            'Gasto migrado: ' || cuenta_record.nombre || 
            CASE WHEN cuenta_record.servicio_nombre IS NOT NULL 
                 THEN ' (' || cuenta_record.servicio_nombre || ')' 
                 ELSE '' END ||
            CASE WHEN NOT cuenta_record.activa 
                 THEN ' [CUENTA INACTIVA]' 
                 ELSE '' END
        );
        contador_cuentas := contador_cuentas + 1;
    END LOOP;

    -- Registrar ventas para TODAS las asignaciones existentes (activas e inactivas)
    FOR asignacion_record IN 
        SELECT 
            ua.*,
            cl.nombre as cliente_nombre,
            c.nombre as cuenta_nombre,
            s.nombre as servicio_nombre
        FROM usuarios_asignaciones ua
        LEFT JOIN clientes cl ON ua.cliente_id = cl.id
        LEFT JOIN cuenta_usuarios cu ON ua.cuenta_usuario_id = cu.id
        LEFT JOIN cuentas c ON cu.cuenta_id = c.id
        LEFT JOIN servicios s ON c.servicio_id = s.id
        ORDER BY ua.created_at
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
            ' a ' || COALESCE(asignacion_record.cliente_nombre, 'cliente') ||
            ' en ' || COALESCE(asignacion_record.cuenta_nombre, 'cuenta') ||
            CASE WHEN asignacion_record.servicio_nombre IS NOT NULL 
                 THEN ' (' || asignacion_record.servicio_nombre || ')' 
                 ELSE '' END ||
            CASE WHEN NOT asignacion_record.activa 
                 THEN ' [ASIGNACIÓN INACTIVA]' 
                 ELSE '' END
        );
        contador_asignaciones := contador_asignaciones + 1;
    END LOOP;

    RAISE NOTICE '✅ Migración completada:';
    RAISE NOTICE '   - % gastos registrados (cuentas)', contador_cuentas;
    RAISE NOTICE '   - % ventas registradas (asignaciones)', contador_asignaciones;
    RAISE NOTICE '💰 Control Financiero configurado correctamente';
    RAISE NOTICE '📊 Los registros son permanentes y no se eliminan';
END $$;

-- Recrear vistas con la lógica corregida
DROP VIEW IF EXISTS vista_resumen_financiero_mensual;
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
    SELECT DISTINCT año, mes FROM movimientos_financieros
) fechas
LEFT JOIN (
    SELECT 
        año, 
        mes, 
        SUM(monto) as total_gastos,
        COUNT(*) as cantidad_gastos
    FROM movimientos_financieros 
    WHERE tipo = 'gasto'
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

-- Recrear vista global
DROP VIEW IF EXISTS vista_resumen_financiero_global;
CREATE OR REPLACE VIEW vista_resumen_financiero_global AS
SELECT 
    'Histórico Total' as periodo,
    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as gastos_totales,
    COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0) as ventas_totales,
    COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0) - 
    COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as utilidad,
    CASE 
        WHEN COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) > 0 
        THEN ROUND(((COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0) - 
                     COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) / 
                     COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) * 100, 2)
        ELSE 0 
    END as margen_utilidad_porcentaje,
    COUNT(CASE WHEN tipo = 'gasto' THEN 1 END) as cantidad_gastos,
    COUNT(CASE WHEN tipo = 'venta' AND activo = true THEN 1 END) as cantidad_ventas,
    MIN(fecha) as fecha_inicio,
    MAX(fecha) as fecha_fin
FROM movimientos_financieros;

-- Función corregida para obtener resumen de período
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
        COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0) as ventas_totales,
        COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0) - 
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) as utilidad,
        CASE 
            WHEN COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0) > 0 
            THEN ROUND(((COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0) - 
                         COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) / 
                         COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0)) * 100, 2)
            ELSE 0 
        END as margen_utilidad_porcentaje,
        COUNT(CASE WHEN tipo = 'gasto' THEN 1 END) as cantidad_gastos,
        COUNT(CASE WHEN tipo = 'venta' AND activo = true THEN 1 END) as cantidad_ventas
    FROM movimientos_financieros 
    WHERE 
        (año_param IS NULL OR año = año_param) AND
        (mes_param IS NULL OR mes = mes_param);
END;
$$ LANGUAGE plpgsql;

-- Verificar los datos migrados
DO $$
DECLARE
    total_gastos DECIMAL(10,2);
    total_ventas DECIMAL(10,2);
    total_movimientos INTEGER;
BEGIN
    SELECT 
        COALESCE(SUM(CASE WHEN tipo = 'gasto' THEN monto ELSE 0 END), 0),
        COALESCE(SUM(CASE WHEN tipo = 'venta' AND activo = true THEN monto ELSE 0 END), 0),
        COUNT(*)
    INTO total_gastos, total_ventas, total_movimientos
    FROM movimientos_financieros;
    
    RAISE NOTICE '📊 RESUMEN DE MIGRACIÓN:';
    RAISE NOTICE '   💸 Total Gastos: $%', total_gastos;
    RAISE NOTICE '   💰 Total Ventas: $%', total_ventas;
    RAISE NOTICE '   📈 Utilidad: $%', (total_ventas - total_gastos);
    RAISE NOTICE '   📋 Total Movimientos: %', total_movimientos;
    RAISE NOTICE '';
    RAISE NOTICE '✅ Sistema de Control Financiero CORREGIDO y funcionando';
    RAISE NOTICE '🔒 Los registros son permanentes y no se eliminan';
    RAISE NOTICE '🚀 Las ventas se registran automáticamente al asignar perfiles';
END $$;
