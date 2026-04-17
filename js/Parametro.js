import { LlamarSP, Supa, NombreMes, MostrarCargando } from './App.js';

let TabActiva = 'Sucursal';

export async function RenderParametro(Forzar = false) {
  const Contenedor = document.getElementById('ContenidoParametro');
  if (Contenedor.innerHTML && !Forzar) return;

  MostrarCargando('Parametro', true);
  Contenedor.innerHTML = '';

  try {
    const Hoy  = new Date();
    const Anio = Hoy.getFullYear();
    const Mes  = Hoy.getMonth() + 1;
    const Anios = [];
    for (let A = Anio - 1; A <= Anio + 1; A++) Anios.push(A);

    Contenedor.innerHTML = `
      <div class="TabLista">
        <button class="TabBoton Activo" id="TabBtnSucursal" onclick="CambiarTabParam('Sucursal')">Sucursales</button>
        <button class="TabBoton"        id="TabBtnVendedor" onclick="CambiarTabParam('Vendedor')">Vendedores</button>
      </div>

      <div class="FilaFiltro">
        <select class="Selector" id="ParamAnio">
          ${Anios.map(A => `<option value="${A}" ${A === Anio ? 'selected' : ''}>${A}</option>`).join('')}
        </select>
        <select class="Selector" id="ParamMes">
          ${Array.from({ length: 12 }, (_, I) => I + 1).map(M =>
            `<option value="${M}" ${M === Mes ? 'selected' : ''}>${NombreMes(M)}</option>`
          ).join('')}
        </select>
      </div>

      <div id="AlertaParam"></div>

      <div class="Tarjeta">
        <div class="TarjetaTitulo" id="TituloParam">Cargando...</div>
        <div class="TablaContenedor">
          <table>
            <thead id="EncabezadoParam"></thead>
            <tbody id="CuerpoTablaParam">
              <tr><td colspan="3" class="VacioMensaje">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
        <div style="margin-top:14px">
          <button class="Boton BotonPrimario BotonCompleto" id="BotonGuardarParam">Guardar objetivos</button>
        </div>
      </div>
    `;

    window.CambiarTabParam = (Tab) => {
      TabActiva = Tab;
      document.getElementById('TabBtnSucursal').classList.toggle('Activo', Tab === 'Sucursal');
      document.getElementById('TabBtnVendedor').classList.toggle('Activo', Tab === 'Vendedor');
      CargarTablaParam();
    };

    document.getElementById('ParamAnio').onchange = CargarTablaParam;
    document.getElementById('ParamMes').onchange  = CargarTablaParam;
    document.getElementById('BotonGuardarParam').onclick = GuardarObjetivos;

    await CargarTablaParam();

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error: ${E.message}</div>`;
  } finally {
    MostrarCargando('Parametro', false);
  }
}

async function CargarTablaParam() {
  const Anio   = parseInt(document.getElementById('ParamAnio').value);
  const Mes    = parseInt(document.getElementById('ParamMes').value);
  const Cuerpo = document.getElementById('CuerpoTablaParam');
  const Titulo = document.getElementById('TituloParam');
  const Encab  = document.getElementById('EncabezadoParam');

  LimpiarAlerta();
  Cuerpo.innerHTML = '<tr><td colspan="3" class="VacioMensaje">Cargando...</td></tr>';
  Titulo.textContent = `${TabActiva === 'Sucursal' ? 'Sucursales' : 'Vendedores'} — ${NombreMes(Mes)} ${Anio}`;

  try {
    if (TabActiva === 'Sucursal') {
      Encab.innerHTML = `<tr>
        <th>Sucursal</th>
        <th class="Derecha">Objetivo (M)</th>
      </tr>`;

      const [DatosSucursal, RespObj] = await Promise.all([
        LlamarSP('SUCURSAL'),
        Supa.from('objetivo_sucursal').select('sucursal, objetivo').eq('anio', Anio).eq('mes', Mes)
      ]);

      const ObjMap = {};
      (RespObj.data ?? []).forEach(O => { ObjMap[O.sucursal] = O.objetivo; });

      Cuerpo.innerHTML = DatosSucursal.map(S => `
        <tr>
          <td>${S.Sucursal}</td>
          <td class="Derecha">
            <input type="number" class="InputTabla"
              data-clave="${S.Sucursal}"
              value="${ObjMap[S.Sucursal] ?? ''}"
              placeholder="0.0"
              min="0" step="0.1" />
          </td>
        </tr>
      `).join('');

    } else {
      Encab.innerHTML = `<tr>
        <th>Vendedor</th>
        <th>Sucursal</th>
        <th class="Derecha">Objetivo (M)</th>
      </tr>`;

      const [DatosVendedor, RespObj] = await Promise.all([
        LlamarSP('VENDEDOR'),
        Supa.from('objetivo_vendedor').select('vendedor, objetivo').eq('anio', Anio).eq('mes', Mes)
      ]);

      const ObjMap = {};
      (RespObj.data ?? []).forEach(O => { ObjMap[O.vendedor] = O.objetivo; });

      Cuerpo.innerHTML = DatosVendedor.map(V => `
        <tr>
          <td>${V.Vendedor}</td>
          <td style="color:var(--texto-suave); font-size:12px">${V.Sucursal}</td>
          <td class="Derecha">
            <input type="number" class="InputTabla"
              data-clave="${V.Vendedor}"
              data-sucursal="${V.Sucursal}"
              value="${ObjMap[V.Vendedor] ?? ''}"
              placeholder="0.0"
              min="0" step="0.1" />
          </td>
        </tr>
      `).join('');
    }

  } catch (E) {
    Cuerpo.innerHTML = `<tr><td colspan="3" class="VacioMensaje">${E.message}</td></tr>`;
  }
}

async function GuardarObjetivos() {
  const Anio  = parseInt(document.getElementById('ParamAnio').value);
  const Mes   = parseInt(document.getElementById('ParamMes').value);
  const Boton = document.getElementById('BotonGuardarParam');

  LimpiarAlerta();
  Boton.disabled = true;
  Boton.textContent = 'Guardando...';

  try {
    const Inputs  = document.querySelectorAll('#CuerpoTablaParam .InputTabla');
    const Registros = [];

    Inputs.forEach(Input => {
      const Valor = parseFloat(Input.value);
      if (isNaN(Valor) || Valor <= 0) return;

      if (TabActiva === 'Sucursal') {
        Registros.push({
          sucursal: Input.dataset.clave,
          anio: Anio,
          mes: Mes,
          objetivo: Valor
        });
      } else {
        Registros.push({
          vendedor: Input.dataset.clave,
          sucursal: Input.dataset.sucursal,
          anio: Anio,
          mes: Mes,
          objetivo: Valor
        });
      }
    });

    if (!Registros.length) {
      MostrarAlerta('error', 'Ingrese al menos un objetivo mayor a cero');
      return;
    }

    const Tabla = TabActiva === 'Sucursal' ? 'objetivo_sucursal' : 'objetivo_vendedor';
    const CampoConflicto = TabActiva === 'Sucursal'
      ? 'sucursal, anio, mes'
      : 'vendedor, anio, mes';

    const { error } = await Supa
      .from(Tabla)
      .upsert(Registros, { onConflict: CampoConflicto });

    if (error) throw new Error(error.message);

    MostrarAlerta('exito', `${Registros.length} objetivo${Registros.length > 1 ? 's' : ''} guardado${Registros.length > 1 ? 's' : ''} correctamente`);

  } catch (E) {
    MostrarAlerta('error', `Error al guardar: ${E.message}`);
  } finally {
    Boton.disabled = false;
    Boton.textContent = 'Guardar objetivos';
  }
}

function MostrarAlerta(Tipo, Texto) {
  const El = document.getElementById('AlertaParam');
  El.className = `Alerta ${Tipo === 'exito' ? 'AlertaExito' : 'AlertaError'}`;
  El.textContent = Texto;
  if (Tipo === 'exito') setTimeout(LimpiarAlerta, 3000);
}

function LimpiarAlerta() {
  const El = document.getElementById('AlertaParam');
  if (El) { El.className = ''; El.textContent = ''; }
}
