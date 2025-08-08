-- Add formato_correo column to servicios table
ALTER TABLE servicios 
ADD COLUMN formato_correo TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN servicios.formato_correo IS 'Email format template for generating account emails. Number will be inserted before @ symbol.';
