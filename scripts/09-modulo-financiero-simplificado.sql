-- StreamAdmin - Módulo Financiero Simplificado
-- Versión compatible que funciona sin dependencias complejas

-- Verificar si las tablas ya existen antes de crearlas
DO $$ 
BEGIN
    -- Crear tabla de inversiones si no existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'inversiones') THEN
        CREATE TABLE inversiones (
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
        
        -- Crear índices
        CREATE INDEX idx_inversiones_fecha ON inversiones(fecha_inversion);
        CREATE INDEX idx_inversiones_mes_año ON inversiones(mes_inversion, año_inversion);
        CREATE INDEX idx_inversiones_cuenta ON inversiones(cuenta_id);
        
        RAISE NOTICE 'Tabla inversiones creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla inversiones ya existe';
    END IF;

    -- Crear tabla de ingresos si no existe
    IF NOT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'ingresos') THEN
        CREATE TABLE ingresos (
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
        
        -- Crear índices
        CREATE INDEX idx_ingresos_fecha ON ingresos(fecha_ingreso);
        CREATE INDEX idx_ingresos_mes_año ON ingresos(mes_ingreso, año_ingreso);
        CREATE INDEX idx_ingresos_cuenta ON ingresos(cuenta_id);
        
        RAISE NOTICE 'Tabla ingresos creada exitosamente';
    ELSE
        RAISE NOTICE 'Tabla ingresos ya existe';
    END IF;
END $$;

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
        COALESCE(NEW.precio_base, NEW.precio_mensual, 0),
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
        COALESCE(NEW.costo_suscripcion, 0),
        COALESCE(NEW.fecha_contratacion::date, CURRENT_DATE),
        EXTRACT(MONTH FROM COALESCE(NEW.fecha_contratacion::date, CURRENT_DATE)),
        EXTRACT(YEAR FROM COALESCE(NEW.fecha_contratacion::date, CURRENT_DATE)),
        'Ingreso por asignación de perfil ' || COALESCE(NEW.perfil_numero, 0)
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
        monto_ingreso = COALESCE(NEW.costo_suscripcion, 0),
        fecha_ingreso = COALESCE(NEW.fecha_contratacion::date, CURRENT_DATE),
        mes_ingreso = EXTRACT(MONTH FROM COALESCE(NEW.fecha_contratacion::date, CURRENT_DATE)),
        año_ingreso = EXTRACT(YEAR FROM COALESCE(NEW.fecha_contratacion::date, CURRENT_DATE)),
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

-- Eliminar triggers existentes si existen
DROP TRIGGER IF EXISTS trigger_registrar_inversion_cuenta ON cuentas;
DROP TRIGGER IF EXISTS trigger_registrar_ingreso_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_actualizar_ingreso_asignacion ON usuarios_asignaciones;
DROP TRIGGER IF EXISTS trigger_desactivar_ingreso_asignacion ON usuarios_asignaciones;

-- Crear triggers para automatizar el registro financiero
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

-- Poblar tablas con datos existentes
DO $$
DECLARE
    cuenta_record RECORD;
    asignacion_record RECORD;
BEGIN
    -- Registrar inversiones para cuentas existentes
    FOR cuenta_record IN SELECT * FROM cuentas WHERE activa = true LOOP
        INSERT INTO inversiones (
            cuenta_id,
            servicio_id,
            monto_inversion,
            fecha_inversion,
            mes_inversion,
            año_inversion,
            descripcion
        ) VALUES (
            cuenta_record.id,
            cuenta_record.servicio_id,
            COALESCE(cuenta_record.precio_base, cuenta_record.precio_mensual, 0),
            cuenta_record.created_at::date,
            EXTRACT(MONTH FROM cuenta_record.created_at),
            EXTRACT(YEAR FROM cuenta_record.created_at),
            'Inversión migrada de cuenta existente: ' || cuenta_record.nombre
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    -- Registrar ingresos para asignaciones existentes
    FOR asignacion_record IN 
        SELECT ua.*, c.id as cuenta_id, c.servicio_id
        FROM usuarios_asignaciones ua
        JOIN cuenta_usuarios cu ON ua.cuenta_usuario_id = cu.id
        JOIN cuentas c ON cu.cuenta_id = c.id
        WHERE ua.activa = true 
    LOOP
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
            asignacion_record.id,
            asignacion_record.cuenta_id,
            asignacion_record.cliente_id,
            asignacion_record.servicio_id,
            COALESCE(asignacion_record.costo_suscripcion, 0),
            COALESCE(asignacion_record.fecha_contratacion::date, asignacion_record.created_at::date),
            EXTRACT(MONTH FROM COALESCE(asignacion_record.fecha_contratacion::date, asignacion_record.created_at::date)),
            EXTRACT(YEAR FROM COALESCE(asignacion_record.fecha_contratacion::date, asignacion_record.created_at::date)),
            'Ingreso migrado de asignación existente'
        ) ON CONFLICT DO NOTHING;
    END LOOP;

    RAISE NOTICE 'Datos existentes migrados al módulo financiero';
END $$;

-- Mensaje de confirmación
DO $$
BEGIN
    RAISE NOTICE '✅ Módulo Financiero configurado exitosamente';
    RAISE NOTICE '📊 Las inversiones se registrarán automáticamente al crear cuentas';
    RAISE NOTICE '💰 Los ingresos se registrarán automáticamente al asignar usuarios';
    RAISE NOTICE '🔄 Los datos existentes han sido migrados';
END $$;
