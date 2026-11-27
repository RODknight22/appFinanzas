import { PERIODICIDADES } from "../../config";
import type { CalendarioFijo, Periodicidad } from "../../types";
import { MAX_DIAS_DE_COBRO, ULTIMO_DIA, UNIDADES, esPorDiasDelMes, textoDia } from "../../utils/periodicidad";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";

/**
 * Calendario de un fijo (ingreso o pago) tal como se edita en el formulario.
 * Los formularios de ingresos y de pagos fijos comparten este estado y estos campos.
 */
export interface EstadoCalendario {
  periodicidad: Periodicidad;
  intervalo: string;
  diaQuincena1: number;
  diaQuincena2: number;
  /** "" = el día de la fecha del próximo cobro (comportamiento clásico). */
  diaDelMes: string;
  /** Días de "varias veces al mes", ordenados. */
  diasDeCobro: number[];
  adelantar: boolean;
}

export function calendarioInicial(inicial?: CalendarioFijo): EstadoCalendario {
  return {
    periodicidad: inicial?.periodicidad ?? "mensual",
    intervalo: String(inicial?.intervalo ?? 1),
    diaQuincena1: inicial?.dia_quincena_1 ?? 15,
    diaQuincena2: inicial?.dia_quincena_2 ?? ULTIMO_DIA,
    diaDelMes: inicial?.dia_del_mes ? String(inicial.dia_del_mes) : "",
    diasDeCobro: inicial?.dias_de_cobro ?? [],
    adelantar: inicial?.adelantar_a_habil ?? false,
  };
}

/** Lo que se envía a la API: solo lo que aplica a la periodicidad elegida; el resto, null. */
export function datosCalendario(c: EstadoCalendario): CalendarioFijo {
  const quincenal = c.periodicidad === "quincenal";
  const varias = c.periodicidad === "varias_al_mes";
  const mensual = c.periodicidad === "mensual";
  return {
    periodicidad: c.periodicidad,
    intervalo: esPorDiasDelMes(c.periodicidad) || Number(c.intervalo) <= 1 ? null : Number(c.intervalo),
    dia_quincena_1: quincenal ? c.diaQuincena1 : null,
    dia_quincena_2: quincenal ? c.diaQuincena2 : null,
    dia_del_mes: mensual && c.diaDelMes ? Number(c.diaDelMes) : null,
    dias_de_cobro: varias ? c.diasDeCobro : null,
    adelantar_a_habil: quincenal || varias || mensual ? c.adelantar : null,
  };
}

/** Un aviso si el calendario no se puede guardar todavía; null si está bien. */
export function errorCalendario(c: EstadoCalendario, cobro: string): string | null {
  if (c.periodicidad === "quincenal" && c.diaQuincena1 >= c.diaQuincena2) return `El primer ${cobro} debe ser antes que el segundo.`;
  if (c.periodicidad === "varias_al_mes" && c.diasDeCobro.length === 0) return "Elige al menos un día del mes.";
  return null;
}

/** Días 1-30 y "Último día" (31), que el backend recorta según el mes. */
function OpcionesDia() {
  return (
    <>
      {Array.from({ length: ULTIMO_DIA }, (_, i) => i + 1).map((dia) => (
        <option key={dia} value={dia}>{dia === ULTIMO_DIA ? "Último día" : `Día ${textoDia(dia)}`}</option>
      ))}
    </>
  );
}

export function SelectPeriodicidad({ valor, onCambiar }: { valor: Periodicidad; onCambiar: (p: Periodicidad) => void }) {
  return (
    <Campo etiqueta="Periodicidad">
      <select className={CLASE_ENTRADA} value={valor} onChange={(e) => onCambiar(e.target.value as Periodicidad)}>
        {Object.entries(PERIODICIDADES).map(([valor, etiqueta]) => (
          <option key={valor} value={valor}>{etiqueta}</option>
        ))}
      </select>
    </Campo>
  );
}

/**
 * Botones 1-30 y "Último día" que se activan al pulsarlos (como un calendario de bolsillo).
 * Siete columnas: caben sin scroll horizontal a 390 px.
 */
function SelectorDias({ dias, onCambiar }: { dias: number[]; onCambiar: (dias: number[]) => void }) {
  const lleno = dias.length >= MAX_DIAS_DE_COBRO;
  function alternar(dia: number) {
    onCambiar(dias.includes(dia) ? dias.filter((d) => d !== dia) : [...dias, dia].sort((a, b) => a - b));
  }
  return (
    <div className="space-y-1.5">
      <p id="dias-de-cobro" className="text-sm font-medium text-suave">Días del mes</p>
      <div role="group" aria-labelledby="dias-de-cobro" className="grid grid-cols-7 gap-1">
        {Array.from({ length: ULTIMO_DIA }, (_, i) => i + 1).map((dia) => {
          const activo = dias.includes(dia);
          const ultimo = dia === ULTIMO_DIA;
          return (
            <button
              key={dia}
              type="button"
              onClick={() => alternar(dia)}
              aria-pressed={activo}
              aria-label={ultimo ? "Último día del mes" : `Día ${dia}`}
              // Con el máximo elegido, solo se pueden quitar días.
              disabled={lleno && !activo}
              className={`h-9 rounded-lg text-xs font-semibold tabular-nums transition disabled:opacity-40 ${ultimo ? "col-span-3" : ""} ${
                activo ? "bg-acento-600 text-sobre-acento" : "bg-superficie text-suave hover:bg-realce"
              }`}
            >
              {ultimo ? "Último día" : dia}
            </button>
          );
        })}
      </div>
      <p className="text-xs text-tenue">
        Hasta {MAX_DIAS_DE_COBRO} días. En meses cortos, el 29, 30 o 31 pasan al último día.
      </p>
    </div>
  );
}

interface CamposCalendarioProps {
  valor: EstadoCalendario;
  onCambiar: (cambios: Partial<EstadoCalendario>) => void;
  /** "cobro" o "pago": para las etiquetas ("Primer cobro", "Día del pago"). */
  cobro: string;
}

/** Los ajustes del calendario según la periodicidad (la periodicidad se elige con SelectPeriodicidad). */
export function CamposCalendario({ valor, onCambiar, cobro }: CamposCalendarioProps) {
  const { periodicidad } = valor;
  const quincenal = periodicidad === "quincenal";
  const varias = periodicidad === "varias_al_mes";
  const mensual = periodicidad === "mensual";
  const error = errorCalendario(valor, cobro);

  return (
    <fieldset className="space-y-3 rounded-xl bg-superficie-2/60 p-3">
      <legend className="sr-only">Calendario del {cobro}</legend>
      {quincenal && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta={`Primer ${cobro}`}>
            <select className={CLASE_ENTRADA} value={valor.diaQuincena1} onChange={(e) => onCambiar({ diaQuincena1: Number(e.target.value) })}>
              <OpcionesDia />
            </select>
          </Campo>
          <Campo etiqueta={`Segundo ${cobro}`}>
            <select className={CLASE_ENTRADA} value={valor.diaQuincena2} onChange={(e) => onCambiar({ diaQuincena2: Number(e.target.value) })}>
              <OpcionesDia />
            </select>
          </Campo>
        </div>
      )}
      {varias && <SelectorDias dias={valor.diasDeCobro} onCambiar={(diasDeCobro) => onCambiar({ diasDeCobro })} />}
      {!esPorDiasDelMes(periodicidad) && (
        <div className="grid grid-cols-2 gap-3">
          <Campo etiqueta="Repetir cada">
            <div className="flex items-center gap-2">
              <input className={CLASE_ENTRADA} type="number" inputMode="numeric" min="1" max="365" step="1" value={valor.intervalo} onChange={(e) => onCambiar({ intervalo: e.target.value })} required />
              <span className="shrink-0 text-sm text-tenue">{UNIDADES[periodicidad][Number(valor.intervalo) === 1 ? 0 : 1]}</span>
            </div>
          </Campo>
          {mensual && (
            <Campo etiqueta={`Día del ${cobro}`}>
              <select className={CLASE_ENTRADA} value={valor.diaDelMes} onChange={(e) => onCambiar({ diaDelMes: e.target.value })}>
                <option value="">El de la fecha</option>
                <OpcionesDia />
              </select>
            </Campo>
          )}
        </div>
      )}
      {error && <p className="text-xs text-peligro" role="alert">{error}</p>}
      {(quincenal || varias || mensual) && (
        <label className="flex items-center gap-2 text-sm text-suave">
          <input type="checkbox" checked={valor.adelantar} onChange={(e) => onCambiar({ adelantar: e.target.checked })} className="accent-acento-600" />
          Si cae en fin de semana, adelantar al viernes
        </label>
      )}
    </fieldset>
  );
}
