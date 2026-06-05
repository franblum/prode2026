-- ==========================================
-- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS
-- PRODE / PRONÓSTICOS DEPORTIVOS MUNDIAL 2026
-- Ejecutar en el SQL Editor de Supabase
-- ==========================================

-- 0. Reiniciar base de datos (Limpieza total)
DROP TRIGGER IF EXISTS trigger_nuevo_usuario ON auth.users;
DROP TRIGGER IF EXISTS trigger_calcular_puntos ON partidos;
DROP FUNCTION IF EXISTS public.crear_perfil_nuevo_usuario() CASCADE;
DROP FUNCTION IF EXISTS calcular_puntos_partido() CASCADE;

DROP TABLE IF EXISTS pronosticos CASCADE;
DROP TABLE IF EXISTS partidos CASCADE;
DROP TABLE IF EXISTS perfiles CASCADE;

-- 1. Crear Tabla de Perfiles de Usuarios
CREATE TABLE perfiles (
    id UUID REFERENCES auth.users ON DELETE CASCADE PRIMARY KEY,
    nombre_usuario TEXT NOT NULL,
    puntos_totales INTEGER DEFAULT 0,
    es_admin BOOLEAN DEFAULT FALSE,
    creado_el TIMESTAMP WITH TIME ZONE DEFAULT TIMEZONE('utc'::text, NOW()) NOT NULL
);

-- 2. Crear Tabla de Partidos
CREATE TABLE partidos (
    id SERIAL PRIMARY KEY,
    equipo_a TEXT NOT NULL,
    equipo_b TEXT NOT NULL,
    fecha_hora TIMESTAMP WITH TIME ZONE NOT NULL,
    goles_a INTEGER DEFAULT NULL,
    goles_b INTEGER DEFAULT NULL,
    hubo_roja BOOLEAN DEFAULT FALSE,
    hubo_penal BOOLEAN DEFAULT FALSE,
    estado TEXT DEFAULT 'PENDIENTE' -- PENDIENTE, EN_CURSO, FINALIZADO
);

-- 3. Crear Tabla de Pronósticos (Predicciones de los usuarios)
CREATE TABLE pronosticos (
    id SERIAL PRIMARY KEY,
    usuario_id UUID REFERENCES perfiles(id) ON DELETE CASCADE NOT NULL,
    partido_id INTEGER REFERENCES partidos(id) ON DELETE CASCADE NOT NULL,
    goles_a_prediccion INTEGER NOT NULL,
    goles_b_prediccion INTEGER NOT NULL,
    predice_roja BOOLEAN DEFAULT FALSE,
    predice_penal BOOLEAN DEFAULT FALSE,
    usa_comodin BOOLEAN DEFAULT FALSE,
    puntos_ganados INTEGER DEFAULT 0,
    CONSTRAINT unco_usuario_partido UNIQUE (usuario_id, partido_id)
);

-- 4. Habilitar perfiles automáticos cuando alguien se registra en Supabase Auth
CREATE OR REPLACE FUNCTION public.crear_perfil_nuevo_usuario()
RETURNS TRIGGER AS $$
BEGIN
    INSERT INTO public.perfiles (id, nombre_usuario)
    VALUES (new.id, COALESCE(new.raw_user_meta_data->>'username', 'Jugador Anonimo'));
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger para nuevo usuario
CREATE OR REPLACE TRIGGER trigger_nuevo_usuario
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.crear_perfil_nuevo_usuario();

-- 5. Función para calcular puntos automáticamente al finalizar un partido
CREATE OR REPLACE FUNCTION calcular_puntos_partido()
RETURNS TRIGGER AS $$
DECLARE
    rec_pronostico RECORD;
    puntos INT;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- (Reemplazar la función con la lógica real de puntuación)
CREATE OR REPLACE FUNCTION calcular_puntos_partido()
RETURNS TRIGGER AS $$
DECLARE
    rec_pronostico RECORD;
    puntos INT;
BEGIN
    -- Solo se ejecuta si el partido pasa a estar FINALIZADO
    IF NEW.estado = 'FINALIZADO' AND OLD.estado != 'FINALIZADO' THEN
        
        -- Recorrer todos los pronósticos de este partido
        FOR rec_pronostico IN SELECT * FROM pronosticos WHERE partido_id = NEW.id LOOP
            puntos := 0;
            
            -- 1. Verificar Resultado Exacto (+10 pts)
            IF rec_pronostico.goles_a_prediccion = NEW.goles_a AND rec_pronostico.goles_b_prediccion = NEW.goles_b THEN
                puntos := 10;
            -- 2. Verificar Tendencia (+5 pts)
            ELSIF (NEW.goles_a > NEW.goles_b AND rec_pronostico.goles_a_prediccion > rec_pronostico.goles_b_prediccion) OR
                  (NEW.goles_a < NEW.goles_b AND rec_pronostico.goles_a_prediccion < rec_pronostico.goles_b_prediccion) OR
                  (NEW.goles_a = NEW.goles_b AND rec_pronostico.goles_a_prediccion = rec_pronostico.goles_b_prediccion) THEN
                puntos := 5;
            END IF;
            
            -- 3. Variable Especial: Tarjeta Roja (+2 pts)
            IF rec_pronostico.predice_roja = NEW.hubo_roja THEN
                puntos := puntos + 2;
            END IF;
            
            -- 4. Variable Especial: Penal (+2 pts)
            IF rec_pronostico.predice_penal = NEW.hubo_penal THEN
                puntos := puntos + 2;
            END IF;
            
            -- 5. Multiplicador por Comodín (Doble de puntos)
            IF rec_pronostico.usa_comodin = TRUE THEN
                puntos := puntos * 2;
            END IF;
            
            -- Actualizar los puntos ganados en este pronóstico específico
            UPDATE pronosticos 
            SET puntos_ganados = puntos 
            WHERE id = rec_pronostico.id;
            
            -- Sumar los puntos obtenidos al perfil general del usuario
            UPDATE perfiles 
            SET puntos_totales = puntos_totales + puntos 
            WHERE id = rec_pronostico.usuario_id;
        END LOOP;
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Trigger para calcular puntos automáticamente al finalizar
CREATE OR REPLACE TRIGGER trigger_calcular_puntos
    AFTER UPDATE ON partidos
    FOR EACH ROW
    EXECUTE FUNCTION calcular_puntos_partido();

-- 7. Cargar Partidos de la Fase de Grupos - Mundial FIFA 2026 (Fechas en UTC)
INSERT INTO partidos (equipo_a, equipo_b, fecha_hora, estado) VALUES
('México', 'Sudáfrica', '2026-06-11 17:00:00+00', 'PENDIENTE'),
('Canadá', 'Bosnia y Herzegovina', '2026-06-12 17:00:00+00', 'PENDIENTE'),
('Estados Unidos', 'Paraguay', '2026-06-12 21:00:00+00', 'PENDIENTE'),
('Brasil', 'Marruecos', '2026-06-13 18:00:00+00', 'PENDIENTE'),
('Catar', 'Suiza', '2026-06-13 22:00:00+00', 'PENDIENTE'),
('Alemania', 'Curaçao', '2026-06-14 17:00:00+00', 'PENDIENTE'),
('Países Bajos', 'Japón', '2026-06-14 21:00:00+00', 'PENDIENTE'),
('Argentina', 'Argelia', '2026-06-16 19:00:00+00', 'PENDIENTE'),
('Inglaterra', 'Croacia', '2026-06-17 17:00:00+00', 'PENDIENTE'),
('Portugal', 'RD Congo', '2026-06-17 21:00:00+00', 'PENDIENTE')
ON CONFLICT DO NOTHING;
