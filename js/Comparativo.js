import { LlamarSP, FormatearMillon, NombreMes, MostrarCargando, OpcionesGrafico } from './App.js';

let GraficoComp = null;
let DatosComp   = null;

export async function RenderComparativo(Forzar = false) {
  const Contenedor = document.getElementById('ContenidoComparativo');

  MostrarCargando('Comparativo', true);

  try {
    if (!DatosComp || Forzar) {
      DatosComp = await LlamarSP('VENTASXMES');
    }

    const Hoy       = new Date();
    const AnioActual = Hoy.getFullYear();
    const Sucursales = [...new Set(DatosComp.map(D => D.Sucursal))].sort();
    const Anios      = [...new Set(DatosComp.map(D => D.Anio))].sort();

    Contenedor.innerHTML = `
      <div class="FilaFiltro">
        <select class="Selector" id="CompAnio1">
          ${Anios.map(A => `<option value="${A}" ${A === AnioActual - 1 ? 'selected' : ''}>${A}</option>`).join('')}
        </select>
        <select class="Selector" id="CompAnio2">
          ${Anios.map(A => `<option value="${A}" ${A === AnioActual ? 'selected' : ''}>${A}</option>`).join('')}
        </select>
        <select class="Selector" id="CompSucursal">
          <option value="">Todas</option>
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
                <th class="Derecha" id="ThAnio1">—</th>
                <th class="Derecha" id="ThAnio2">—</th>
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

    document.getElementById('CompAnio1').onchange    = ActualizarComparativo;
    document.getElementById('CompAnio2').onchange    = ActualizarComparativo;
    document.getElementById('CompSucursal').onchange = ActualizarComparativo;

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error al cargar: ${E.message}</div>`;
  } finally {
    MostrarCargando('Comparativo', false);
  }
}

function ActualizarComparativo() {
  const Anio1    = parseInt(document.getElementById('CompAnio1').value);
  const Anio2    = parseInt(document.getElementById('CompAnio2').value);
  const Sucursal = document.getElementById('CompSucursal').value;

  const Filtrar = (Anio) =>
    DatosComp
      .filter(D => D.Anio === Anio && (!Sucursal || D.Sucursal === Sucursal))
      .reduce((Acc, D) => {
        Acc[D.Mes] = (Acc[D.Mes] ?? 0) + D.Total;
        return Acc;
      }, {});

  const Totales1 = Filtrar(Anio1);
  const Totales2 = Filtrar(Anio2);
  const Meses    = Array.from({ length: 12 }, (_, I) => I + 1);
  const Labels   = Meses.map(M => NombreMes(M).substring(0, 3));

  document.getElementById('TituloGraficoComp').textContent =
    `Comparativo ${Anio1} vs ${Anio2}${Sucursal ? ' — ' + Sucursal : ''}`;
  document.getElementById('ThAnio1').textContent = Anio1;
  document.getElementById('ThAnio2').textContent = Anio2;

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
            label: String(Anio1),
            data: Meses.map(M => Totales1[M] ?? 0),
            backgroundColor: 'rgba(139,144,167,0.6)',
            borderRadius: 3
          },
          {
            label: String(Anio2),
            data: Meses.map(M => Totales2[M] ?? 0),
            backgroundColor: 'rgba(79,142,247,0.75)',
            borderRadius: 3
          }
        ]
      },
      options: OpcionesGrafico
    }
  );

  // Tabla
  const Cuerpo = document.getElementById('CuerpoTablaComp');
  Cuerpo.innerHTML = Meses.map(M => {
    const V1  = Totales1[M] ?? null;
    const V2  = Totales2[M] ?? null;
    const Var = V1 !== null && V2 !== null ? V2 - V1 : null;
    const Pct = V1 > 0 && Var !== null ? (Var / V1) * 100 : null;
    const ClaseVar = Var !== null ? (Var >= 0 ? 'PctBueno' : 'PctMalo') : '';
    return `
      <tr>
        <td>${NombreMes(M)}</td>
        <td class="Derecha">${V1 !== null ? FormatearMillon(V1) : '—'}</td>
        <td class="Derecha">${V2 !== null ? FormatearMillon(V2) : '—'}</td>
        <td class="Derecha ${ClaseVar}">${Var !== null ? (Var >= 0 ? '+' : '') + FormatearMillon(Var) : '—'}</td>
        <td class="Derecha ${ClaseVar}">${Pct !== null ? (Pct >= 0 ? '+' : '') + Pct.toFixed(1) + '%' : '—'}</td>
      </tr>`;
  }).join('');
}
