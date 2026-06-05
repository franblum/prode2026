import { supabase } from './supabase';
import { initAdminPanel, showAdminPanel } from './admin.js';

// State variables
let currentUser = null;
let currentProfile = null;
let matchesData = [];
let predictionsData = [];
let leaderboardData = [];
let activeFilter = 'all';
let countdownIntervals = [];

// Flag Mapper for premium visuals
const FLAGS = {
  'Argentina': '🇦🇷', 'Brasil': '🇧🇷', 'Francia': '🇫🇷', 'Alemania': '🇩🇪',
  'España': '🇪🇸', 'Uruguay': '🇺🇾', 'Inglaterra': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Italia': '🇮🇹',
  'México': '🇲🇽', 'Portugal': '🇵🇹', 'Holanda': '🇳🇱', 'Países Bajos': '🇳🇱',
  'Bélgica': '🇧🇪', 'Croacia': '🇭🇷', 'Senegal': '🇸🇳', 'Marruecos': '🇲🇦',
  'Japón': '🇯🇵', 'EE. UU.': '🇺🇸', 'Estados Unidos': '🇺🇸', 'Canadá': '🇨🇦',
  'Ecuador': '🇪🇨', 'Colombia': '🇨🇴', 'Chile': '🇨🇱', 'Paraguay': '🇵🇾',
  'Bolivia': '🇧🇴', 'Perú': '🇵🇪', 'Venezuela': '🇻🇪'
};

const getTeamFlag = (teamName) => FLAGS[teamName] || '🏳️';

// --- CONFETTI ---
const launchConfetti = (container) => {
  const colors = ['#FFD700', '#22C55E', '#3B82F6', '#A855F7', '#EC4899'];
  for (let i = 0; i < 30; i++) {
    const confetti = document.createElement('div');
    confetti.className = 'confetti-piece';
    confetti.style.cssText = `
      left: ${Math.random() * 100}%;
      background: ${colors[Math.floor(Math.random() * colors.length)]};
      animation-delay: ${Math.random() * 0.5}s;
      animation-duration: ${1 + Math.random() * 1.5}s;
    `;
    container.appendChild(confetti);
    setTimeout(() => confetti.remove(), 2500);
  }
};

// --- TOAST NOTIFICATIONS ---
const showToast = (message, type = 'success') => {
  const container = document.getElementById('toast-container');
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'error' ? 'toast-error' : ''}`;
  
  const icon = type === 'error' ? 'fa-circle-xmark' : 'fa-circle-check';
  const iconColor = type === 'error' ? 'text-danger' : 'text-green';

  toast.innerHTML = `
    <i class="fa-solid ${icon} ${iconColor}"></i>
    <span class="toast-message">${message}</span>
  `;
  
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.animation = 'fadeIn 0.3s ease-out reverse';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
};

// --- COUNTDOWN TIMER ---
const getCountdown = (dateStr) => {
  const target = new Date(dateStr).getTime();
  const now = Date.now();
  const diff = target - now;
  
  if (diff <= 0) return null;
  
  const days = Math.floor(diff / 86400000);
  const hours = Math.floor((diff % 86400000) / 3600000);
  const mins = Math.floor((diff % 3600000) / 60000);
  const secs = Math.floor((diff % 60000) / 1000);
  
  if (days > 0) return `${days}d ${hours}h ${mins}m`;
  if (hours > 0) return `${hours}h ${mins}m ${secs}s`;
  return `${mins}m ${secs}s`;
};

// --- DOM ELEMENTS ---
const authScreen = document.getElementById('auth-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const authForm = document.getElementById('auth-form');
const authToggleLink = document.getElementById('auth-toggle-link');
const authSwitchText = document.getElementById('auth-switch-text');
const authSubmitBtn = document.getElementById('auth-submit-btn');
const authSubtitle = document.getElementById('auth-subtitle');
const usernameGroup = document.getElementById('username-group');

const userDisplayName = document.getElementById('user-display-name');
const userDisplayPoints = document.getElementById('user-display-points');
const logoutBtn = document.getElementById('logout-btn');
const adminNavBtn = document.getElementById('admin-nav-btn');
const matchesList = document.getElementById('matches-list');
const leaderboardList = document.getElementById('leaderboard-list');

let isLoginMode = false;

// --- TOGGLE AUTH MODE ---
const toggleAuthMode = (e) => {
  if (e) e.preventDefault();
  isLoginMode = !isLoginMode;
  
  if (isLoginMode) {
    authSubtitle.textContent = 'Iniciá sesión para ingresar a tus pronósticos';
    usernameGroup.classList.add('hidden');
    document.getElementById('auth-username').removeAttribute('required');
    authSubmitBtn.querySelector('span').textContent = 'Iniciar Sesión';
    authSwitchText.innerHTML = '¿No tenés una cuenta? <a href="#" id="auth-toggle-link">Registrate gratis</a>';
  } else {
    authSubtitle.textContent = 'Crea tu cuenta o inicia sesión para pronosticar';
    usernameGroup.classList.remove('hidden');
    document.getElementById('auth-username').setAttribute('required', 'required');
    authSubmitBtn.querySelector('span').textContent = 'Registrarse';
    authSwitchText.innerHTML = '¿Ya tenés una cuenta? <a href="#" id="auth-toggle-link">Iniciá Sesión</a>';
  }
  
  document.getElementById('auth-toggle-link').addEventListener('click', toggleAuthMode);
};

authToggleLink.addEventListener('click', toggleAuthMode);

// --- AUTHENTICATION ACTIONS ---
authForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const email = document.getElementById('auth-email').value.trim();
  const password = document.getElementById('auth-password').value;
  const username = document.getElementById('auth-username').value.trim();
  
  authSubmitBtn.disabled = true;
  authSubmitBtn.querySelector('span').textContent = isLoginMode ? 'Ingresando...' : 'Creando cuenta...';

  try {
    if (isLoginMode) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) throw error;
      showToast('¡Bienvenido de vuelta! 🎉');
    } else {
      const { data, error } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { username: username || 'Jugador' } }
      });
      if (error) throw error;
      
      if (data?.user && data?.session === null) {
        showToast('¡Registro exitoso! Verifica tu correo si es necesario.', 'success');
      } else {
        showToast('¡Cuenta creada correctamente! 🚀');
      }
    }
  } catch (error) {
    console.error(error);
    showToast(error.message || 'Ocurrió un error al autenticar', 'error');
  } finally {
    authSubmitBtn.disabled = false;
    authSubmitBtn.querySelector('span').textContent = isLoginMode ? 'Iniciar Sesión' : 'Registrarse';
  }
});

logoutBtn.addEventListener('click', async () => {
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    showToast('Sesión cerrada correctamente');
  } catch (error) {
    showToast('Error al cerrar sesión', 'error');
  }
});

// --- TRACK AUTHENTICATION STATE ---
supabase.auth.onAuthStateChange(async (event, session) => {
  if (session) {
    currentUser = session.user;
    authScreen.classList.add('hidden');
    dashboardScreen.classList.remove('hidden');
    dashboardScreen.classList.add('animate-enter');
    
    await fetchUserProfile();
    await loadDashboardData();
  } else {
    currentUser = null;
    currentProfile = null;
    authScreen.classList.remove('hidden');
    dashboardScreen.classList.add('hidden');
    // Clear countdown intervals
    countdownIntervals.forEach(clearInterval);
    countdownIntervals = [];
  }
});

// --- LOAD PROFILE DATA ---
const fetchUserProfile = async () => {
  try {
    const { data, error } = await supabase
      .from('perfiles')
      .select('*')
      .eq('id', currentUser.id)
      .single();

    if (error) {
      currentProfile = {
        id: currentUser.id,
        nombre_usuario: currentUser.user_metadata?.username || 'Jugador Anónimo',
        puntos_totales: 0,
        es_admin: false
      };
    } else {
      currentProfile = data;
    }
    
    userDisplayName.textContent = currentProfile.nombre_usuario;
    userDisplayPoints.textContent = `${currentProfile.puntos_totales} pts`;

    if (currentProfile.es_admin) {
      adminNavBtn.classList.remove('hidden');
    } else {
      adminNavBtn.classList.add('hidden');
    }
  } catch (err) {
    console.error('Error al cargar perfil:', err);
  }
};

// --- LOAD DASHBOARD DATA ---
const loadDashboardData = async () => {
  try {
    const { data: partidos, error: partidosErr } = await supabase
      .from('partidos')
      .select('*')
      .order('fecha_hora', { ascending: true });
      
    if (partidosErr) throw partidosErr;
    matchesData = partidos || [];

    const { data: pronosticos, error: pronosticosErr } = await supabase
      .from('pronosticos')
      .select('*')
      .eq('usuario_id', currentUser.id);
      
    if (pronosticosErr) throw pronosticosErr;
    predictionsData = pronosticos || [];

    const { data: leaderboard, error: leaderboardErr } = await supabase
      .from('perfiles')
      .select('id, nombre_usuario, puntos_totales')
      .order('puntos_totales', { ascending: false })
      .order('nombre_usuario', { ascending: true })
      .limit(10);
      
    if (leaderboardErr) throw leaderboardErr;
    leaderboardData = leaderboard || [];

    renderMatches();
    renderLeaderboard();
    startCountdowns();
  } catch (error) {
    console.error('Error cargando datos del dashboard:', error);
    showToast('Error cargando datos', 'error');
  }
};

// --- RENDER LEADERBOARD ---
const renderLeaderboard = () => {
  if (leaderboardData.length === 0) {
    leaderboardList.innerHTML = `<p class="text-muted text-center py-3">No hay jugadores registrados.</p>`;
    return;
  }

  leaderboardList.innerHTML = leaderboardData.map((item, idx) => {
    const isSelf = item.id === currentUser.id;
    const medals = ['🥇', '🥈', '🥉'];
    const medal = idx < 3 ? medals[idx] : '';
    return `
      <div class="leaderboard-item ${isSelf ? 'current-user' : ''}" style="animation-delay: ${idx * 0.06}s">
        <div class="rank-user-container">
          <div class="rank-number">${medal || (idx + 1)}</div>
          <span class="user-name-text">${item.nombre_usuario} ${isSelf ? '<span class="you-badge">Tú</span>' : ''}</span>
        </div>
        <span class="rank-points">${item.puntos_totales} pts</span>
      </div>
    `;
  }).join('');
};

// --- RENDER MATCHES ---
const renderMatches = () => {
  const filteredMatches = matchesData.filter(match => {
    if (activeFilter === 'all') return true;
    return match.estado === activeFilter;
  });

  if (filteredMatches.length === 0) {
    matchesList.innerHTML = `
      <div class="empty-state">
        <i class="fa-regular fa-folder-open"></i>
        <p>No hay partidos en esta categoría.</p>
      </div>
    `;
    return;
  }

  matchesList.innerHTML = filteredMatches.map((match, idx) => {
    const prediction = predictionsData.find(p => p.partido_id === match.id);
    
    const golesA = prediction ? prediction.goles_a_prediccion : '';
    const golesB = prediction ? prediction.goles_b_prediccion : '';
    const prediceRoja = prediction ? prediction.predice_roja : false;
    const predicePenal = prediction ? prediction.predice_penal : false;
    const usaComodin = prediction ? prediction.usa_comodin : false;
    const puntosGanados = prediction ? prediction.puntos_ganados : 0;

    const isFinalizado = match.estado === 'FINALIZADO';
    const isEnCurso = match.estado === 'EN_CURSO';
    
    const dateObj = new Date(match.fecha_hora);
    const dateStr = dateObj.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
    const timeStr = dateObj.toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' });

    const disabledAttr = isFinalizado || isEnCurso ? 'disabled' : '';
    
    const badgeClass = isFinalizado ? 'badge-finalizado' : isEnCurso ? 'badge-encurso' : 'badge-pendiente';
    const badgeIcon = isFinalizado ? 'fa-flag-checkered' : isEnCurso ? 'fa-circle-play' : 'fa-clock';

    return `
      <div class="match-card" data-match-id="${match.id}" style="animation-delay: ${idx * 0.08}s">
        <div class="match-info-header">
          <span><i class="fa-regular fa-calendar"></i> ${dateStr} · ${timeStr} hs</span>
          <div class="match-header-right">
            ${!isFinalizado && !isEnCurso ? `<span class="countdown-timer" data-target="${match.fecha_hora}"></span>` : ''}
            <span class="match-badge ${badgeClass}">
              <i class="fa-solid ${badgeIcon}"></i> ${match.estado.replace('_', ' ')}
            </span>
          </div>
        </div>
        
        <div class="match-body">
          <div class="team-container">
            <div class="team-flag">${getTeamFlag(match.equipo_a)}</div>
            <span class="team-name">${match.equipo_a}</span>
          </div>

          <div class="score-predictor-container">
            <input type="number" 
                   class="score-input predict-input-a" 
                   value="${golesA}" 
                   min="0" 
                   placeholder="-" 
                   ${disabledAttr} />
                   
            <div class="match-vs-container">
              <span class="match-vs">VS</span>
              ${isFinalizado ? `<div class="result-actual"><span class="result-label">Final</span><span class="result-score">${match.goles_a} - ${match.goles_b}</span></div>` : ''}
            </div>
            
            <input type="number" 
                   class="score-input predict-input-b" 
                   value="${golesB}" 
                   min="0" 
                   placeholder="-" 
                   ${disabledAttr} />
          </div>

          <div class="team-container">
            <div class="team-flag">${getTeamFlag(match.equipo_b)}</div>
            <span class="team-name">${match.equipo_b}</span>
          </div>
        </div>

        <div class="match-addons">
          <div class="addon-checkboxes">
            <label class="checkbox-label">
              <input type="checkbox" class="predict-roja" ${prediceRoja ? 'checked' : ''} ${disabledAttr} />
              <span class="checkbox-custom roja"><i class="fa-solid fa-square"></i></span>
              ¿Roja?
            </label>

            <label class="checkbox-label">
              <input type="checkbox" class="predict-penal" ${predicePenal ? 'checked' : ''} ${disabledAttr} />
              <span class="checkbox-custom penal"><i class="fa-solid fa-circle"></i></span>
              ¿Penal?
            </label>
          </div>

          <div class="match-actions">
            <button class="joker-toggle ${usaComodin ? 'active' : ''}" 
                    ${disabledAttr}>
              <i class="fa-solid fa-star"></i>
              <span>Comodín</span>
            </button>

            ${isFinalizado ? `
              <div class="points-won-badge ${puntosGanados >= 10 ? 'points-gold' : puntosGanados > 0 ? 'points-green' : 'points-zero'}">
                <i class="fa-solid fa-award"></i> +${puntosGanados} pts
              </div>
            ` : `
              <button class="btn btn-primary save-prediction-btn" data-match-id="${match.id}">
                <i class="fa-solid fa-check"></i> Guardar
              </button>
            `}
          </div>
        </div>
      </div>
    `;
  }).join('');

  // Bind save prediction events
  document.querySelectorAll('.save-prediction-btn').forEach(btn => {
    btn.addEventListener('click', savePredictionHandler);
  });

  // Bind joker toggle
  document.querySelectorAll('.joker-toggle:not([disabled])').forEach(btn => {
    btn.addEventListener('click', () => btn.classList.toggle('active'));
  });
};

// --- COUNTDOWNS ---
const startCountdowns = () => {
  countdownIntervals.forEach(clearInterval);
  countdownIntervals = [];
  
  const updateCountdowns = () => {
    document.querySelectorAll('.countdown-timer').forEach(el => {
      const target = el.getAttribute('data-target');
      const cd = getCountdown(target);
      if (cd) {
        el.innerHTML = `<i class="fa-solid fa-hourglass-half"></i> ${cd}`;
      } else {
        el.innerHTML = `<i class="fa-solid fa-circle-play"></i> ¡Arrancó!`;
      }
    });
  };
  
  updateCountdowns();
  const interval = setInterval(updateCountdowns, 1000);
  countdownIntervals.push(interval);
};

// --- SAVE PREDICTION ---
const savePredictionHandler = async (e) => {
  const matchId = parseInt(e.currentTarget.getAttribute('data-match-id'));
  const card = document.querySelector(`.match-card[data-match-id="${matchId}"]`);
  
  const golesAVal = card.querySelector('.predict-input-a').value;
  const golesBVal = card.querySelector('.predict-input-b').value;
  
  if (golesAVal === '' || golesBVal === '') {
    showToast('Ingresá goles para ambos equipos', 'error');
    card.classList.add('shake');
    setTimeout(() => card.classList.remove('shake'), 600);
    return;
  }

  const golesA = parseInt(golesAVal);
  const golesB = parseInt(golesBVal);
  const prediceRoja = card.querySelector('.predict-roja').checked;
  const predicePenal = card.querySelector('.predict-penal').checked;
  const usaComodin = card.querySelector('.joker-toggle').classList.contains('active');

  const btn = e.currentTarget;
  btn.disabled = true;
  btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';

  try {
    const { error } = await supabase
      .from('pronosticos')
      .upsert({
        usuario_id: currentUser.id,
        partido_id: matchId,
        goles_a_prediccion: golesA,
        goles_b_prediccion: golesB,
        predice_roja: prediceRoja,
        predice_penal: predicePenal,
        usa_comodin: usaComodin
      }, { onConflict: 'usuario_id,partido_id' });

    if (error) throw error;
    
    // Success animation
    card.classList.add('save-success');
    setTimeout(() => card.classList.remove('save-success'), 1500);
    
    showToast('¡Pronóstico guardado! ⚽');
    
    await loadDashboardData();
  } catch (error) {
    console.error('Error guardando predicción:', error);
    showToast(error.message || 'Error al guardar', 'error');
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardar';
  }
};

// --- FILTER TABS HANDLERS ---
document.querySelectorAll('.tab-btn').forEach(tab => {
  tab.addEventListener('click', (e) => {
    document.querySelectorAll('.tab-btn').forEach(t => t.classList.remove('active'));
    e.currentTarget.classList.add('active');
    activeFilter = e.currentTarget.getAttribute('data-filter');
    renderMatches();
    startCountdowns();
  });
});

// --- PARTICLES BACKGROUND ---
const initParticles = () => {
  const canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');
  
  const resize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
  resize();
  window.addEventListener('resize', resize);
  
  const particles = [];
  for (let i = 0; i < 50; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      size: Math.random() * 2 + 0.5,
      speedX: (Math.random() - 0.5) * 0.3,
      speedY: (Math.random() - 0.5) * 0.3,
      opacity: Math.random() * 0.4 + 0.1,
    });
  }
  
  const animate = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(p => {
      p.x += p.speedX;
      p.y += p.speedY;
      if (p.x < 0) p.x = canvas.width;
      if (p.x > canvas.width) p.x = 0;
      if (p.y < 0) p.y = canvas.height;
      if (p.y > canvas.height) p.y = 0;
      
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(255, 215, 0, ${p.opacity})`;
      ctx.fill();
    });
    
    // Draw connections
    particles.forEach((a, i) => {
      particles.slice(i + 1).forEach(b => {
        const dist = Math.hypot(a.x - b.x, a.y - b.y);
        if (dist < 120) {
          ctx.beginPath();
          ctx.moveTo(a.x, a.y);
          ctx.lineTo(b.x, b.y);
          ctx.strokeStyle = `rgba(255, 215, 0, ${0.05 * (1 - dist / 120)})`;
          ctx.lineWidth = 0.5;
          ctx.stroke();
        }
      });
    });
    
    requestAnimationFrame(animate);
  };
  
  animate();
};

// Init particles on load
initParticles();

// Bind Admin Panel logic
initAdminPanel(loadDashboardData);
adminNavBtn.addEventListener('click', showAdminPanel);
