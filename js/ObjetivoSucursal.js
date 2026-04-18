import { LlamarSP, Supa, FormatearGs, ClasePct, ClaseBarraPct, NombreMes, MostrarCargando } from './App.js';

export async function RenderObjetivoSucursal(Forzar = false) {
  const Contenedor = document.getElementById('ContenidoObjetivoSucursal');
  if (Contenedor.innerHTML && !Forzar) return;

  MostrarCargando('ObjetivoSucursal', true);
  Contenedor.innerHTML = '';

  try {
    const Hoy  = new Date();
    const Anio = Hoy.getFullYear();
    const Mes  = Hoy.getMonth() + 1;

    const Anios = [];
    for (let A = Anio - 1; A <= Anio + 1; A++) Anios.push(A);

    Contenedor.innerHTML = `
      <div class="FilaFiltro">
        <select class="Selector" id="ObjSucAnio">
          ${Anios.map(A => `<option value="${A}" ${A === Anio ? 'selected' : ''}>${A}</option>`).join('')}
        </select>
        <select class="Selector" id="ObjSucMes">
          ${Array.from({ length: 12 }, (_, I) => I + 1).map(M =>
            `<option value="${M}" ${M === Mes ? 'selected' : ''}>${NombreMes(M)}</option>`
          ).join('')}
        </select>
      </div>

      <div class="Tarjeta">
        <div class="TarjetaTitulo" id="TituloObjSuc">Cargando...</div>
        <div class="TablaContenedor">
          <table>
            <thead>
              <tr>
                <th>Sucursal</th>
                <th class="Derecha">Real</th>
                <th class="Derecha">Objetivo</th>
                <th class="Derecha">Diferencia</th>
                <th class="Derecha">%</th>
              </tr>
            </thead>
            <tbody id="CuerpoTablaObjSuc">
              <tr><td colspan="5" class="VacioMensaje">Cargando...</td></tr>
            </tbody>
          </table>
        </div>
      </div>
    `;

    await CargarTablaObjSuc();

    document.getElementById('ObjSucAnio').onchange = CargarTablaObjSuc;
    document.getElementById('ObjSucMes').onchange  = CargarTablaObjSuc;

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error: ${E.message}</div>`;
  } finally {
    MostrarCargando('ObjetivoSucursal', false);
  }
}

async function CargarTablaObjSuc() {
  const Anio = parseInt(document.getElementById('ObjSucAnio').value);
  const Mes  = parseInt(document.getElementById('ObjSucMes').value);
  const Cuerpo = document.getElementById('CuerpoTablaObjSuc');
  Cuerpo.innerHTML = '<tr><td colspan="5" class="VacioMensaje">Cargando...</td></tr>';

  document.getElementById('TituloObjSuc').textContent =
    `${NombreMes(Mes)} ${Anio}`;

  try {
    const Hoy       = new Date();
    const AnioActual = Hoy.getFullYear();
    const MesActual  = Hoy.getMonth() + 1;

    // Ventas reales: si es mes actual usamos VENTASXSUCURSAL, sino VENTASXMES
    let VentasPorSucursal = {};
    if (Anio === AnioActual && Mes === MesActual) {
      const Datos = await LlamarSP('VENTASXSUCURSAL');
      Datos.forEach(S => { VentasPorSucursal[S.Sucursal] = S.VentaMes; });
    } else {
      const Datos = await LlamarSP('VENTASXMES');
      Datos
        .filter(D => D.Anio === Anio && D.Mes === Mes)
        .forEach(D => {
          VentasPorSucursal[D.Sucursal] = (VentasPorSucursal[D.Sucursal] ?? 0) + D.Total;
        });
    }

    const { data: Objetivos } = await Supa
      .from('objetivo_sucursal')
      .select('sucursal, objetivo')
      .eq('anio', Anio)
      .eq('mes', Mes);

    const ObjetivoMap = {};
    (Objetivos ?? []).forEach(O => { ObjetivoMap[O.sucursal] = O.objetivo; });

    // Combinar todas las sucursales
    const Sucursales = [...new Set([
      ...Object.keys(VentasPorSucursal),
      ...Object.keys(ObjetivoMap)
    ])].sort();

    if (!Sucursales.length) {
      Cuerpo.innerHTML = '<tr><td colspan="5" class="VacioMensaje">Sin datos para este periodo</td></tr>';
      return;
    }

    let TotalReal = 0, TotalObj = 0;

    Cuerpo.innerHTML = Sucursales.map(Suc => {
      const Real = VentasPorSucursal[Suc] ?? null;
      const Obj  = ObjetivoMap[Suc] ?? null;
      const Dif  = Real !== null && Obj !== null ? Real - Obj : null;
      const Pct  = Obj > 0 && Real !== null ? (Real / Obj) * 100 : null;
      const PctW = Pct !== null ? Math.min(Pct, 100).toFixed(1) : 0;

      if (Real) TotalReal += Real;
      if (Obj)  TotalObj  += Obj;

      return `
        <tr>
          <td>${Suc}</td>
          <td class="Derecha">${Real !== null ? FormatearGs(Real) : '—'}</td>
          <td class="Derecha">${Obj  !== null ? FormatearGs(Obj)  : '—'}</td>
          <td class="Derecha ${Dif !== null ? (Dif >= 0 ? 'PctBueno' : 'PctMalo') : ''}">
            ${Dif !== null ? (Dif >= 0 ? '+' : '') + FormatearGs(Dif) : '—'}
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
        <td class="Derecha">${FormatearGs(TotalReal)}</td>
        <td class="Derecha">${TotalObj > 0 ? FormatearGs(TotalObj) : '—'}</td>
        <td class="Derecha ${TotalObj > 0 ? (DifTotal >= 0 ? 'PctBueno' : 'PctMalo') : ''}">
          ${TotalObj > 0 ? (DifTotal >= 0 ? '+' : '') + FormatearGs(DifTotal) : '—'}
        </td>
        <td class="Derecha ${PctTotal !== null ? ClasePct(PctTotal) : ''}">
          ${PctTotal !== null ? PctTotal.toFixed(1) + '%' : '—'}
        </td>
      </tr>`;

  } catch (E) {
    Cuerpo.innerHTML = `<tr><td colspan="5" class="VacioMensaje">${E.message}</td></tr>`;
  }
}
