import { LlamarSP, Supa, FormatearMillon, ClasePct, ClaseBarraPct, NombreMes, MostrarCargando } from './App.js';

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

      <div class="Tarjeta">
        <div class="TarjetaTitulo" id="TituloObjVen">Cargando...</div>
        <div class="TablaContenedor">
          <table>
            <thead>
              <tr>
                <th>Vendedor</th>
                <th>Sucursal</th>
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

  Cuerpo.innerHTML = '<tr><td colspan="6" class="VacioMensaje">Cargando...</td></tr>';

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
      Cuerpo.innerHTML = '<tr><td colspan="6" class="VacioMensaje">Sin datos para este periodo</td></tr>';
      return;
    }

    let TotalReal = 0, TotalObj = 0;

    Cuerpo.innerHTML = Filtrados.map(V => {
      const Real = V.VentaMes ?? null;
      const Obj  = ObjetivoMap[V.Vendedor] ?? null;
      const Dif  = Real !== null && Obj !== null ? Real - Obj : null;
      const Pct  = Obj > 0 && Real !== null ? (Real / Obj) * 100 : null;
      const PctW = Pct !== null ? Math.min(Pct, 100).toFixed(1) : 0;

      if (Real) TotalReal += Real;
      if (Obj)  TotalObj  += Obj;

      return `
        <tr>
          <td>${V.Vendedor}</td>
          <td style="color:var(--texto-suave); font-size:12px">${V.Sucursal}</td>
          <td class="Derecha">${Real !== null ? FormatearMillon(Real) : '—'}</td>
          <td class="Derecha">${Obj  !== null ? FormatearMillon(Obj)  : '—'}</td>
          <td class="Derecha ${Dif !== null ? (Dif >= 0 ? 'PctBueno' : 'PctMalo') : ''}">
            ${Dif !== null ? (Dif >= 0 ? '+' : '') + FormatearMillon(Dif) : '—'}
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
    }).join('');

    // Fila total
    const PctTotal = TotalObj > 0 ? (TotalReal / TotalObj) * 100 : null;
    const DifTotal = TotalReal - TotalObj;
    Cuerpo.innerHTML += `
      <tr style="border-top: 2px solid var(--borde); font-weight:700">
        <td>TOTAL</td>
        <td></td>
        <td class="Derecha">${FormatearMillon(TotalReal)}</td>
        <td class="Derecha">${TotalObj > 0 ? FormatearMillon(TotalObj) : '—'}</td>
        <td class="Derecha ${TotalObj > 0 ? (DifTotal >= 0 ? 'PctBueno' : 'PctMalo') : ''}">
          ${TotalObj > 0 ? (DifTotal >= 0 ? '+' : '') + FormatearMillon(DifTotal) : '—'}
        </td>
        <td class="Derecha ${PctTotal !== null ? ClasePct(PctTotal) : ''}">
          ${PctTotal !== null ? PctTotal.toFixed(1) + '%' : '—'}
        </td>
      </tr>`;

  } catch (E) {
    Cuerpo.innerHTML = `<tr><td colspan="6" class="VacioMensaje">${E.message}</td></tr>`;
  }
}
