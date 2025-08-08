-- StreamAdmin - Funciones y Triggers
-- Ejecutar después de crear las tablas

CREATE OR REPLACE FUNCTION generar_nombre_cuenta()
RETURNS TRIGGER AS $$
DECLARE
    cuenta_count INT;
    servicio_nombre TEXT;
    servicio_nombre_formateado TEXT;
BEGIN
    -- Obtener el nombre del servicio relacionado
    SELECT nombre INTO servicio_nombre FROM servicios WHERE id = NEW.servicio_id;

    -- Tomar la primera palabra del nombre del servicio y ponerla en mayúsculas
    servicio_nombre_formateado := UPPER(split_part(servicio_nombre, ' ', 1));

    -- Contar cuántas cuentas hay con ese servicio para numerarlas
    SELECT COUNT(*) + 1 INTO cuenta_count FROM cuentas WHERE servicio_id = NEW.servicio_id;

    -- Generar el nombre final de la cuenta (ejemplo: NETFLIX-1)
    NEW.nombre := servicio_nombre_formateado || '-' || cuenta_count;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql;




-- Trigger para generar nombres automáticamente
CREATE TRIGGER trigger_generar_nombre_cuenta
    BEFORE INSERT ON cuentas
    FOR EACH ROW
    WHEN (NEW.nombre IS NULL OR NEW.nombre = '')
    EXECUTE FUNCTION generar_nombre_cuenta();

-- Función para crear usuarios de cuenta automáticamente
CREATE OR REPLACE FUNCTION crear_usuarios_cuenta()
RETURNS TRIGGER AS $$
DECLARE
    usuarios_max INTEGER;
    i INTEGER;
    pin_config VARCHAR(10);
    nombre_config VARCHAR(50);
BEGIN
    -- Obtener configuración del servicio
    SELECT usuarios_por_cuenta INTO usuarios_max FROM servicios WHERE id = NEW.servicio_id;
    
    -- Crear usuarios para la cuenta
    FOR i IN 1..usuarios_max LOOP
        -- Obtener configuración de PIN si existe
        SELECT pin, nombre_usuario INTO pin_config, nombre_config 
        FROM servicio_pines 
        WHERE servicio_id = NEW.servicio_id AND usuario_numero = i;
        
        INSERT INTO cuenta_usuarios (
            cuenta_id, 
            servicio_id, 
            usuario_numero, 
            pin, 
            nombre_usuario
        ) VALUES (
            NEW.id, 
            NEW.servicio_id, 
            i, 
            pin_config, 
            nombre_config
        );
    END LOOP;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para crear usuarios automáticamente
CREATE TRIGGER trigger_crear_usuarios_cuenta
    AFTER INSERT ON cuentas
    FOR EACH ROW
    EXECUTE FUNCTION crear_usuarios_cuenta();

-- Función para sincronizar cambios en servicios con usuarios existentes
CREATE OR REPLACE FUNCTION sincronizar_usuario_servicio()
RETURNS TRIGGER AS $$
DECLARE
    cuenta_record RECORD;
    i INTEGER;
    pin_config VARCHAR(10);
    nombre_config VARCHAR(50);
BEGIN
    -- Si cambió el número de usuarios por cuenta
    IF OLD.usuarios_por_cuenta != NEW.usuarios_por_cuenta THEN
        -- Para cada cuenta de este servicio
        FOR cuenta_record IN SELECT id FROM cuentas WHERE servicio_id = NEW.id LOOP
            -- Si aumentó el número de usuarios
            IF NEW.usuarios_por_cuenta > OLD.usuarios_por_cuenta THEN
                -- Crear usuarios adicionales
                FOR i IN (OLD.usuarios_por_cuenta + 1)..NEW.usuarios_por_cuenta LOOP
                    SELECT pin, nombre_usuario INTO pin_config, nombre_config 
                    FROM servicio_pines 
                    WHERE servicio_id = NEW.id AND usuario_numero = i;
                    
                    INSERT INTO cuenta_usuarios (
                        cuenta_id, 
                        servicio_id, 
                        usuario_numero, 
                        pin, 
                        nombre_usuario
                    ) VALUES (
                        cuenta_record.id, 
                        NEW.id, 
                        i, 
                        pin_config, 
                        nombre_config
                    );
                END LOOP;
            -- Si disminuyó el número de usuarios
            ELSIF NEW.usuarios_por_cuenta < OLD.usuarios_por_cuenta THEN
                -- Eliminar usuarios excedentes (solo los no ocupados)
                DELETE FROM cuenta_usuarios 
                WHERE cuenta_id = cuenta_record.id 
                AND usuario_numero > NEW.usuarios_por_cuenta 
                AND ocupado = false;
            END IF;
        END LOOP;
    END IF;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar cambios en servicios
CREATE TRIGGER trigger_sincronizar_usuario_servicio
    AFTER UPDATE ON servicios
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_usuario_servicio();

-- Función para sincronizar PINs cuando se actualiza servicio_pines
CREATE OR REPLACE FUNCTION sincronizar_pines_usuarios()
RETURNS TRIGGER AS $$
BEGIN
    -- Actualizar todos los usuarios existentes con la nueva configuración
    UPDATE cuenta_usuarios 
    SET 
        pin = NEW.pin,
        nombre_usuario = NEW.nombre_usuario,
        updated_at = NOW()
    WHERE servicio_id = NEW.servicio_id 
    AND usuario_numero = NEW.usuario_numero;
    
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger para sincronizar PINs
CREATE TRIGGER trigger_sincronizar_pines_usuarios
    AFTER INSERT OR UPDATE ON servicio_pines
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_pines_usuarios();

-- Función para marcar usuario como ocupado/libre automáticamente
CREATE OR REPLACE FUNCTION sincronizar_usuario_ocupado()
RETURNS TRIGGER AS $$
BEGIN
    IF TG_OP = 'INSERT' THEN
        -- Marcar usuario como ocupado
        UPDATE cuenta_usuarios 
        SET ocupado = true, updated_at = NOW()
        WHERE id = NEW.cuenta_usuario_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        -- Marcar usuario como libre
        UPDATE cuenta_usuarios 
        SET ocupado = false, updated_at = NOW()
        WHERE id = OLD.cuenta_usuario_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$$ LANGUAGE plpgsql;

-- Triggers para sincronizar estado ocupado
CREATE TRIGGER trigger_usuario_ocupado_insert
    AFTER INSERT ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_usuario_ocupado();

CREATE TRIGGER trigger_usuario_ocupado_delete
    AFTER DELETE ON usuarios_asignaciones
    FOR EACH ROW
    EXECUTE FUNCTION sincronizar_usuario_ocupado();
