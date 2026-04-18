import { LlamarSP, FormatearGs, NombreMes, MostrarCargando, OpcionesGrafico } from './App.js';

let GraficoComp = null;
let DatosComp   = null;

export async function RenderComparativo(Forzar = false) {
  const Contenedor = document.getElementById('ContenidoComparativo');

  MostrarCargando('Comparativo', true);

  try {
    if (!DatosComp || Forzar) {
      DatosComp = await LlamarSP('VENTASXMES');
    }

    const Sucursales = [...new Set(DatosComp.map(D => D.Sucursal))].sort();

    Contenedor.innerHTML = `
      <div class="FilaFiltro">
        <select class="Selector" id="CompSucursal">
          <option value="">Todas las sucursales</option>
          ${Sucursales.map(S => `<option value="${S}">${S}</option>`).join('')}
        </select>
      </div>

      <div class="Tarjeta">
        <div class="TarjetaTitulo" id="TituloGraficoComp">Comparativo anual</div>
        <div class="GraficoContenedor">
          <canvas id="GraficoComp"></canvas>
        </div>
      </div>

      <div class="Tarjeta">
        <div class="TablaContenedor">
          <table>
            <thead>
              <tr>
                <th>Mes</th>
                <th class="Derecha" id="ThAnio1">Anterior</th>
                <th class="Derecha" id="ThAnio2">Actual</th>
                <th class="Derecha">Variacion</th>
                <th class="Derecha">%</th>
              </tr>
            </thead>
            <tbody id="CuerpoTablaComp"></tbody>
          </table>
        </div>
      </div>
    `;

    ActualizarComparativo();
    document.getElementById('CompSucursal').onchange = ActualizarComparativo;

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error al cargar: ${E.message}</div>`;
  } finally {
    MostrarCargando('Comparativo', false);
  }
}

// Devuelve los ultimos N meses desde hoy (inclusive) en orden cronologico
function UltimosDoceMeses() {
  const Hoy = new Date();
  const Resultado = [];
  for (let I = 11; I >= 0; I--) {
    const D = new Date(Hoy.getFullYear(), Hoy.getMonth() - I, 1);
    Resultado.push({ Anio: D.getFullYear(), Mes: D.getMonth() + 1 });
  }
  return Resultado;
}

function ActualizarComparativo() {
  const Sucursal = document.getElementById('CompSucursal').value;
  const Periodos = UltimosDoceMeses();

  // Suma de ventas para un {Anio, Mes} dado (con filtro de sucursal opcional)
  const Buscar = (Anio, Mes) => {
    const Total = DatosComp
      .filter(D => D.Anio === Anio && D.Mes === Mes && (!Sucursal || D.Sucursal === Sucursal))
      .reduce((A, D) => A + (D.Total ?? 0), 0);
    return Total > 0 ? Total : null;
  };

  const Labels      = Periodos.map(P => NombreMes(P.Mes).substring(0, 3) + ' ' + String(P.Anio).substring(2));
  const ValActual   = Periodos.map(P => Buscar(P.Anio,     P.Mes));
  const ValAnterior = Periodos.map(P => Buscar(P.Anio - 1, P.Mes));

  // Titulo con rango de periodos
  const Primero  = Periodos[0];
  const Ultimo   = Periodos[11];
  const RangoAct = `${NombreMes(Primero.Mes).substring(0,3)} ${Primero.Anio} — ${NombreMes(Ultimo.Mes).substring(0,3)} ${Ultimo.Anio}`;
  const RangoAnt = `${NombreMes(Primero.Mes).substring(0,3)} ${Primero.Anio - 1} — ${NombreMes(Ultimo.Mes).substring(0,3)} ${Ultimo.Anio - 1}`;

  document.getElementById('TituloGraficoComp').textContent =
    `Ultimos 12 meses${Sucursal ? ' — ' + Sucursal : ''}`;
  document.getElementById('ThAnio1').textContent = `Ant (${Primero.Anio - 1}/${Ultimo.Anio - 1 !== Primero.Anio - 1 ? Ultimo.Anio - 1 : ''})`.replace(/\/$/, '');
  document.getElementById('ThAnio2').textContent = `Act (${Primero.Anio}/${Ultimo.Anio !== Primero.Anio ? Ultimo.Anio : ''})`.replace(/\/$/, '');

  // Grafico
  if (GraficoComp) { GraficoComp.destroy(); GraficoComp = null; }

  GraficoComp = new Chart(
    document.getElementById('GraficoComp').getContext('2d'),
    {
      type: 'bar',
      data: {
        labels: Labels,
        datasets: [
          {
            label: RangoAnt,
            data: ValAnterior,
            backgroundColor: 'rgba(139,144,167,0.5)',
            borderRadius: 3
          },
          {
            label: RangoAct,
            data: ValActual,
            backgroundColor: 'rgba(79,142,247,0.75)',
            borderRadius: 3
          }
        ]
      },
      options: {
        ...OpcionesGrafico,
        plugins: {
          ...OpcionesGrafico.plugins,
          tooltip: {
            callbacks: {
              label: (Ctx) => `${Ctx.dataset.label.split(' — ')[0] || Ctx.dataset.label}: ${FormatearGs(Ctx.raw)}`
            }
          }
        }
      }
    }
  );

  // Tabla
  const Cuerpo = document.getElementById('CuerpoTablaComp');
  let TotalAnt = 0, TotalAct = 0;

  Cuerpo.innerHTML = Periodos.map((P, I) => {
    const V1  = ValAnterior[I];
    const V2  = ValActual[I];
    const Var = V1 !== null && V2 !== null ? V2 - V1 : null;
    const Pct = V1 > 0 && Var !== null ? (Var / V1) * 100 : null;
    const ClaseVar = Var !== null ? (Var >= 0 ? 'PctBueno' : 'PctMalo') : '';

    if (V1) TotalAnt += V1;
    if (V2) TotalAct += V2;

    return `
      <tr>
        <td>${NombreMes(P.Mes).substring(0, 3)} ${P.Anio}</td>
        <td class="Derecha">${V1 !== null ? FormatearGs(V1) : '—'}</td>
        <td class="Derecha">${V2 !== null ? FormatearGs(V2) : '—'}</td>
        <td class="Derecha ${ClaseVar}">${Var !== null ? (Var >= 0 ? '+' : '') + FormatearGs(Math.abs(Var)) : '—'}</td>
        <td class="Derecha ${ClaseVar}">${Pct !== null ? (Pct >= 0 ? '+' : '') + Pct.toFixed(1) + '%' : '—'}</td>
      </tr>`;
  }).join('');

  // Fila total
  const VarTotal = TotalAct - TotalAnt;
  const PctTotal = TotalAnt > 0 ? (VarTotal / TotalAnt) * 100 : null;
  const ClaseTotal = VarTotal >= 0 ? 'PctBueno' : 'PctMalo';
  Cuerpo.innerHTML += `
    <tr style="border-top: 2px solid var(--borde); font-weight:700">
      <td>TOTAL</td>
      <td class="Derecha">${FormatearGs(TotalAnt)}</td>
      <td class="Derecha">${FormatearGs(TotalAct)}</td>
      <td class="Derecha ${ClaseTotal}">${(VarTotal >= 0 ? '+' : '') + FormatearGs(Math.abs(VarTotal))}</td>
      <td class="Derecha ${ClaseTotal}">${PctTotal !== null ? (PctTotal >= 0 ? '+' : '') + PctTotal.toFixed(1) + '%' : '—'}</td>
    </tr>`;
}
