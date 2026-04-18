import { LlamarSP, Supa, FormatearGs, ClasePct, ClaseBarraPct, NombreMes, MostrarCargando } from './App.js';

export async function RenderObjetivoVendedor(Forzar = false) {
  const Contenedor = document.getElementById('ContenidoObjetivoVendedor');
  if (Contenedor.innerHTML && !Forzar) return;

  MostrarCargando('ObjetivoVendedor', true);
  Contenedor.innerHTML = '';

  try {
    const Hoy  = new Date();
    const Anio = Hoy.getFullYear();
    const Mes  = Hoy.getMonth() + 1;

    // Cargar catálogo de sucursales para el filtro
    const DatosSucursal = await LlamarSP('SUCURSAL');
    const Sucursales    = DatosSucursal.map(S => S.Sucursal);

    const Anios = [];
    for (let A = Anio - 1; A <= Anio + 1; A++) Anios.push(A);

    Contenedor.innerHTML = `
      <div class="FilaFiltro">
        <select class="Selector" id="ObjVenAnio">
          ${Anios.map(A => `<option value="${A}" ${A === Anio ? 'selected' : ''}>${A}</option>`).join('')}
        </select>
        <select class="Selector" id="ObjVenMes">
          ${Array.from({ length: 12 }, (_, I) => I + 1).map(M =>
            `<option value="${M}" ${M === Mes ? 'selected' : ''}>${NombreMes(M)}</option>`
          ).join('')}
        </select>
        <select class="Selector" id="ObjVenSucursal">
          <option value="">Todas las sucursales</option>
          ${Sucursales.map(S => `<option value="${S}">${S}</option>`).join('')}
        </select>
      </div>

      <div class="FilaFiltro">
        <input type="text" class="Selector" id="ObjVenBuscar"
          placeholder="Buscar vendedor..."
          style="flex:2; min-width:160px" />
      </div>

      <div class="Tarjeta">
        <div class="TarjetaTitulo" id="TituloObjVen">Cargando...</div>
        <div class="TablaContenedor">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th class="Derecha">Real</th>
                <th class="Derecha">Objetivo</th>
                <th class="Derecha">Diferencia</th>
                <th class="Derecha">%</th>
              </tr>
            </thead>
            <tbody id="CuerpoTablaObjVen">
              <tr><td colspan="6" class="VacioMensaje">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await CargarTablaObjVen();

    document.getElementById('ObjVenAnio').onchange      = CargarTablaObjVen;
    document.getElementById('ObjVenMes').onchange       = CargarTablaObjVen;
    document.getElementById('ObjVenSucursal').onchange  = CargarTablaObjVen;

    // Filtro por texto: muestra/oculta filas sin re-consultar
    document.getElementById('ObjVenBuscar').oninput = function() {
      const Texto = this.value.toLowerCase().trim();
      const Filas = document.querySelectorAll('#CuerpoTablaObjVen tr');
      let GrupoActual = null;
      let GrupoTieneVisible = false;

      Filas.forEach(Fila => {
        if (Fila.classList.contains('FilaGrupo')) {
          // Antes de procesar nuevo grupo, ocultar el anterior si no tuvo visibles
          if (GrupoActual && !GrupoTieneVisible) GrupoActual.style.display = 'none';
          GrupoActual = Fila;
          GrupoTieneVisible = false;
          Fila.style.display = '';
        } else if (Fila.style.fontWeight === '700' || Fila.querySelector('td')?.textContent === 'TOTAL') {
          // Fila total: siempre visible
          Fila.style.display = '';
        } else {
          const NombreVendedor = Fila.querySelector('td')?.textContent.toLowerCase() ?? '';
          const Visible = !Texto || NombreVendedor.includes(Texto);
          Fila.style.display = Visible ? '' : 'none';
          if (Visible) GrupoTieneVisible = true;
        }
      });
      // Ultimo grupo
      if (GrupoActual && !GrupoTieneVisible) GrupoActual.style.display = 'none';
    };

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error: ${E.message}</div>`;
  } finally {
    MostrarCargando('ObjetivoVendedor', false);
  }
}

async function CargarTablaObjVen() {
  const Anio     = parseInt(document.getElementById('ObjVenAnio').value);
  const Mes      = parseInt(document.getElementById('ObjVenMes').value);
  const Sucursal = document.getElementById('ObjVenSucursal').value;
  const Cuerpo   = document.getElementById('CuerpoTablaObjVen');

  Cuerpo.innerHTML = '<tr><td colspan="5" class="VacioMensaje">Cargando...</td></tr>';

  document.getElementById('TituloObjVen').textContent =
    `${NombreMes(Mes)} ${Anio}${Sucursal ? ' — ' + Sucursal : ''}`;

  try {
    const [DatosVendedor, RespObjetivos] = await Promise.all([
      LlamarSP('VENTASXVENDEDOR'),
      Supa.from('objetivo_vendedor').select('vendedor, sucursal, objetivo').eq('anio', Anio).eq('mes', Mes)
    ]);

    const ObjetivoMap = {};
    (RespObjetivos.data ?? []).forEach(O => { ObjetivoMap[O.vendedor] = O.objetivo; });

    const Filtrados = Sucursal
      ? DatosVendedor.filter(V => V.Sucursal === Sucursal)
      : DatosVendedor;

    if (!Filtrados.length) {
      Cuerpo.innerHTML = '<tr><td colspan="5" class="VacioMensaje">Sin datos para este periodo</td></tr>';
      return;
    }

    // Agrupar por sucursal
    const PorSucursal = {};
    Filtrados.forEach(V => {
      if (!PorSucursal[V.Sucursal]) PorSucursal[V.Sucursal] = [];
      PorSucursal[V.Sucursal].push(V);
    });

    let TotalReal = 0, TotalObj = 0;
    let Filas = '';

    Object.entries(PorSucursal).forEach(([Suc, Vendedores]) => {
      // Fila cabecera de grupo (solo si hay mas de una sucursal)
      if (!Sucursal) {
        Filas += `<tr class="FilaGrupo"><td colspan="5">${Suc}</td></tr>`;
      }

      Vendedores.forEach(V => {
        const Real = V.VentaMes ?? null;
        const Obj  = ObjetivoMap[V.Vendedor] ?? null;
        const Dif  = Real !== null && Obj !== null ? Real - Obj : null;
        const Pct  = Obj > 0 && Real !== null ? (Real / Obj) * 100 : null;
        const PctW = Pct !== null ? Math.min(Pct, 100).toFixed(1) : 0;

        if (Real) TotalReal += Real;
        if (Obj)  TotalObj  += Obj;

        Filas += `
          <tr>
            <td>${V.Vendedor}</td>
            <td class="Derecha">${Real !== null ? FormatearGs(Real) : '—'}</td>
            <td class="Derecha">${Obj  !== null ? FormatearGs(Obj)  : '—'}</td>
            <td class="Derecha ${Dif !== null ? (Dif >= 0 ? 'PctBueno' : 'PctMalo') : ''}">
              ${Dif !== null ? (Dif >= 0 ? '+' : '') + FormatearGs(Math.abs(Dif)) : '—'}
            </td>
            <td class="Derecha" style="min-width:90px">
              ${Pct !== null
                ? `<span class="${ClasePct(Pct)}">${Pct.toFixed(1)}%</span>
                   <div class="BarraProgreso">
                     <div class="BarraRelleno ${ClaseBarraPct(Pct)}" style="width:${PctW}%"></div>
                   </div>`
                : '—'}
            </td>
          </tr>`;
      });
    });

    Cuerpo.innerHTML = Filas;

    // Fila total
    const PctTotal = TotalObj > 0 ? (TotalReal / TotalObj) * 100 : null;
    const DifTotal = TotalReal - TotalObj;
    Cuerpo.innerHTML += `
      <tr style="border-top: 2px solid var(--borde); font-weight:700">
        <td>TOTAL</td>
        <td class="Derecha">${FormatearGs(TotalReal)}</td>
        <td class="Derecha">${TotalObj > 0 ? FormatearGs(TotalObj) : '—'}</td>
        <td class="Derecha ${TotalObj > 0 ? (DifTotal >= 0 ? 'PctBueno' : 'PctMalo') : ''}">
          ${TotalObj > 0 ? (DifTotal >= 0 ? '+' : '') + FormatearGs(Math.abs(DifTotal)) : '—'}
        </td>
        <td class="Derecha ${PctTotal !== null ? ClasePct(PctTotal) : ''}">
          ${PctTotal !== null ? PctTotal.toFixed(1) + '%' : '—'}
        </td>
      </tr>`;

  } catch (E) {
    Cuerpo.innerHTML = `<tr><td colspan="6" class="VacioMensaje">${E.message}</td></tr>`;
  }
}
