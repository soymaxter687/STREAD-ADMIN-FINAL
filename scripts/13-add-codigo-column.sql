-- Agregar columna codigo a la tabla clientes
ALTER TABLE clientes 
ADD COLUMN codigo VARCHAR(4);

-- Crear índice para búsquedas rápidas por código
CREATE INDEX idx_clientes_codigo ON clientes(codigo);

-- Comentario para documentar el campo
COMMENT ON COLUMN clientes.codigo IS 'Código único de 4 dígitos para identificar al cliente';
