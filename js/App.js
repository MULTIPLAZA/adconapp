import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';
import { RenderDashboard }        from './Dashboard.js';
import { RenderComparativo }      from './Comparativo.js';
import { RenderObjetivoSucursal } from './ObjetivoSucursal.js';
import { RenderObjetivoVendedor } from './ObjetivoVendedor.js';
import { RenderParametro }        from './Parametro.js';

// ── Configuracion ─────────────────────────────────────
export const UrlApi   = 'https://apisql-production-665e.up.railway.app/sql';
export const TokenApi = '57e5a1ae078aa519deaa5832a2b43fc42aadc883b4514696506ef41e85aa89ad';

export const Supa = createClient(
  'https://pmfqrxyptdkjfsxzeuzl.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBtZnFyeHlwdGRramZzeHpldXpsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzY0NTAyNzUsImV4cCI6MjA5MjAyNjI3NX0.MovyyHyACKS4R81pIB7qNeh--gyPX1k7_nayAyiqjsk'
);

// ── Cache en sesion ───────────────────────────────────
const Cache = {};

export async function LlamarSP(Reporte) {
  if (Cache[Reporte]) return Cache[Reporte];
  const Resp = await fetch(UrlApi, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TokenApi}`
    },
    body: JSON.stringify({ sp: `Exec SpAdconApp @Reporte='${Reporte}'` })
  });
  if (!Resp.ok) throw new Error(`Error API: ${Resp.status}`);
  const Datos = await Resp.json();
  if (Datos.error) throw new Error(Datos.error);
  Cache[Reporte] = Datos;
  return Datos;
}

export function LimpiarCache() {
  Object.keys(Cache).forEach(K => delete Cache[K]);
}

// ── Utilidades ────────────────────────────────────────
export function FormatearGs(Valor) {
  if (Valor === null || Valor === undefined) return '—';
  const Signo = Valor < 0 ? '-' : '';
  const Abs   = Math.abs(Valor);
  if (Abs >= 1_000_000) {
    const M = Abs / 1_000_000;
    return Signo + new Intl.NumberFormat('es-PY', { minimumFractionDigits: 1, maximumFractionDigits: 1 }).format(M) + 'M';
  }
  if (Abs >= 1_000) {
    const K = Abs / 1_000;
    return Signo + new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(K) + 'K';
  }
  return Signo + new Intl.NumberFormat('es-PY', { minimumFractionDigits: 0, maximumFractionDigits: 0 }).format(Abs);
}

export function ClasePct(Pct) {
  if (Pct >= 100) return 'PctExcelente';
  if (Pct >= 80)  return 'PctBueno';
  if (Pct >= 60)  return 'PctRegular';
  return 'PctMalo';
}

export function ClaseBarraPct(Pct) {
  if (Pct >= 100) return 'BarraExcelente';
  if (Pct >= 80)  return 'BarraBueno';
  if (Pct >= 60)  return 'BarraRegular';
  return 'BarraMalo';
}

export function ClaseKpiFondo(Pct) {
  if (Pct >= 100) return 'KpiFondoExcelente';
  if (Pct >= 80)  return 'KpiFondoBueno';
  if (Pct >= 60)  return 'KpiFondoRegular';
  return 'KpiFondoMalo';
}

export function NombreMes(Mes) {
  return ['', 'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
    'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'][Mes];
}

export function MostrarCargando(Vista, Visible) {
  const El = document.getElementById(`Cargando${Vista}`);
  if (El) El.classList.toggle('Visible', Visible);
}

// ── Opciones Chart.js ─────────────────────────────────
export const OpcionesGrafico = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: {
    legend: {
      labels: { color: '#e2e4ef', font: { size: 11 }, boxWidth: 12 }
    }
  },
  scales: {
    x: {
      ticks: { color: '#8b90a7', font: { size: 11 } },
      grid:  { color: '#2e3247' }
    },
    y: {
      ticks: {
        color: '#8b90a7',
        font:  { size: 11 },
        callback: (V) => {
          const Abs = Math.abs(V);
          if (Abs >= 1_000_000) return (V / 1_000_000).toFixed(1) + 'M';
          if (Abs >= 1_000)     return Math.round(V / 1_000) + 'K';
          return V;
        }
      },
      grid: { color: '#2e3247' }
    }
  }
};

// ── Instalacion PWA ───────────────────────────────────
let PromptInstalar = null;

window.addEventListener('beforeinstallprompt', (E) => {
  E.preventDefault();
  PromptInstalar = E;
  const Btn = document.getElementById('BotonInstalar');
  if (Btn) Btn.style.display = 'flex';
});

window.addEventListener('appinstalled', () => {
  PromptInstalar = null;
  const Btn = document.getElementById('BotonInstalar');
  if (Btn) Btn.style.display = 'none';
});

// ── Router ────────────────────────────────────────────
const Renderizadores = {
  Dashboard:        RenderDashboard,
  Comparativo:      RenderComparativo,
  ObjetivoSucursal: RenderObjetivoSucursal,
  ObjetivoVendedor: RenderObjetivoVendedor,
  Parametro:        RenderParametro
};

let VistaActual = 'Dashboard';

window.Navegar = async function(Vista, Boton) {
  if (VistaActual === Vista) return;

  document.querySelectorAll('.Vista').forEach(S => S.classList.remove('Activo'));
  document.querySelectorAll('.NavBoton').forEach(B => B.classList.remove('Activo'));

  document.getElementById(`Vista${Vista}`).classList.add('Activo');
  Boton.classList.add('Activo');

  VistaActual = Vista;
  await Renderizadores[Vista]();
};

// ── Autenticacion ─────────────────────────────────────
function MostrarApp() {
  document.getElementById('LoginFondo').style.display    = 'none';
  document.getElementById('AppContenido').style.display = 'block';
  const Hoy = new Date();
  document.getElementById('FechaCabecera').textContent =
    Hoy.toLocaleDateString('es-PY', { weekday: 'short', day: 'numeric', month: 'short' });
}

function MostrarLogin() {
  document.getElementById('LoginFondo').style.display    = 'flex';
  document.getElementById('AppContenido').style.display = 'none';
}

async function IniciarLogin() {
  const Usuario    = document.getElementById('LoginUsuario').value.trim();
  const Contrasena = document.getElementById('LoginContrasena').value;
  const Alerta     = document.getElementById('LoginAlerta');
  const Boton      = document.getElementById('BotonLogin');

  Alerta.style.display = 'none';
  Boton.disabled = true;
  Boton.textContent = 'Ingresando...';

  const { error } = await Supa.auth.signInWithPassword({ email: Usuario, password: Contrasena });

  if (error) {
    Alerta.textContent   = 'Usuario o contrasena incorrectos';
    Alerta.style.display = 'block';
    Boton.disabled = false;
    Boton.textContent = 'Ingresar';
    return;
  }

  MostrarApp();
  await RenderDashboard();
}

async function CerrarSesion() {
  await Supa.auth.signOut();
  LimpiarCache();
  MostrarLogin();
  document.getElementById('LoginUsuario').value    = '';
  document.getElementById('LoginContrasena').value = '';
}

// ── Inicio ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  // Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  // Verificar sesion activa
  const { data: { session } } = await Supa.auth.getSession();

  if (!session) {
    MostrarLogin();
  } else {
    MostrarApp();
    await RenderDashboard();
  }

  // Login: Enter en contrasena
  document.getElementById('LoginContrasena').addEventListener('keydown', (E) => {
    if (E.key === 'Enter') IniciarLogin();
  });

  document.getElementById('BotonLogin').onclick = IniciarLogin;

  const EsIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const EsStandalone = window.navigator.standalone === true
                    || window.matchMedia('(display-mode: standalone)').matches;
  const BtnInstalar  = document.getElementById('BotonInstalar');

  // Si ya esta instalada como app, ocultar boton
  if (EsStandalone) BtnInstalar.style.display = 'none';

  // Boton instalar: comportamiento segun plataforma
  BtnInstalar.onclick = async () => {
    if (PromptInstalar) {
      // Android/Chrome: prompt nativo del sistema
      PromptInstalar.prompt();
      const { outcome } = await PromptInstalar.userChoice;
      if (outcome === 'accepted') BtnInstalar.style.display = 'none';
      PromptInstalar = null;
    } else if (EsIOS) {
      // iOS: toggle del banner con instrucciones
      const Banner = document.getElementById('BannerIOS');
      Banner.style.display = Banner.style.display === 'none' ? 'block' : 'none';
    } else {
      alert('Para instalar:\n• Chrome: menu ⋮ → "Instalar aplicacion"\n• Edge: menu … → "Aplicaciones" → "Instalar"');
    }
  };

  // Banner iOS: mostrar automaticamente al entrar
  if (EsIOS && !EsStandalone) {
    document.getElementById('BannerIOS').style.display = 'block';
  }

  // Boton refrescar
  document.getElementById('BotonRefrescar').onclick = async () => {
    const Btn = document.getElementById('BotonRefrescar');
    Btn.classList.add('Girando');
    LimpiarCache();
    await Renderizadores[VistaActual](true);
    Btn.classList.remove('Girando');
  };

  // Boton cerrar sesion
  document.getElementById('BotonSalir').onclick = CerrarSesion;

  // Escuchar cambios de sesion (expiracion automatica)
  Supa.auth.onAuthStateChange((Evento) => {
    if (Evento === 'SIGNED_OUT') MostrarLogin();
  });
});
