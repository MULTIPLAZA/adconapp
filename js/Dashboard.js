import { LlamarSP, Supa, FormatearMillon, ClasePct, ClaseBarraPct, ClaseKpiFondo, NombreMes, MostrarCargando, OpcionesGrafico } from './App.js';

let GraficoDia = null;

export async function RenderDashboard(Forzar = false) {
  const Contenedor = document.getElementById('ContenidoDashboard');
  if (Contenedor.innerHTML && !Forzar) return;

  MostrarCargando('Dashboard', true);
  Contenedor.innerHTML = '';

  try {
    const Hoy  = new Date();
    const Anio = Hoy.getFullYear();
    const Mes  = Hoy.getMonth() + 1;

    const [DatosSucursal, DatosDia, RespObjetivos] = await Promise.all([
      LlamarSP('VENTASXSUCURSAL'),
      LlamarSP('VENTASXDIA'),
      Supa.from('objetivo_sucursal').select('sucursal, objetivo').eq('anio', Anio).eq('mes', Mes)
    ]);

    const Objetivos    = RespObjetivos.data ?? [];
    const TotalHoy     = DatosSucursal.reduce((A, S) => A + (S.VentaHoy ?? 0), 0);
    const TotalMes     = DatosSucursal.reduce((A, S) => A + (S.VentaMes  ?? 0), 0);
    const TotalObj     = Objetivos.reduce((A, O) => A + (O.objetivo ?? 0), 0);
    const PctTotal     = TotalObj > 0 ? (TotalMes / TotalObj) * 100 : null;

    Contenedor.innerHTML = `
      <div class="FilaKpi">
        <div class="TarjetaKpi">
          <div class="KpiLabel">Venta Hoy</div>
          <div class="KpiValor">${FormatearMillon(TotalHoy)}</div>
        </div>
        <div class="TarjetaKpi">
          <div class="KpiLabel">Venta ${NombreMes(Mes)}</div>
          <div class="KpiValor">${FormatearMillon(TotalMes)}</div>
        </div>
        <div class="TarjetaKpi ${PctTotal !== null ? ClaseKpiFondo(PctTotal) : ''}">
          <div class="KpiLabel">Objetivo ${NombreMes(Mes)}</div>
          <div class="KpiValor">${TotalObj > 0 ? FormatearMillon(TotalObj) : '—'}</div>
          ${PctTotal !== null ? `<div class="KpiPct ${ClasePct(PctTotal)}">${PctTotal.toFixed(1)}%</div>` : ''}
        </div>
      </div>

      <div class="Tarjeta">
        <div class="TarjetaTitulo">Sucursales — ${NombreMes(Mes)} ${Anio}</div>
        <div class="TablaContenedor">
          <table>
            <thead>
              <tr>
                <th>Sucursal</th>
                <th class="Derecha">Hoy</th>
                <th class="Derecha">Mes</th>
                <th class="Derecha">Objetivo</th>
                <th class="Derecha">%</th>
              </tr>
            </thead>
            <tbody>
              ${DatosSucursal.map(S => {
                const Obj = Objetivos.find(O => O.sucursal === S.Sucursal);
                const ObjV = Obj?.objetivo ?? null;
                const Pct  = ObjV > 0 ? (S.VentaMes / ObjV) * 100 : null;
                const PctW = Pct !== null ? Math.min(Pct, 100).toFixed(1) : 0;
                return `
                  <tr>
                    <td>${S.Sucursal}</td>
                    <td class="Derecha">${FormatearMillon(S.VentaHoy)}</td>
                    <td class="Derecha">${FormatearMillon(S.VentaMes)}</td>
                    <td class="Derecha">${ObjV ? FormatearMillon(ObjV) : '—'}</td>
                    <td class="Derecha" style="min-width:80px">
                      ${Pct !== null
                        ? `<span class="${ClasePct(Pct)}">${Pct.toFixed(1)}%</span>
                           <div class="BarraProgreso">
                             <div class="BarraRelleno ${ClaseBarraPct(Pct)}" style="width:${PctW}%"></div>
                           </div>`
                        : '—'}
                    </td>
                  </tr>`;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <div class="Tarjeta">
        <div class="TarjetaTitulo">Ultimos 7 dias</div>
        <div class="GraficoContenedor">
          <canvas id="GraficoDia"></canvas>
        </div>
      </div>
    `;

    if (GraficoDia) { GraficoDia.destroy(); GraficoDia = null; }

    GraficoDia = new Chart(
      document.getElementById('GraficoDia').getContext('2d'),
      {
        type: 'bar',
        data: {
          labels: DatosDia.map(D => D.Dia),
          datasets: [
            {
              label: 'Venta',
              data: DatosDia.map(D => D.TotalVenta),
              backgroundColor: 'rgba(79,142,247,0.75)',
              borderRadius: 4
            },
            {
              label: 'Utilidad',
              data: DatosDia.map(D => D.Utilidad),
              backgroundColor: 'rgba(61,184,122,0.75)',
              borderRadius: 4
            }
          ]
        },
        options: OpcionesGrafico
      }
    );

  } catch (E) {
    Contenedor.innerHTML = `<div class="Alerta AlertaError">Error al cargar: ${E.message}</div>`;
  } finally {
    MostrarCargando('Dashboard', false);
  }
}
