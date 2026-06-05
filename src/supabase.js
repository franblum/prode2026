import { createClient } from '@supabase/supabase-js';
import { mockSupabase } from './mockData';

// Intentar leer las variables de entorno de Vite
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || '';
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || '';

// Detectar si tenemos credenciales reales
const hasRealCredentials = supabaseUrl && supabaseAnonKey &&
  !supabaseUrl.includes('placeholder') &&
  !supabaseUrl.includes('tu-proyecto');

export const isMockMode = !hasRealCredentials;

if (isMockMode) {
  console.info(
    '🎮 [Modo Demo] Supabase no configurado — usando datos mock locales.\n' +
    'Para conectar a Supabase, crea un archivo .env con VITE_SUPABASE_URL y VITE_SUPABASE_ANON_KEY.'
  );
}

// Exportar el cliente real o el mock según la configuración
export const supabase = hasRealCredentials
  ? createClient(supabaseUrl, supabaseAnonKey)
  : mockSupabase;
