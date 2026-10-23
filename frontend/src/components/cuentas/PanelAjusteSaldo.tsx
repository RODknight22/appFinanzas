import { Undo2 } from "lucide-react";
import { useState, type FormEvent } from "react";

import { cuentasApi } from "../../api/recursos";
import { useDatos } from "../../hooks/useDatos";
import { confirmarYEliminar, useEnvio } from "../../hooks/useEnvio";
import type { AjusteSaldo, Cuenta } from "../../types";
import { formatearDinero, formatearFecha } from "../../utils/formato";
import { CLASE_ENTRADA, Campo } from "../ui/Campo";
import { Contenido } from "../ui/Estados";
import { PieFormulario } from "../formularios/PieFormulario";

interface PanelAjusteSaldoProps {
  cuenta: Cuenta;
  /** Saldo que lleva la app, en la moneda de la cuenta (negativo en una tarjeta con deuda). */
  saldo: number;
  onAjustado: (ajuste: AjusteSaldo) => void;
  /** Tras deshacer un ajuste: el saldo cambia y hay que refrescarlo. */
  onCambio: () => void;
  onCancelar: () => void;
}

/** Deja el saldo como dice el banco anotando la diferencia, más el historial para deshacer. */
export function PanelAjusteSaldo({ cuenta, saldo, onAjustado, onCambio, onCancelar }: PanelAjusteSaldoProps) {
  // En una tarjeta se piensa en la deuda (positiva), no en un saldo negativo.
  const esCredito = cuenta.tipo === "credito";
  const fuente = cuenta.tipo === "efectivo" ? "hay en la cartera" : "dice tu banco";
  const [valor, setValor] = useState(() => (esCredito ? Math.max(-saldo, 0) : saldo).toFixed(2));
  const [notas, setNotas] = useState("");
  const { enviando, error, ejecutar } = useEnvio();
  const historial = useDatos(() => cuentasApi.listarAjustes(cuenta.id), [cuenta.id]);

  const saldoReal = esCredito ? -Number(valor) : Number(valor);
  const diferencia = valor === "" ? 0 : Math.round((saldoReal - saldo) * 100) / 100;

  async function enviar(evento: FormEvent) {
    evento.preventDefault();
    let ajuste: AjusteSaldo | undefined;
    const ok = await ejecutar(async () => {
      ajuste = await cuentasApi.ajustarSaldo(cuenta.id, { saldo_real: saldoReal.toFixed(2), notas: notas.trim() || null });
    });
    if (ok && ajuste) onAjustado(ajuste);
  }

  function deshacer(ajuste: AjusteSaldo) {
    confirmarYEliminar(
      `¿Deshacer el ajuste de ${formatearDinero(ajuste.diferencia, cuenta.moneda)} del ${formatearFecha(ajuste.fecha)}?`,
      () => cuentasApi.deshacerAjuste(cuenta.id, ajuste.id),
      () => {
        historial.recargar();
        onCambio();
      },
    );
  }

  return (
    <div className="space-y-5">
      <form onSubmit={enviar} className="space-y-4">
        <p className="rounded-lg bg-superficie-2 p-3 text-sm">
          La app lleva <strong className="tabular-nums">{formatearDinero(esCredito ? Math.max(-saldo, 0) : saldo, cuenta.moneda)}</strong>
          {esCredito ? " de deuda" : ""}. Escribe lo que {fuente} y se anota la diferencia como ajuste: no cuenta como
          ingreso ni gasto.
        </p>
        <Campo etiqueta={`${esCredito ? "Deuda" : "Saldo"}: lo que ${fuente} (${cuenta.moneda})`}>
          <input
            className={CLASE_ENTRADA}
            type="number"
            inputMode="decimal"
            step="0.01"
            min={esCredito ? "0" : undefined}
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            required
            autoFocus
          />
        </Campo>
        <p className="text-sm text-tenue" aria-live="polite">
          {diferencia === 0 ? (
            "Ya cuadra: no hace falta ajustar."
          ) : (
            <>
              Ajuste:{" "}
              <strong className="tabular-nums text-texto">
                {diferencia > 0 ? "+" : "−"}{formatearDinero(Math.abs(diferencia), cuenta.moneda)}
              </strong>{" "}
              al saldo
            </>
          )}
        </p>
        <Campo etiqueta="Notas (opcional)">
          <input className={CLASE_ENTRADA} value={notas} onChange={(e) => setNotas(e.target.value)} maxLength={500} placeholder="Ej.: gastos sin anotar de octubre" />
        </Campo>
        <PieFormulario error={error} enviando={enviando} onCancelar={onCancelar} textoGuardar="Ajustar" />
      </form>

      <div>
        <h3 className="mb-2 text-sm font-medium text-suave">Ajustes anteriores</h3>
        <Contenido {...historial} onReintentar={historial.recargar}>
          {(ajustes) =>
            ajustes.length === 0 ? (
              <p className="text-sm text-tenue">Aún no has ajustado esta cuenta.</p>
            ) : (
              <ul className="max-h-48 divide-y divide-linea overflow-y-auto text-sm">
                {ajustes.map((a) => (
                  <li key={a.id} className="flex items-center gap-3 py-2">
                    <span className="min-w-0 flex-1 truncate text-tenue">
                      {formatearFecha(a.fecha)}{a.notas && ` · ${a.notas}`}
                    </span>
                    <span className="font-medium tabular-nums">
                      {Number(a.diferencia) > 0 ? "+" : "−"}{formatearDinero(Math.abs(Number(a.diferencia)), cuenta.moneda)}
                    </span>
                    <button
                      type="button"
                      aria-label="Deshacer ajuste"
                      title="Deshacer ajuste"
                      className="rounded-lg p-1 text-tenue-2 hover:bg-realce hover:text-texto"
                      onClick={() => deshacer(a)}
                    >
                      <Undo2 size={14} />
                    </button>
                  </li>
                ))}
              </ul>
            )
          }
        </Contenido>
      </div>
    </div>
  );
}
