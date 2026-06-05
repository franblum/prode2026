// =============================================================
// MOCK DATA SYSTEM - Funciona sin Supabase
// Persiste datos en localStorage para simular una base de datos
// =============================================================

const STORAGE_KEYS = {
  USER: 'prode_mock_user',
  PREDICTIONS: 'prode_mock_predictions',
  LEADERBOARD: 'prode_mock_leaderboard',
};

// --- Partidos de Ejemplo ---
const now = new Date();
const day = (d) => new Date(now.getTime() + d * 86400000).toISOString();

export const MOCK_MATCHES = [
  // Finalizados
  { id: 1, equipo_a: 'Argentina', equipo_b: 'Francia', fecha_hora: day(-5), goles_a: 3, goles_b: 3, hubo_roja: false, hubo_penal: true, estado: 'FINALIZADO' },
  { id: 2, equipo_a: 'Brasil', equipo_b: 'Alemania', fecha_hora: day(-3), goles_a: 2, goles_b: 1, hubo_roja: true, hubo_penal: false, estado: 'FINALIZADO' },
  // En Curso
  { id: 3, equipo_a: 'España', equipo_b: 'Italia', fecha_hora: day(0), goles_a: null, goles_b: null, hubo_roja: false, hubo_penal: false, estado: 'EN_CURSO' },
  // Pendientes
  { id: 4, equipo_a: 'Uruguay', equipo_b: 'Portugal', fecha_hora: day(1), goles_a: null, goles_b: null, hubo_roja: false, hubo_penal: false, estado: 'PENDIENTE' },
  { id: 5, equipo_a: 'Colombia', equipo_b: 'Inglaterra', fecha_hora: day(2), goles_a: null, goles_b: null, hubo_roja: false, hubo_penal: false, estado: 'PENDIENTE' },
  { id: 6, equipo_a: 'México', equipo_b: 'Holanda', fecha_hora: day(3), goles_a: null, goles_b: null, hubo_roja: false, hubo_penal: false, estado: 'PENDIENTE' },
  { id: 7, equipo_a: 'Japón', equipo_b: 'Bélgica', fecha_hora: day(4), goles_a: null, goles_b: null, hubo_roja: false, hubo_penal: false, estado: 'PENDIENTE' },
  { id: 8, equipo_a: 'Croacia', equipo_b: 'Marruecos', fecha_hora: day(5), goles_a: null, goles_b: null, hubo_roja: false, hubo_penal: false, estado: 'PENDIENTE' },
];

// --- Leaderboard Ficticio ---
const DEFAULT_LEADERBOARD = [
  { id: 'bot-1', nombre_usuario: 'GolazoDe10', puntos_totales: 42 },
  { id: 'bot-2', nombre_usuario: 'MessiFan', puntos_totales: 38 },
  { id: 'bot-3', nombre_usuario: 'ElPibe', puntos_totales: 35 },
  { id: 'bot-4', nombre_usuario: 'LaScaloneta', puntos_totales: 29 },
  { id: 'bot-5', nombre_usuario: 'Dibu4Ever', puntos_totales: 24 },
  { id: 'bot-6', nombre_usuario: 'Mundialista', puntos_totales: 20 },
  { id: 'bot-7', nombre_usuario: 'CrackTotal', puntos_totales: 15 },
];

// --- Mock Auth ---
export const mockAuth = {
  signUp({ email, password, options }) {
    const user = {
      id: 'mock-user-' + Date.now(),
      email,
      user_metadata: { username: options?.data?.username || 'Jugador' },
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return { data: { user, session: { user } }, error: null };
  },

  signInWithPassword({ email, password }) {
    // Simular login: si hay un user guardado con ese email, lo retorna
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    if (stored) {
      const user = JSON.parse(stored);
      if (user.email === email) {
        return { data: { user, session: { user } }, error: null };
      }
    }
    // Si no, creamos uno nuevo (modo demo)
    const user = {
      id: 'mock-user-' + Date.now(),
      email,
      user_metadata: { username: email.split('@')[0] },
    };
    localStorage.setItem(STORAGE_KEYS.USER, JSON.stringify(user));
    return { data: { user, session: { user } }, error: null };
  },

  signOut() {
    localStorage.removeItem(STORAGE_KEYS.USER);
    return { error: null };
  },

  getStoredUser() {
    const stored = localStorage.getItem(STORAGE_KEYS.USER);
    return stored ? JSON.parse(stored) : null;
  },
};

// --- Mock DB Operations ---
function getPredictions(userId) {
  const stored = localStorage.getItem(STORAGE_KEYS.PREDICTIONS);
  const all = stored ? JSON.parse(stored) : {};
  return all[userId] || [];
}

function savePrediction(userId, prediction) {
  const stored = localStorage.getItem(STORAGE_KEYS.PREDICTIONS);
  const all = stored ? JSON.parse(stored) : {};
  if (!all[userId]) all[userId] = [];

  const idx = all[userId].findIndex((p) => p.partido_id === prediction.partido_id);
  if (idx >= 0) {
    all[userId][idx] = { ...all[userId][idx], ...prediction };
  } else {
    all[userId].push(prediction);
  }
  localStorage.setItem(STORAGE_KEYS.PREDICTIONS, JSON.stringify(all));
  return all[userId];
}

function getLeaderboard(userId, username) {
  const board = [...DEFAULT_LEADERBOARD];
  const userPreds = getPredictions(userId);
  let userPts = 0;
  userPreds.forEach((p) => { userPts += p.puntos_ganados || 0; });
  board.push({ id: userId, nombre_usuario: username, puntos_totales: userPts });
  board.sort((a, b) => b.puntos_totales - a.puntos_totales);
  return board.slice(0, 10);
}

// Calculate points for finished matches
function calcPointsForPrediction(pred, match) {
  if (match.estado !== 'FINALIZADO') return 0;
  let pts = 0;
  if (pred.goles_a_prediccion === match.goles_a && pred.goles_b_prediccion === match.goles_b) {
    pts = 10;
  } else {
    const realDiff = Math.sign(match.goles_a - match.goles_b);
    const predDiff = Math.sign(pred.goles_a_prediccion - pred.goles_b_prediccion);
    if (realDiff === predDiff) pts = 5;
  }
  if (pred.predice_roja === match.hubo_roja) pts += 2;
  if (pred.predice_penal === match.hubo_penal) pts += 2;
  if (pred.usa_comodin) pts *= 2;
  return pts;
}

// --- Fake Supabase-like API ---
export const mockSupabase = {
  auth: {
    _listeners: [],
    onAuthStateChange(callback) {
      mockSupabase.auth._listeners.push(callback);
      // Check existing session
      const user = mockAuth.getStoredUser();
      if (user) {
        setTimeout(() => callback('SIGNED_IN', { user }), 100);
      }
      return { data: { subscription: { unsubscribe() {} } } };
    },
    async signUp(params) {
      const result = mockAuth.signUp(params);
      if (!result.error) {
        mockSupabase.auth._listeners.forEach((cb) => cb('SIGNED_IN', result.data.session));
      }
      return result;
    },
    async signInWithPassword(params) {
      const result = mockAuth.signInWithPassword(params);
      if (!result.error) {
        mockSupabase.auth._listeners.forEach((cb) => cb('SIGNED_IN', result.data.session));
      }
      return result;
    },
    async signOut() {
      const result = mockAuth.signOut();
      mockSupabase.auth._listeners.forEach((cb) => cb('SIGNED_OUT', null));
      return result;
    },
  },

  from(table) {
    return new MockQueryBuilder(table);
  },
};

class MockQueryBuilder {
  constructor(table) {
    this._table = table;
    this._filters = {};
    this._orderBy = null;
    this._limitVal = null;
    this._single = false;
    this._upsertData = null;
    this._selectFields = '*';
  }

  select(fields) { this._selectFields = fields; return this; }
  eq(field, val) { this._filters[field] = val; return this; }
  order(field, opts) { this._orderBy = { field, ...opts }; return this; }
  limit(n) { this._limitVal = n; return this; }
  single() { this._single = true; return this; }

  async upsert(data, opts) {
    if (this._table === 'pronosticos') {
      const match = MOCK_MATCHES.find((m) => m.id === data.partido_id);
      const pts = match ? calcPointsForPrediction(data, match) : 0;
      savePrediction(data.usuario_id, { ...data, puntos_ganados: pts });
      return { error: null };
    }
    return { error: null };
  }

  // Resolve the query
  then(resolve, reject) {
    try {
      let result = [];

      if (this._table === 'partidos') {
        result = [...MOCK_MATCHES];
        if (this._orderBy) {
          const { field, ascending } = this._orderBy;
          result.sort((a, b) => {
            const va = a[field], vb = b[field];
            return ascending ? (va > vb ? 1 : -1) : (va < vb ? 1 : -1);
          });
        }
      } else if (this._table === 'pronosticos') {
        const userId = this._filters.usuario_id;
        if (userId) result = getPredictions(userId);
      } else if (this._table === 'perfiles') {
        if (this._filters.id) {
          const user = mockAuth.getStoredUser();
          if (user) {
            const preds = getPredictions(user.id);
            let pts = 0;
            preds.forEach((p) => { pts += p.puntos_ganados || 0; });
            result = [{ id: user.id, nombre_usuario: user.user_metadata?.username || 'Jugador', puntos_totales: pts }];
          }
        } else {
          const user = mockAuth.getStoredUser();
          result = getLeaderboard(user?.id || '', user?.user_metadata?.username || 'Tú');
        }
      }

      if (this._limitVal) result = result.slice(0, this._limitVal);
      if (this._single) {
        resolve({ data: result[0] || null, error: result.length === 0 ? { message: 'Not found' } : null });
      } else {
        resolve({ data: result, error: null });
      }
    } catch (err) {
      resolve({ data: null, error: err });
    }
  }
}
