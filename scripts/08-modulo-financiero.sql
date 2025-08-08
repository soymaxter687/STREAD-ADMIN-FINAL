-- StreamAdmin - Módulo Financiero
-- Sistema completo de seguimiento de inversiones, ingresos y utilidades

-- Tabla para registrar inversiones (cuentas creadas)
CREATE TABLE IF NOT EXISTS inversiones (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
    monto_inversion DECIMAL(10,2) NOT NULL,
    fecha_inversion DATE NOT NULL DEFAULT CURRENT_DATE,
    mes_inversion INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
    año_inversion INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    descripcion TEXT,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla para registrar ingresos (asignaciones de usuarios)
CREATE TABLE IF NOT EXISTS ingresos (
    id SERIAL PRIMARY KEY,
    asignacion_id INTEGER REFERENCES usuarios_asignaciones(id) ON DELETE CASCADE,
    cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
    monto_ingreso DECIMAL(10,2) NOT NULL,
    fecha_ingreso DATE NOT NULL DEFAULT CURRENT_DATE,
    mes_ingreso INTEGER NOT NULL DEFAULT EXTRACT(MONTH FROM CURRENT_DATE),
    año_ingreso INTEGER NOT NULL DEFAULT EXTRACT(YEAR FROM CURRENT_DATE),
    descripcion TEXT,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Índices para optimizar consultas financieras
CREATE INDEX IF NOT EXISTS idx_inversiones_fecha ON inversiones(fecha_inversion);
CREATE INDEX IF NOT EXISTS idx_inversiones_mes_año ON inversiones(mes_inversion, año_inversion);
CREATE INDEX IF NOT EXISTS idx_ingresos_fecha ON ingresos(fecha_ingreso);
CREATE INDEX IF NOT EXISTS idx_ingresos_mes_año ON ingresos(mes_ingreso, año_ingreso);
CREATE INDEX IF NOT EXISTS idx_inversiones_cuenta ON inversiones(cuenta_id);
CREATE INDEX IF NOT EXISTS idx_ingresos_cuenta ON ingresos(cuenta_id);

-- Función para registrar inversión automáticamente al crear cuenta
CREATE OR REPLACE FUNCTION registrar_inversion_cuenta()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO inversiones (
        cuenta_id,
        servicio_id,
        monto_inversion,
        fecha_inversion,
        mes_inversion,
        año_inversion,
        descripcion
    ) VALUES (
        NEW.id,
        NEW.servicio_id,
        NEW.precio_base,
        CURRENT_DATE,
        EXTRACT(MONTH FROM CURRENT_DATE),
        EXTRACT(YEAR FROM CURRENT_DATE),
        'Inversión automática por creación de cuenta: ' || NEW.nombre
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para registrar ingreso automáticamente al asignar usuario
CREATE OR REPLACE FUNCTION registrar_ingreso_asignacion()
RETURNS TRIGGER AS $$
DECLARE
    cuenta_info RECORD;
BEGIN
    -- Obtener información de la cuenta y servicio
    SELECT c.id as cuenta_id, c.servicio_id
    INTO cuenta_info
    FROM cuenta_usuarios cu
    JOIN cuentas c ON cu.cuenta_id = c.id
    WHERE cu.id = NEW.cuenta_usuario_id;
    
    INSERT INTO ingresos (
        asignacion_id,
        cuenta_id,
        cliente_id,
        servicio_id,
        monto_ingreso,
        fecha_ingreso,
        mes_ingreso,
        año_ingreso,
        descripcion
    ) VALUES (
        NEW.id,
        cuenta_info.cuenta_id,
        NEW.cliente_id,
        cuenta_info.servicio_id,
        NEW.costo_suscripcion,
        NEW.fecha_contratacion,
        EXTRACT(MONTH FROM NEW.fecha_contratacion::date),
        EXTRACT(YEAR FROM NEW.fecha_contratacion::date),
        'Ingreso por asignación de perfil ' || NEW.perfil_numero
    );
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para actualizar ingreso cuando se modifica asignación
CREATE OR REPLACE FUNCTION actualizar_ingreso_asignacion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ingresos 
    SET 
        monto_ingreso = NEW.costo_suscripcion,
        fecha_ingreso = NEW.fecha_contratacion,
        mes_ingreso = EXTRACT(MONTH FROM NEW.fecha_contratacion::date),
        año_ingreso = EXTRACT(YEAR FROM NEW.fecha_contratacion::date),
        updated_at = NOW()
    WHERE asignacion_id = NEW.id;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Función para desactivar ingreso cuando se elimina asignación
CREATE OR REPLACE FUNCTION desactivar_ingreso_asignacion()
RETURNS TRIGGER AS $$
BEGIN
    UPDATE ingresos 
    SET activo = false, updated_at = NOW()
    WHERE asignacion_id = OLD.id;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql;

-- Triggers para automatizar el registro financiero
CREATE TRIGGER trigger_registrar_inversion_cuenta
    AFTER INSERT ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION registrar_inversion_cuenta();

CREATE TRIGGER trigger_registrar_ingreso_asignacion
    AFTER INSERT ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION registrar_ingreso_asignacion();

CREATE TRIGGER trigger_actualizar_ingreso_asignacion
    AFTER UPDATE ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION actualizar_ingreso_asignacion();

CREATE TRIGGER trigger_desactivar_ingreso_asignacion
    AFTER DELETE ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION desactivar_ingreso_asignacion();

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
    COALESCE(total_inversiones, 0) as inversion_total,
    COALESCE(total_ingresos, 0) as ingresos_totales,
    COALESCE(total_ingresos, 0) - COALESCE(total_inversiones, 0) as utilidad,
    CASE 
        WHEN COALESCE(total_inversiones, 0) > 0 
        THEN ROUND(((COALESCE(total_ingresos, 0) - COALESCE(total_inversiones, 0)) / COALESCE(total_inversiones, 0)) * 100, 2)
        ELSE 0 
    END as margen_utilidad_porcentaje
FROM (
    SELECT 
        COALESCE(inv.año, ing.año) as año,
        COALESCE(inv.mes, ing.mes) as mes,
        inv.total_inversiones,
        ing.total_ingresos
    FROM (
        SELECT 
            año_inversion as año,
            mes_inversion as mes,
            SUM(monto_inversion) as total_inversiones
        FROM inversiones 
        WHERE activa = true
        GROUP BY año_inversion, mes_inversion
    ) inv
    FULL OUTER JOIN (
        SELECT 
            año_ingreso as año,
            mes_ingreso as mes,
            SUM(monto_ingreso) as total_ingresos
        FROM ingresos 
        WHERE activo = true
        GROUP BY año_ingreso, mes_ingreso
    ) ing ON inv.año = ing.año AND inv.mes = ing.mes
) resumen
ORDER BY año DESC, mes DESC;

-- Vista para detalles financieros por servicio
CREATE OR REPLACE VIEW vista_financiero_por_servicio AS
SELECT 
    s.nombre as servicio_nombre,
    s.emoji as servicio_emoji,
    año,
    mes,
    COALESCE(total_inversiones, 0) as inversion_total,
    COALESCE(total_ingresos, 0) as ingresos_totales,
    COALESCE(total_ingresos, 0) - COALESCE(total_inversiones, 0) as utilidad,
    COALESCE(cuentas_activas, 0) as cuentas_activas,
    COALESCE(perfiles_ocupados, 0) as perfiles_ocupados
FROM servicios s
CROSS JOIN (
    SELECT DISTINCT año_inversion as año, mes_inversion as mes 
    FROM inversiones 
    UNION 
    SELECT DISTINCT año_ingreso as año, mes_ingreso as mes 
    FROM ingresos
) fechas
LEFT JOIN (
    SELECT 
        servicio_id,
        año_inversion as año,
        mes_inversion as mes,
        SUM(monto_inversion) as total_inversiones,
        COUNT(*) as cuentas_activas
    FROM inversiones 
    WHERE activa = true
    GROUP BY servicio_id, año_inversion, mes_inversion
) inv ON s.id = inv.servicio_id AND fechas.año = inv.año AND fechas.mes = inv.mes
LEFT JOIN (
    SELECT 
        servicio_id,
        año_ingreso as año,
        mes_ingreso as mes,
        SUM(monto_ingreso) as total_ingresos,
        COUNT(*) as perfiles_ocupados
    FROM ingresos 
    WHERE activo = true
    GROUP BY servicio_id, año_ingreso, mes_ingreso
) ing ON s.id = ing.servicio_id AND fechas.año = ing.año AND fechas.mes = ing.mes
WHERE s.activo = true
ORDER BY s.nombre, fechas.año DESC, fechas.mes DESC;

-- Función para obtener resumen financiero de un período específico
CREATE OR REPLACE FUNCTION obtener_resumen_financiero(
    año_param INTEGER DEFAULT NULL,
    mes_param INTEGER DEFAULT NULL
)
RETURNS TABLE (
    periodo TEXT,
    inversion_total DECIMAL(10,2),
    ingresos_totales DECIMAL(10,2),
    utilidad DECIMAL(10,2),
    margen_utilidad_porcentaje DECIMAL(5,2),
    cuentas_creadas INTEGER,
    perfiles_asignados INTEGER
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
        COALESCE(SUM(i.monto_inversion), 0) as inversion_total,
        COALESCE(SUM(ing.monto_ingreso), 0) as ingresos_totales,
        COALESCE(SUM(ing.monto_ingreso), 0) - COALESCE(SUM(i.monto_inversion), 0) as utilidad,
        CASE 
            WHEN COALESCE(SUM(i.monto_inversion), 0) > 0 
            THEN ROUND(((COALESCE(SUM(ing.monto_ingreso), 0) - COALESCE(SUM(i.monto_inversion), 0)) / COALESCE(SUM(i.monto_inversion), 0)) * 100, 2)
            ELSE 0 
        END as margen_utilidad_porcentaje,
        COALESCE(COUNT(DISTINCT i.cuenta_id), 0)::INTEGER as cuentas_creadas,
        COALESCE(COUNT(DISTINCT ing.asignacion_id), 0)::INTEGER as perfiles_asignados
    FROM inversiones i
    FULL OUTER JOIN ingresos ing ON (
        (año_param IS NULL OR (i.año_inversion = año_param AND ing.año_ingreso = año_param)) AND
        (mes_param IS NULL OR (i.mes_inversion = mes_param AND ing.mes_ingreso = mes_param))
    )
    WHERE 
        (año_param IS NULL OR i.año_inversion = año_param OR ing.año_ingreso = año_param) AND
        (mes_param IS NULL OR i.mes_inversion = mes_param OR ing.mes_ingreso = mes_param) AND
        (i.activa = true OR i.activa IS NULL) AND
        (ing.activo = true OR ing.activo IS NULL);
END;
$$ LANGUAGE plpgsql;
