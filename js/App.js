import { RenderDashboard }        from './Dashboard.js';
import { RenderComparativo }      from './Comparativo.js';
import { RenderObjetivoSucursal } from './ObjetivoSucursal.js';
import { RenderObjetivoVendedor } from './ObjetivoVendedor.js';
import { RenderParametro }        from './Parametro.js';

// ── Configuracion ─────────────────────────────────────
export const UrlApi   = 'https://nodoinformatica.ddns.net/sql';
export const TokenApi = 'e739a79537c4a57bde2c91e3118baa3232d12555370b0140146d265903397a9d';

// ── Cache en sesion ───────────────────────────────────
const Cache = {};

export async function LlamarSP(Reporte, Params = {}) {
  const UsarCache = Object.keys(Params).length === 0;
  if (UsarCache && Cache[Reporte]) return Cache[Reporte];

  const Esc = s => String(s).replace(/'/g, "''");
  let Sql = `Exec SpAdconApp @Reporte='${Reporte}'`;
  if (Params.Usuario  !== undefined) Sql += `, @Usuario='${Esc(Params.Usuario)}'`;
  if (Params.Clave    !== undefined) Sql += `, @Clave='${Esc(Params.Clave)}'`;
  if (Params.Anio     !== undefined) Sql += `, @Anio=${parseInt(Params.Anio)}`;
  if (Params.Mes      !== undefined) Sql += `, @Mes=${parseInt(Params.Mes)}`;
  if (Params.Sucursal !== undefined) Sql += `, @Sucursal='${Esc(Params.Sucursal)}'`;
  if (Params.Vendedor !== undefined) Sql += `, @Vendedor='${Esc(Params.Vendedor)}'`;
  if (Params.Importe  !== undefined) Sql += `, @Importe=${parseFloat(Params.Importe)}`;

  const Resp = await fetch(UrlApi, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${TokenApi}`
    },
    body: JSON.stringify({ sp: Sql })
  });
  if (!Resp.ok) throw new Error(`Error API: ${Resp.status}`);
  const Datos = await Resp.json();
  if (Datos.error) throw new Error(Datos.error);
  if (UsarCache) Cache[Reporte] = Datos;
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

// ── Sesion (localStorage) ─────────────────────────────
const SESSION_KEY = 'das_session';

function GuardarSesion(U) {
  localStorage.setItem(SESSION_KEY, JSON.stringify({ id: U.id, nombre: U.nombre, ts: Date.now() }));
}

function ObtenerSesion() {
  try {
    const R = localStorage.getItem(SESSION_KEY);
    if (!R) return null;
    const S = JSON.parse(R);
    if (Date.now() - S.ts > 24 * 60 * 60 * 1000) { localStorage.removeItem(SESSION_KEY); return null; }
    return S;
  } catch { return null; }
}

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

  try {
    const Datos = await LlamarSP('DAS_LOGIN', { Usuario, Clave: Contrasena });
    const Resp  = Datos[0];
    if (!Resp || !Resp.ok) {
      Alerta.textContent   = Resp?.mensaje ?? 'Usuario o contraseña incorrectos';
      Alerta.style.display = 'block';
      return;
    }
    GuardarSesion(Resp);
    MostrarApp();
    await RenderDashboard();
  } catch (E) {
    Alerta.textContent   = 'Error al conectar con el servidor';
    Alerta.style.display = 'block';
  } finally {
    Boton.disabled = false;
    Boton.textContent = 'Ingresar';
  }
}

async function CerrarSesion() {
  localStorage.removeItem(SESSION_KEY);
  LimpiarCache();
  MostrarLogin();
  document.getElementById('LoginUsuario').value    = '';
  document.getElementById('LoginContrasena').value = '';
}

// ── Inicio ────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }

  if (!ObtenerSesion()) {
    MostrarLogin();
  } else {
    MostrarApp();
    await RenderDashboard();
  }

  document.getElementById('LoginContrasena').addEventListener('keydown', (E) => {
    if (E.key === 'Enter') IniciarLogin();
  });

  document.getElementById('BotonLogin').onclick = IniciarLogin;

  const EsIOS        = /iphone|ipad|ipod/i.test(navigator.userAgent);
  const EsStandalone = window.navigator.standalone === true
                    || window.matchMedia('(display-mode: standalone)').matches;
  const BtnInstalar  = document.getElementById('BotonInstalar');

  if (EsStandalone) BtnInstalar.style.display = 'none';

  BtnInstalar.onclick = async () => {
    if (PromptInstalar) {
      PromptInstalar.prompt();
      const { outcome } = await PromptInstalar.userChoice;
      if (outcome === 'accepted') BtnInstalar.style.display = 'none';
      PromptInstalar = null;
    } else if (EsIOS) {
      const Banner = document.getElementById('BannerIOS');
      Banner.style.display = Banner.style.display === 'none' ? 'block' : 'none';
    } else {
      alert(
        'Para instalar ADCONAPP:\n\n' +
        '① Buscá el ícono de instalación (⊕ o monitor↓) en la barra de direcciones del navegador y hacé clic ahí.\n\n' +
        '② Si no aparece: Chrome ⋮ → "Instalar aplicacion"  /  Edge … → "Aplicaciones" → "Instalar este sitio"\n\n' +
        'Si ninguna opción aparece, abrí la app un par de veces más — Chrome la ofrece cuando detecta uso frecuente.'
      );
    }
  };

  if (EsIOS && !EsStandalone) {
    document.getElementById('BannerIOS').style.display = 'block';
  }

  document.getElementById('BotonRefrescar').onclick = async () => {
    const Btn = document.getElementById('BotonRefrescar');
    Btn.classList.add('Girando');
    LimpiarCache();
    await Renderizadores[VistaActual](true);
    Btn.classList.remove('Girando');
  };

  document.getElementById('BotonSalir').onclick = CerrarSesion;
});
