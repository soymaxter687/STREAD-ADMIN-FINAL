-- StreamAdmin - Cálculos de Ganancia por Cuenta
-- Ejecutar para implementar cálculos de ganancia automáticos

-- Función para calcular ganancia real de una cuenta
CREATE OR REPLACE FUNCTION calcular_ganancia_cuenta(cuenta_id_param INTEGER)
RETURNS TABLE (
    cuenta_id INTEGER,
    precio_base DECIMAL(10,2),
    perfiles_ocupados INTEGER,
    ingreso_total DECIMAL(10,2),
    ganancia_real DECIMAL(10,2)
) AS $$
BEGIN
    RETURN QUERY
    SELECT 
        c.id as cuenta_id,
        c.precio_base,
        COUNT(ua.id)::INTEGER as perfiles_ocupados,
        COALESCE(SUM(ua.costo_suscripcion), 0) as ingreso_total,
        COALESCE(SUM(ua.costo_suscripcion), 0) - c.precio_base as ganancia_real
    FROM cuentas c
    LEFT JOIN cuenta_usuarios cu ON c.id = cu.cuenta_id
    LEFT JOIN usuarios_asignaciones ua ON cu.id = ua.cuenta_usuario_id AND ua.activa = true
    WHERE c.id = cuenta_id_param
    GROUP BY c.id, c.precio_base;
END;
$$ LANGUAGE plpgsql;

-- Vista para obtener información completa de perfiles con datos para copiar
CREATE OR REPLACE VIEW vista_perfil_completo AS
SELECT 
    cu.id as cuenta_usuario_id,
    cu.usuario_numero as perfil_numero,
    cu.pin,
    cu.nombre_usuario,
    cu.ocupado,
    s.nombre as servicio_nombre,
    s.emoji as servicio_emoji,
    c.id as cuenta_id,
    c.nombre as cuenta_nombre,
    c.email as cuenta_email,
    c.password as cuenta_password,
    c.fecha_vencimiento as cuenta_vencimiento,
    c.precio_base,
    -- Información del cliente si está ocupado
    cl.nombre as cliente_nombre,
    cl.telefono as cliente_telefono,
    cl.email as cliente_email,
    ua.fecha_contratacion,
    ua.fecha_vencimiento_usuario,
    ua.costo_suscripcion,
    ua.id as asignacion_id,
    -- Datos formateados para copiar
    CASE 
        WHEN s.nombre ILIKE '%netflix%' THEN 'Netflix'
        WHEN s.nombre ILIKE '%disney%' THEN 'Disney'
        WHEN s.nombre ILIKE '%prime%' OR s.nombre ILIKE '%amazon%' THEN 'Prime'
        WHEN s.nombre ILIKE '%hbo%' THEN 'HBO'
        WHEN s.nombre ILIKE '%spotify%' THEN 'Spotify'
        WHEN s.nombre ILIKE '%youtube%' THEN 'YouTube'
        WHEN s.nombre ILIKE '%apple%' THEN 'Apple'
        WHEN s.nombre ILIKE '%paramount%' THEN 'Paramount'
        ELSE SPLIT_PART(s.nombre, ' ', 1)
    END as servicio_corto
FROM cuenta_usuarios cu
JOIN cuentas c ON cu.cuenta_id = c.id
JOIN servicios s ON cu.servicio_id = s.id
LEFT JOIN usuarios_asignaciones ua ON cu.id = ua.cuenta_usuario_id AND ua.activa = true
LEFT JOIN clientes cl ON ua.cliente_id = cl.id
ORDER BY s.nombre, c.nombre, cu.usuario_numero;

-- Índices para optimizar las consultas
CREATE INDEX IF NOT EXISTS idx_vista_perfil_ocupado ON cuenta_usuarios(ocupado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_costo ON usuarios_asignaciones(costo_suscripcion);
