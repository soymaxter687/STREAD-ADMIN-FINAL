-- StreamAdmin - Datos de Ejemplo
-- Ejecutar al final para poblar con datos de prueba

-- Insertar servicios populares
INSERT INTO servicios (nombre, descripcion, precio_mensual, emoji, usuarios_por_cuenta, pin_requerido) VALUES
('Netflix', 'Plataforma de streaming de películas y series', 15.99, '🎬', 4, true),
('Disney+', 'Contenido de Disney, Marvel, Star Wars y más', 12.99, '🏰', 4, true),
('Spotify', 'Música en streaming', 9.99, '🎵', 6, false),
('Prime Video', 'Video streaming de Amazon', 14.99, '📦', 3, true),
('HBO Max', 'Series y películas premium', 16.99, '🎭', 3, true),
('YouTube', 'Videos sin anuncios y YouTube Music', 11.99, '📺', 5, false),
('Apple TV+', 'Contenido original de Apple', 6.99, '🍎', 6, true),
('Paramount+', 'Películas y series de Paramount', 9.99, '⭐', 4, true);

-- Configurar PINs para Netflix
INSERT INTO servicio_pines (servicio_id, usuario_numero, pin, nombre_usuario) VALUES
(1, 1, '1234', 'USUARIO 1'),
(1, 2, '5678', 'USUARIO 2'),
(1, 3, '9012', 'USUARIO 3'),
(1, 4, '3456', 'USUARIO 4');
(1, 5, '3456', 'USUARIO 5');


-- Configurar PINs para Disney Plus
INSERT INTO servicio_pines (servicio_id, usuario_numero, pin, nombre_usuario) VALUES
(2, 1, '1234', 'USUARIO 1'),
(2, 2, '5678', 'USUARIO 2'),
(2, 3, '9012', 'USUARIO 3'),
(2, 4, '3456', 'USUARIO 4');
(2, 5, '3456', 'USUARIO 5');

-- Configurar usuarios para Amazon Prime Vdeo
(4, 1, '1234', 'USUARIO 1'),
(4, 2, '5678', 'USUARIO 2'),
(4, 3, '9012', 'USUARIO 3'),
(4, 4, '3456', 'USUARIO 4');
(4, 5, '3456', 'USUARIO 5');
(4, 6, '3456', 'USUARIO 6');

-- Insertar clientes de ejemplo
INSERT INTO clientes (nombre, telefono, email) VALUES
('Juan Pérez', '+1234567890', 'juan.perez@email.com'),
('María García', '+1234567891', 'maria.garcia@email.com'),
('Carlos López', '+1234567892', 'carlos.lopez@email.com'),
('Ana Martínez', '+1234567893', 'ana.martinez@email.com'),
('Luis Rodríguez', '+1234567894', 'luis.rodriguez@email.com'),
('Carmen Sánchez', '+1234567895', 'carmen.sanchez@email.com'),
('Pedro González', '+1234567896', 'pedro.gonzalez@email.com'),
('Laura Fernández', '+1234567897', 'laura.fernandez@email.com');

-- Insertar cuentas de ejemplo (los nombres se generarán automáticamente)
INSERT INTO cuentas (servicio_id, email, password, fecha_vencimiento, precio_mensual) VALUES
(1, 'netflix1@email.com', 'password123', '2024-12-31', 15.99),
(1, 'netflix2@email.com', 'password456', '2024-11-15', 15.99),
(2, 'disney1@email.com', 'disney123', '2024-12-25', 12.99),
(3, 'spotify1@email.com', 'spotify123', '2024-10-30', 9.99),
(4, 'prime1@email.com', 'prime123', '2025-01-15', 14.99);

-- Las asignaciones se pueden hacer manualmente desde la interfaz
-- para demostrar la funcionalidad de asignación visual

-- Verificar que todo se creó correctamente
SELECT 'Servicios creados:' as info, COUNT(*) as cantidad FROM servicios
UNION ALL
SELECT 'Clientes creados:', COUNT(*) FROM clientes
UNION ALL
SELECT 'Cuentas creadas:', COUNT(*) FROM cuentas
UNION ALL
SELECT 'Usuarios de cuenta creados:', COUNT(*) FROM cuenta_usuarios;
