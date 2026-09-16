-- Extensión para generación de UUID si no estuviese habilitada
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Tabla de sesiones
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY,
  username VARCHAR(255) NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Tabla de diagramas (Excalidraw)
CREATE TABLE IF NOT EXISTS diagrams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  data JSONB NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- Índices para optimizar búsquedas por sesión y fecha de modificación
CREATE INDEX IF NOT EXISTS idx_diagrams_session_id ON diagrams(session_id);
CREATE INDEX IF NOT EXISTS idx_diagrams_updated_at ON diagrams(updated_at DESC);
