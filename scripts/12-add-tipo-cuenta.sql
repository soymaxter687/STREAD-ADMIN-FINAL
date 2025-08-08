-- Agregar campo tipo_cuenta a la tabla cuentas
ALTER TABLE cuentas 
ADD COLUMN tipo_cuenta VARCHAR(20) DEFAULT 'compartida' CHECK (tipo_cuenta IN ('privada', 'compartida'));

-- Actualizar cuentas existentes como compartidas por defecto
UPDATE cuentas SET tipo_cuenta = 'compartida' WHERE tipo_cuenta IS NULL;
