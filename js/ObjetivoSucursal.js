import { LlamarSP, Supa, FormatearGs, ClasePct, ClaseBarraPct, NombreMes, MostrarCargando } from './App.js';

let GraficoTorta = null;

const ColoresTorta = ['#4f8ef7', '#3db87a', '#f7a84f', '#e05252', '#a78bf7'];
const ColorResto   = '#3a3f55';

const RangosHora = [
  { Label: '08-10', Desde:  8, Hasta: 10 },
  { Label: '10-12', Desde: 10, Hasta: 12 },
  { Label: '12-14', Desde: 12, Hasta: 14 },
  { Label: '14-16', Desde: 14, Hasta: 16 },
  { Label: '16-18', Desde: 16, Hasta: 18 },
  { Label: '18-20', Desde: 18, Hasta: 20 },
  { Label: '20+',   Desde: 20, Hasta: 25 },
];

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

      <!-- Tabla principal -->
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

      <!-- Torta + Top 3 -->
      <div class="GridDoble">
        <div class="Tarjeta" style="margin-bottom:0">
          <div class="TarjetaTitulo">Top 5 por venta</div>
          <div class="GraficoContenedor" style="height:210px">
            <canvas id="GraficoTorta"></canvas>
          </div>
        </div>
        <div class="Tarjeta" style="margin-bottom:0">
          <div class="TarjetaTitulo">Top 3 caida — ultimos 30 dias vs año ant.</div>
          <div id="ContenidoTop3"></div>
        </div>
      </div>

      <!-- Horas concurridas -->
      <div class="Tarjeta" style="margin-top:14px">
        <div class="TarjetaTitulo">Promedio diario por rango horario — ultimos 7 dias</div>
        <div id="ContenidoHoras" class="TablaContenedor">
          <div class="VacioMensaje">Cargando...</div>
        </div>
      </div>
    `;

    await Promise.all([CargarTablaYGraficos(), CargarHoraSucursal()]);

    document.getElementById('ObjSucAnio').onchange = CargarTablaYGraficos;
    document.getElementById('ObjSucMes').onchange  = CargarTablaYGraficos;

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error: ${E.message}</div>`;
  } finally {
    MostrarCargando('ObjetivoSucursal', false);
  }
}

// ── Tabla + Torta + Top3 ──────────────────────────────
async function CargarTablaYGraficos() {
  const Anio = parseInt(document.getElementById('ObjSucAnio').value);
  const Mes  = parseInt(document.getElementById('ObjSucMes').value);
  const Cuerpo = document.getElementById('CuerpoTablaObjSuc');
  Cuerpo.innerHTML = '<tr><td colspan="5" class="VacioMensaje">Cargando...</td></tr>';
  document.getElementById('TituloObjSuc').textContent = `${NombreMes(Mes)} ${Anio}`;

  try {
    const Hoy       = new Date();
    const AnioAct   = Hoy.getFullYear();
    const MesAct    = Hoy.getMonth() + 1;

    // Ventas reales del mes seleccionado
    let VentasPorSucursal = {};
    if (Anio === AnioAct && Mes === MesAct) {
      const Datos = await LlamarSP('VENTASXSUCURSAL');
      Datos.forEach(S => { VentasPorSucursal[S.Sucursal] = S.VentaMes; });
    } else {
      const Datos = await LlamarSP('VENTASXMES');
      Datos.filter(D => D.Anio === Anio && D.Mes === Mes)
           .forEach(D => { VentasPorSucursal[D.Sucursal] = (VentasPorSucursal[D.Sucursal] ?? 0) + D.Total; });
    }

    // Ventas ultimos 30 dias vs mismos 30 dias año anterior (para Top 3 caida)
    // Se usa ayer como ultimo dia completo para evitar parciales del dia en curso
    const Ayer        = new Date(Hoy); Ayer.setDate(Ayer.getDate() - 1);
    const Inicio30Act = new Date(Ayer); Inicio30Act.setDate(Inicio30Act.getDate() - 29);
    const Fin30Ant    = new Date(Ayer); Fin30Ant.setFullYear(Fin30Ant.getFullYear() - 1);
    const Inicio30Ant = new Date(Inicio30Act); Inicio30Ant.setFullYear(Inicio30Ant.getFullYear() - 1);

    const FStr = (D) => D.toISOString().substring(0, 10);
    const [FA0, FA1, FB0, FB1] = [FStr(Inicio30Act), FStr(Ayer), FStr(Inicio30Ant), FStr(Fin30Ant)];

    const DatosVentasDia = await LlamarSP('VENTASXDIA');
    const Ventas30Act = {}, Ventas30Ant = {};
    DatosVentasDia.forEach(D => {
      const F   = String(D.Fecha ?? '').substring(0, 10);
      const Suc = D.Sucursal;
      if (F >= FA0 && F <= FA1) Ventas30Act[Suc] = (Ventas30Act[Suc] ?? 0) + (D.Total ?? 0);
      if (F >= FB0 && F <= FB1) Ventas30Ant[Suc] = (Ventas30Ant[Suc] ?? 0) + (D.Total ?? 0);
    });

    // Objetivos Supabase
    const { data: ObjetivosData } = await Supa
      .from('objetivo_sucursal').select('sucursal, objetivo')
      .eq('anio', Anio).eq('mes', Mes);
    const ObjetivoMap = {};
    (ObjetivosData ?? []).forEach(O => { ObjetivoMap[O.sucursal] = O.objetivo; });

    const Sucursales = [...new Set([
      ...Object.keys(VentasPorSucursal),
      ...Object.keys(ObjetivoMap)
    ])].sort();

    if (!Sucursales.length) {
      Cuerpo.innerHTML = '<tr><td colspan="5" class="VacioMensaje">Sin datos para este periodo</td></tr>';
      return;
    }

    let TotalReal = 0, TotalObj = 0;

    // ── Tabla ─────────────────────────────────────────
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
            ${Dif !== null ? (Dif >= 0 ? '+' : '') + FormatearGs(Math.abs(Dif)) : '—'}
          </td>
          <td class="Derecha" style="min-width:90px">
            ${Pct !== null
              ? `<span class="${ClasePct(Pct)}">${Pct.toFixed(1)}%</span>
                 <div class="BarraProgreso"><div class="BarraRelleno ${ClaseBarraPct(Pct)}" style="width:${PctW}%"></div></div>`
              : '—'}
          </td>
        </tr>`;
    }).join('');

    // Fila total
    const PctTotal = TotalObj > 0 ? (TotalReal / TotalObj) * 100 : null;
    const DifTotal = TotalReal - TotalObj;
    Cuerpo.innerHTML += `
      <tr style="border-top:2px solid var(--borde);font-weight:700">
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

    // ── Torta Top 5 ───────────────────────────────────
    const Ordenadas = Sucursales
      .map(S => ({ Nombre: S, Valor: VentasPorSucursal[S] ?? 0 }))
      .filter(S => S.Valor > 0)
      .sort((A, B) => B.Valor - A.Valor);

    if (Ordenadas.length) {
      const Top4   = Ordenadas.slice(0, 4);
      const Resto  = Ordenadas.slice(4).reduce((A, S) => A + S.Valor, 0);
      const Labels = [...Top4.map(S => S.Nombre), ...(Resto > 0 ? ['Resto'] : [])];
      const Datos  = [...Top4.map(S => S.Valor),  ...(Resto > 0 ? [Resto]  : [])];
      const Colores = [...ColoresTorta.slice(0, Top4.length), ...(Resto > 0 ? [ColorResto] : [])];

      if (GraficoTorta) { GraficoTorta.destroy(); GraficoTorta = null; }

      GraficoTorta = new Chart(
        document.getElementById('GraficoTorta').getContext('2d'),
        {
          type: 'doughnut',
          data: {
            labels: Labels,
            datasets: [{ data: Datos, backgroundColor: Colores, borderColor: '#1a1d27', borderWidth: 2 }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            cutout: '60%',
            plugins: {
              legend: {
                position: 'bottom',
                labels: { color: '#e2e4ef', font: { size: 10 }, boxWidth: 10, padding: 8 }
              },
              tooltip: {
                callbacks: {
                  label: (C) => ` ${C.label}: ${FormatearGs(C.raw)}`
                }
              }
            }
          }
        }
      );
    }

    // ── Top 3 mayor caida (rolling 30 dias vs mismo periodo año anterior) ────
    const SucsCaida = [...new Set([...Object.keys(Ventas30Act), ...Object.keys(Ventas30Ant)])];
    const Caidas = SucsCaida
      .map(Suc => {
        const Act = Ventas30Act[Suc] ?? 0;
        const Ant = Ventas30Ant[Suc] ?? null;
        const Pct = Ant > 0 ? ((Act - Ant) / Ant) * 100 : null;
        return { Sucursal: Suc, Actual: Act, Anterior: Ant, Pct };
      })
      .filter(S => S.Pct !== null && S.Pct < 0)
      .sort((A, B) => A.Pct - B.Pct)
      .slice(0, 3);

    const Top3El = document.getElementById('ContenidoTop3');

    if (!Caidas.length) {
      Top3El.innerHTML = '<div class="VacioMensaje" style="padding:20px">Sin caidas vs año anterior</div>';
    } else {
      Top3El.innerHTML = Caidas.map((S, I) => `
        <div style="display:flex;align-items:center;gap:10px;padding:10px 0;border-bottom:1px solid var(--borde)">
          <div style="font-size:20px;font-weight:800;color:var(--peligro);width:28px;text-align:center">${I + 1}</div>
          <div style="flex:1">
            <div style="font-weight:600;font-size:13px">${S.Sucursal}</div>
            <div style="font-size:11px;color:var(--texto-suave);margin-top:2px">
              Ant: ${FormatearGs(S.Anterior)} → Act: ${FormatearGs(S.Actual)}
            </div>
          </div>
          <div class="PctMalo" style="font-size:16px;font-weight:800">${S.Pct.toFixed(1)}%</div>
        </div>
      `).join('');
    }

  } catch (E) {
    document.getElementById('CuerpoTablaObjSuc').innerHTML =
      `<tr><td colspan="5" class="VacioMensaje">${E.message}</td></tr>`;
  }
}

// Devuelve color por rango ordinal (no por valor absoluto).
// Evita que valores proximos reciban colores casi identicos.
// UnicosSorted = valores unicos positivos ordenados de menor a mayor.
function ColorEscalaHora(Val, UnicosSorted) {
  if (Val <= 0) return 'var(--texto-suave)';
  const Idx   = UnicosSorted.indexOf(Val);           // posicion 0-based
  const Total = UnicosSorted.length;
  const Ratio = Total <= 1 ? 1 : Idx / (Total - 1); // 0=rojo, 1=verde
  const Hue   = Math.round(Ratio * 120);
  return `hsl(${Hue}, 95%, 58%)`;
}

// ── Horas concurridas ─────────────────────────────────
async function CargarHoraSucursal() {
  const El = document.getElementById('ContenidoHoras');
  try {
    const Datos = await LlamarSP('HORASUCURSAL');

    if (!Datos.length) {
      El.innerHTML = '<div class="VacioMensaje">Sin datos de horario</div>';
      return;
    }

    // Agrupar: { [Sucursal]: { [RangoLabel]: count } }
    const Conteo = {};
    Datos.forEach(D => {
      const Suc  = D.Sucursal;
      // Extraer hora directo del string para evitar conversion UTC en el navegador
      // FechaHora llega como "2026-04-15 09:20:20.943" (sin T, hora local del servidor)
      const Hora = parseInt(String(D.FechaHora).substring(11, 13));
      const Rango = RangosHora.find(R => Hora >= R.Desde && Hora < R.Hasta);
      if (!Rango) return;
      if (!Conteo[Suc]) Conteo[Suc] = {};
      Conteo[Suc][Rango.Label] = (Conteo[Suc][Rango.Label] ?? 0) + 1;
    });

    const Sucursales = Object.keys(Conteo).sort();
    const Labels     = RangosHora.map(R => R.Label);
    const Dias       = 7;

    El.innerHTML = `
      <table>
        <thead>
          <tr>
            <th>Sucursal</th>
            ${Labels.map(L => `<th class="Derecha">${L}</th>`).join('')}
            <th class="Derecha">Pico</th>
          </tr>
        </thead>
        <tbody>
          ${Sucursales.map(Suc => {
            const Fila   = Conteo[Suc];
            const Proms      = Labels.map(L => (Fila[L] ?? 0) / Dias);
            const SoloPos    = Proms.filter(P => P > 0);
            const MaxProm    = SoloPos.length ? Math.max(...SoloPos) : 0;
            // Valores unicos ordenados: base para asignar rango ordinal de color
            const UnicosSorted = [...new Set(SoloPos)].sort((A, B) => A - B);
            const PicoL      = MaxProm > 0
              ? Labels[Proms.indexOf(MaxProm)]
              : '—';
            return `
              <tr>
                <td>${Suc}</td>
                ${Proms.map((Prom) => {
                  const Color = ColorEscalaHora(Prom, UnicosSorted);
                  const Bold  = Prom === MaxProm && MaxProm > 0 ? 'font-weight:700;' : '';
                  return `<td class="Derecha" style="color:${Color};${Bold}">
                    ${Prom > 0 ? Prom.toFixed(1) : '—'}
                  </td>`;
                }).join('')}
                <td class="Derecha" style="color:hsl(120,95%,58%);font-weight:700">${PicoL}</td>
              </tr>`;
          }).join('')}
        </tbody>
      </table>
    `;
  } catch {
    El.innerHTML = '<div class="VacioMensaje">Sin datos de horario</div>';
  }
}
