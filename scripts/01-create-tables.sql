-- StreamAdmin - Estructura de Base de Datos
-- Ejecutar en Supabase SQL Editor

-- Tabla de servicios digitales
CREATE TABLE IF NOT EXISTS servicios (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL UNIQUE,
    descripcion TEXT,
    precio_mensual DECIMAL(10,2) DEFAULT 0,
    imagen_url TEXT,
    emoji VARCHAR(10) DEFAULT '📺',
    usuarios_por_cuenta INTEGER DEFAULT 1,
    pin_requerido BOOLEAN DEFAULT false,
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de configuración de PINs por servicio
CREATE TABLE IF NOT EXISTS servicio_pines (
    id SERIAL PRIMARY KEY,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
    usuario_numero INTEGER NOT NULL,
    pin VARCHAR(10),
    nombre_usuario VARCHAR(50),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(servicio_id, usuario_numero)
);

-- Tabla de clientes
CREATE TABLE IF NOT EXISTS clientes (
    id SERIAL PRIMARY KEY,
    nombre VARCHAR(100) NOT NULL,
    telefono VARCHAR(20) NOT NULL,
    email VARCHAR(100),
    activo BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de cuentas de servicios
CREATE TABLE IF NOT EXISTS cuentas (
    id SERIAL PRIMARY KEY,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
    nombre VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL,
    password VARCHAR(100) NOT NULL,
    fecha_vencimiento DATE,
    precio_mensual DECIMAL(10,2) DEFAULT 0,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabla de usuarios por cuenta
CREATE TABLE IF NOT EXISTS cuenta_usuarios (
    id SERIAL PRIMARY KEY,
    cuenta_id INTEGER REFERENCES cuentas(id) ON DELETE CASCADE,
    servicio_id INTEGER REFERENCES servicios(id) ON DELETE CASCADE,
    usuario_numero INTEGER NOT NULL,
    pin VARCHAR(10),
    nombre_usuario VARCHAR(50),
    ocupado BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cuenta_id, usuario_numero)
);

-- Tabla de asignaciones cliente-usuario
CREATE TABLE IF NOT EXISTS usuarios_asignaciones (
    id SERIAL PRIMARY KEY,
    cliente_id INTEGER REFERENCES clientes(id) ON DELETE CASCADE,
    cuenta_usuario_id INTEGER REFERENCES cuenta_usuarios(id) ON DELETE CASCADE,
    fecha_asignacion DATE DEFAULT CURRENT_DATE,
    activa BOOLEAN DEFAULT true,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    UNIQUE(cuenta_usuario_id)
);

-- Índices para optimizar consultas
CREATE INDEX IF NOT EXISTS idx_servicios_activo ON servicios(activo);
CREATE INDEX IF NOT EXISTS idx_cuentas_servicio ON cuentas(servicio_id);
CREATE INDEX IF NOT EXISTS idx_cuentas_vencimiento ON cuentas(fecha_vencimiento);
CREATE INDEX IF NOT EXISTS idx_cuenta_usuarios_ocupado ON cuenta_usuarios(ocupado);
CREATE INDEX IF NOT EXISTS idx_asignaciones_activa ON usuarios_asignaciones(activa);

-- Actualizar timestamps automáticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- Aplicar trigger a todas las tablas
CREATE TRIGGER update_servicios_updated_at BEFORE UPDATE ON servicios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_servicio_pines_updated_at BEFORE UPDATE ON servicio_pines FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_clientes_updated_at BEFORE UPDATE ON clientes FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cuentas_updated_at BEFORE UPDATE ON cuentas FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_cuenta_usuarios_updated_at BEFORE UPDATE ON cuenta_usuarios FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
CREATE TRIGGER update_usuarios_asignaciones_updated_at BEFORE UPDATE ON usuarios_asignaciones FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
