import { useState, type FormEvent } from "react";

import { categoriasApi, ingresosApi } from "../../api/recursos";
import { useDatos } from "../../hooks/useDatos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Cuenta, FechaISO } from "../../types";
import { aISO } from "../../utils/formato";
import { ULTIMO_DIA, textoDia } from "../../utils/periodicidad";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";
import { Cargando } from "../ui/Estados";

/** Próxima fecha con ese día del mes (31 = el último día, sea cual sea el mes). */
function proximoCobro(dia: number): FechaISO {
  const hoy = new Date();
  const enMes = (anio: number, mes: number) => new Date(anio, mes, Math.min(dia, new Date(anio, mes + 1, 0).getDate()));
  const esteMes = enMes(hoy.getFullYear(), hoy.getMonth());
  return aISO(esteMes.getDate() >= hoy.getDate() ? esteMes : enMes(hoy.getFullYear(), hoy.getMonth() + 1));
}

interface PasoSueldoProps {
  cuentas: Cuenta[];
  /** La cuenta recién creada en el paso anterior puede estar llegando todavía. */
  cargandoCuentas: boolean;
  onSiguiente: () => void;
  onAtras: () => void;
}

/**
 * Sueldo opcional como ingreso fijo mensual: con él, el panel y los avisos tienen
 * sentido desde el primer día. Solo pide lo imprescindible; el resto (quincenas,
 * otra periodicidad…) se ajusta después en Pagos fijos.
 */
export function PasoSueldo({ cuentas, cargandoCuentas, onSiguiente, onAtras }: PasoSueldoProps) {
  const ingresos = useDatos(() => ingresosApi.listar(), []);
  const categorias = useDatos(() => categoriasApi.listar({ tipo: "ingreso" }), []);
  const [monto, setMonto] = useState("");
  const [dia, setDia] = useState(String(ULTIMO_DIA));
  // "" = la primera cuenta: así vale aunque la lista llegue después de montar el paso.
  const [cuentaElegida, setCuentaId] = useState("");
  const cuentaId = cuentaElegida || String(cuentas[0]?.id ?? "");
  const { enviando, error, ejecutar } = useEnvio();

  async function guardar(evento: FormEvent) {
    evento.preventDefault();
    const cuenta = cuentas.find((c) => c.id === Number(cuentaId));
    // La categoría "Sueldo" viene de serie; si la borraron, la primera de ingreso.
    const categoria = categorias.datos?.find((c) => /sueldo|n[oó]mina|salario/i.test(c.nombre)) ?? categorias.datos?.[0];
    if (!cuenta || !categoria) return onSiguiente();
    const ok = await ejecutar(() =>
      ingresosApi.crear({
        nombre: "Sueldo",
        monto,
        moneda: cuenta.moneda,
        periodicidad: "mensual",
        fecha_proximo_cobro: proximoCobro(Number(dia)),
        cuenta_id: cuenta.id,
        categoria_id: categoria.id,
        intervalo: null,
        dia_quincena_1: null,
        dia_quincena_2: null,
        dia_del_mes: Number(dia),
        adelantar_a_habil: false,
      }),
    );
    if (ok) onSiguiente();
  }

  if (cargandoCuentas || ingresos.cargando) return <Cargando />;
  const yaTiene = (ingresos.datos?.length ?? 0) > 0;
  if (cuentas.length === 0 || yaTiene) {
    return (
      <div className="space-y-4">
        <h3 className="text-lg font-bold">Tu sueldo</h3>
        <p className="text-sm text-suave">
          {yaTiene
            ? "Ya tienes ingresos fijos apuntados. Los ves y cambias en Pagos fijos → Ingresos fijos."
            : "Cuando tengas una cuenta, apúntalo en Pagos fijos → Ingresos fijos: te avisaremos el día de cobro."}
        </p>
        <div className="flex justify-between gap-2 pt-2">
          <Boton variante="fantasma" onClick={onAtras}>Atrás</Boton>
          <Boton onClick={onSiguiente}>Siguiente</Boton>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={guardar} className="space-y-4">
      <h3 className="text-lg font-bold">¿Cobras un sueldo fijo?</h3>
      <p className="text-sm text-suave">
        Opcional. Te avisamos el día de cobro y lo anotas con un toque. Las quincenas u otros ingresos se ajustan en Pagos fijos.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <Campo etiqueta="Cuánto, más o menos">
          <input className={CLASE_ENTRADA} type="number" inputMode="decimal" step="0.01" min="0.01" value={monto} onChange={(e) => setMonto(e.target.value)} required autoFocus />
        </Campo>
        <Campo etiqueta="Qué día del mes">
          <select className={CLASE_ENTRADA} value={dia} onChange={(e) => setDia(e.target.value)}>
            {Array.from({ length: ULTIMO_DIA }, (_, i) => i + 1).map((numero) => (
              <option key={numero} value={numero}>{numero === ULTIMO_DIA ? "Último día" : `Día ${textoDia(numero)}`}</option>
            ))}
          </select>
        </Campo>
      </div>
      {cuentas.length > 1 && (
        <Campo etiqueta="Cuenta donde llega">
          <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => setCuentaId(e.target.value)}>
            {cuentas.map((cuenta) => (
              <option key={cuenta.id} value={cuenta.id}>{cuenta.nombre}</option>
            ))}
          </select>
        </Campo>
      )}
      <ErrorFormulario mensaje={error} />
      <div className="flex justify-between gap-2 pt-2">
        <Boton variante="fantasma" onClick={onSiguiente}>Ahora no</Boton>
        <Boton type="submit" disabled={enviando}>{enviando ? "Guardando…" : "Guardar y seguir"}</Boton>
      </div>
    </form>
  );
}
