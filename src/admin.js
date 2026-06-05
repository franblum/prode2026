import { supabase } from './supabase.js';

// Elements
const adminScreen = document.getElementById('admin-screen');
const dashboardScreen = document.getElementById('dashboard-screen');
const backToDashboardBtn = document.getElementById('back-to-dashboard-btn');
const adminMatchesList = document.getElementById('admin-matches-list');
const adminCreateForm = document.getElementById('admin-create-match-form');

export const initAdminPanel = (refreshDashboardData) => {
  backToDashboardBtn.addEventListener('click', () => {
    adminScreen.classList.remove('animate-enter');
    setTimeout(() => {
      adminScreen.classList.add('hidden');
      dashboardScreen.classList.remove('hidden');
      setTimeout(() => dashboardScreen.classList.add('animate-enter'), 50);
      refreshDashboardData();
    }, 300);
  });

  adminCreateForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    const equipoA = document.getElementById('admin-equipo-a').value;
    const equipoB = document.getElementById('admin-equipo-b').value;
    const fechaHora = document.getElementById('admin-fecha-hora').value;

    const btn = e.submitter;
    btn.disabled = true;
    
    try {
      const { error } = await supabase.from('partidos').insert([
        {
          equipo_a: equipoA,
          equipo_b: equipoB,
          fecha_hora: new Date(fechaHora).toISOString(),
          estado: 'PENDIENTE'
        }
      ]);
      
      if (error) throw error;
      
      // showToast equivalent
      alert('Partido creado exitosamente');
      adminCreateForm.reset();
      loadAdminMatches();
    } catch (err) {
      alert('Error creando partido: ' + err.message);
    } finally {
      btn.disabled = false;
    }
  });
};

export const showAdminPanel = () => {
  dashboardScreen.classList.remove('animate-enter');
  setTimeout(() => {
    dashboardScreen.classList.add('hidden');
    adminScreen.classList.remove('hidden');
    setTimeout(() => adminScreen.classList.add('animate-enter'), 50);
    loadAdminMatches();
  }, 300);
};

export const loadAdminMatches = async () => {
  try {
    const { data, error } = await supabase
      .from('partidos')
      .select('*')
      .order('fecha_hora', { ascending: false });
      
    if (error) throw error;
    
    renderAdminMatches(data || []);
  } catch (err) {
    console.error('Error cargando partidos admin:', err);
    adminMatchesList.innerHTML = `<p class="text-danger">Error cargando partidos</p>`;
  }
};

const renderAdminMatches = (matches) => {
  if (matches.length === 0) {
    adminMatchesList.innerHTML = `<p class="text-muted text-center">No hay partidos.</p>`;
    return;
  }

  adminMatchesList.innerHTML = matches.map(match => {
    const isFinalizado = match.estado === 'FINALIZADO';
    return `
      <div class="match-card p-4" style="padding: 16px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
          <h4 style="margin: 0;">${match.equipo_a} vs ${match.equipo_b}</h4>
          <span class="match-badge ${isFinalizado ? 'badge-finalizado' : 'badge-pendiente'}">${match.estado}</span>
        </div>
        
        <form class="admin-update-match-form" data-id="${match.id}">
          <div style="display: flex; gap: 16px; align-items: center; margin-bottom: 12px; flex-wrap: wrap;">
            <div class="form-group" style="margin-bottom: 0;">
              <label>Goles ${match.equipo_a}</label>
              <input type="number" name="goles_a" value="${match.goles_a !== null ? match.goles_a : ''}" min="0" style="width: 80px; padding: 8px;" ${isFinalizado ? 'disabled' : ''} />
            </div>
            <div class="form-group" style="margin-bottom: 0;">
              <label>Goles ${match.equipo_b}</label>
              <input type="number" name="goles_b" value="${match.goles_b !== null ? match.goles_b : ''}" min="0" style="width: 80px; padding: 8px;" ${isFinalizado ? 'disabled' : ''} />
            </div>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
              <input type="checkbox" name="roja" ${match.hubo_roja ? 'checked' : ''} ${isFinalizado ? 'disabled' : ''}> Hubo Roja
            </label>
            <label style="display: flex; align-items: center; gap: 8px; font-size: 0.9rem;">
              <input type="checkbox" name="penal" ${match.hubo_penal ? 'checked' : ''} ${isFinalizado ? 'disabled' : ''}> Hubo Penal
            </label>
          </div>
          
          ${!isFinalizado ? `
            <div style="display: flex; gap: 10px;">
              <button type="button" class="btn btn-icon btn-primary save-match-btn" data-action="update" style="width: auto; padding: 8px 16px; font-size: 0.9rem;">
                <i class="fa-solid fa-save"></i> Guardar Progreso
              </button>
              <button type="button" class="btn btn-icon btn-danger-outline save-match-btn" data-action="finalize" style="width: auto; padding: 8px 16px; font-size: 0.9rem;">
                <i class="fa-solid fa-flag-checkered"></i> Finalizar (Repartir Puntos)
              </button>
            </div>
          ` : `<p class="text-muted" style="margin:0; font-size: 0.85rem;"><i class="fa-solid fa-lock"></i> Partido finalizado. Puntos repartidos.</p>`}
        </form>
      </div>
    `;
  }).join('');

  document.querySelectorAll('.save-match-btn').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const form = e.target.closest('form');
      const matchId = form.getAttribute('data-id');
      const action = e.target.closest('.save-match-btn').getAttribute('data-action');
      
      const golesA = form.querySelector('[name="goles_a"]').value;
      const golesB = form.querySelector('[name="goles_b"]').value;
      const roja = form.querySelector('[name="roja"]').checked;
      const penal = form.querySelector('[name="penal"]').checked;

      if (golesA === '' || golesB === '') {
        alert('Debes ingresar los goles de ambos equipos');
        return;
      }

      const updateData = {
        goles_a: parseInt(golesA),
        goles_b: parseInt(golesB),
        hubo_roja: roja,
        hubo_penal: penal,
        estado: action === 'finalize' ? 'FINALIZADO' : 'EN_CURSO'
      };

      if (action === 'finalize') {
        if(!confirm('¿Estás seguro de finalizar este partido? Esto calculará los puntos de todos los usuarios y no se puede deshacer.')) return;
      }

      e.target.disabled = true;
      try {
        const { error } = await supabase
          .from('partidos')
          .update(updateData)
          .eq('id', matchId);
          
        if (error) throw error;
        alert(action === 'finalize' ? 'Partido finalizado y puntos repartidos' : 'Partido actualizado');
        loadAdminMatches();
      } catch (err) {
        alert('Error: ' + err.message);
      }
    });
  });
};
