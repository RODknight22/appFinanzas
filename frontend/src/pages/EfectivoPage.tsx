import { ArrowDownToLine, ArrowRight, ArrowUpFromLine, Banknote, Plus, Scale, Zap } from "lucide-react";
import { useState } from "react";
import { Link } from "react-router";

import { dashboardApi } from "../api/dashboard";
import { categoriasApi, cuentasApi, transaccionesApi, transferenciasApi } from "../api/recursos";
import { PanelAjusteSaldo } from "../components/cuentas/PanelAjusteSaldo";
import { FormularioCuenta } from "../components/formularios/FormularioCuenta";
import { FormularioGastoRapido } from "../components/formularios/FormularioGastoRapido";
import { FormularioTransaccion } from "../components/formularios/FormularioTransaccion";
import { FormularioTransferencia, type SentidoTransferencia } from "../components/formularios/FormularioTransferencia";
import { FilaTransaccion } from "../components/transacciones/FilaTransaccion";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { avisar } from "../components/ui/tablonAvisos";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { AjusteSaldo, Cuenta, Transaccion, Transferencia } from "../types";
import { ordenarPorUso } from "../utils/categorias";
import { formatearDinero, formatearFecha, mesActual, rangoDelMes } from "../utils/formato";

/** Movimientos que se muestran en la página (el resto, en Transacciones). */
const LIMITE_MOVIMIENTOS = 15;

type EstadoModal =
  | null
  | { modo: "gasto" }
  | { modo: "cartera" }
  | { modo: "transferir"; titulo: string; sentido: SentidoTransferencia }
  | { modo: "editar"; transaccion: Transaccion }
  | { modo: "ajustar"; cartera: Cuenta };

/** Un movimiento de efectivo: una transacción (gasto/ingreso) o un retiro/depósito. */
type Movimiento =
  | { clase: "transaccion"; fecha: string; transaccion: Transaccion }
  | { clase: "transferencia"; fecha: string; transferencia: Transferencia };

/** Carga las cuentas y, de las de efectivo, sus movimientos y lo gastado este mes. */
async function cargar() {
  const [cuentas, resumen, categorias] = await Promise.all([
    cuentasApi.listar(),
    dashboardApi.resumen(mesActual()),
    categoriasApi.listar(),
  ]);
  const carteras = cuentas.filter((c) => c.tipo === "efectivo");
  const mes = rangoDelMes(mesActual());
  // El backend filtra por una sola cuenta: pedimos cada cartera en paralelo y las unimos.
  const [transacciones, transferencias, gastosDelMes] = await Promise.all([
    Promise.all(carteras.map((c) => transaccionesApi.listar({ cuenta_id: c.id, limit: LIMITE_MOVIMIENTOS }))),
    Promise.all(carteras.map((c) => transferenciasApi.listar({ cuenta_id: c.id, limit: LIMITE_MOVIMIENTOS }))),
    Promise.all(carteras.map((c) => transaccionesApi.buscar({ cuenta_id: c.id, tipo: "gasto", ...mes, limit: 1 }))),
  ]);
  return {
    cuentas,
    carteras,
    saldos: resumen.cuentas.filter((s) => carteras.some((c) => c.id === s.cuenta_id)),
    categorias,
    transacciones: transacciones.flat(),
    // Una transferencia entre dos carteras aparece en las dos listas: la dejamos una vez.
    transferencias: [...new Map(transferencias.flat().map((t) => [t.id, t])).values()],
    gastadoEsteMes: gastosDelMes.reduce((total, pagina) => total + Number(pagina.total_gastos), 0),
  };
}

/** Banco "habitual" para retirar o depositar: el primero que no sea efectivo ni tarjeta. */
function bancoPorDefecto(cuentas: Cuenta[]): Cuenta | undefined {
  const otras = cuentas.filter((c) => c.tipo !== "efectivo");
  return otras.find((c) => c.tipo !== "credito") ?? otras[0];
}

export function EfectivoPage() {
  const [modal, setModal] = useState<EstadoModal>(null);
  const estado = useDatos(cargar, [], "efectivo");

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  function alAjustar(cartera: Cuenta, ajuste: AjusteSaldo) {
    avisar(`Cartera «${cartera.nombre}» cuadrada (${formatearDinero(ajuste.diferencia, cartera.moneda)}).`);
    alGuardar();
  }

  const datos = estado.datos;
  const saldoDe = (cartera: Cuenta) => datos?.saldos.find((s) => s.cuenta_id === cartera.id)?.saldo ?? "0";
  const cartera = datos?.carteras[0];
  const banco = datos && bancoPorDefecto(datos.cuentas);

  return (
    <>
      <EncabezadoPagina
        titulo="Efectivo"
        consejo="«Retirar» pasa dinero del banco a la cartera y «Gasto rápido» anota un gasto en efectivo en dos toques."
        descripcion="El dinero que llevas en la cartera"
        acciones={
          cartera && (
            <>
              {banco && (
                <>
                  <Boton
                    variante="secundario"
                    onClick={() =>
                      setModal({ modo: "transferir", titulo: "Retirar efectivo", sentido: { origenId: banco.id, destinoId: cartera.id, notas: "Retiro de cajero" } })
                    }
                  >
                    <ArrowDownToLine size={16} /> Retirar
                  </Boton>
                  <Boton
                    variante="secundario"
                    onClick={() =>
                      setModal({ modo: "transferir", titulo: "Depositar efectivo", sentido: { origenId: cartera.id, destinoId: banco.id, notas: "Depósito en banco" } })
                    }
                  >
                    <ArrowUpFromLine size={16} /> Depositar
                  </Boton>
                </>
              )}
              <Boton onClick={() => setModal({ modo: "gasto" })}>
                <Zap size={16} /> Gasto rápido
              </Boton>
            </>
          )
        }
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {({ cuentas, carteras, saldos, categorias, transacciones, transferencias, gastadoEsteMes }) => {
          if (carteras.length === 0) {
            return (
              <Tarjeta>
                <Vacio
                  mensaje="Crea una cartera para llevar la cuenta de tus billetes y monedas (una por moneda si usas varias)"
                  accion={<Boton onClick={() => setModal({ modo: "cartera" })}><Plus size={16} /> Crear cartera</Boton>}
                />
              </Tarjeta>
            );
          }

          const total = saldos.reduce((suma, s) => suma + Number(s.saldo_principal), 0);
          const cuentaPorId = new Map(cuentas.map((c) => [c.id, c]));
          const categoriaPorId = new Map(categorias.map((c) => [c.id, c]));
          const movimientos: Movimiento[] = [
            ...transacciones.map((t) => ({ clase: "transaccion" as const, fecha: t.fecha, transaccion: t })),
            ...transferencias.map((t) => ({ clase: "transferencia" as const, fecha: t.fecha, transferencia: t })),
          ]
            .sort((a, b) => b.fecha.localeCompare(a.fecha))
            .slice(0, LIMITE_MOVIMIENTOS);

          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <Tarjeta className="sm:col-span-2 lg:col-span-1">
                  <p className="text-sm font-semibold text-tenue">Total en efectivo</p>
                  <p className="mt-1 text-3xl font-bold tabular-nums">{formatearDinero(total)}</p>
                  <p className="mt-2 text-xs text-tenue">
                    Gastado en efectivo este mes:{" "}
                    <strong className="text-texto tabular-nums">{formatearDinero(gastadoEsteMes)}</strong>
                  </p>
                </Tarjeta>
                {saldos.map((s) => (
                  <Tarjeta key={s.cuenta_id}>
                    <p className="flex items-center gap-2 text-sm font-semibold text-tenue">
                      <Banknote size={16} /> {s.nombre}
                    </p>
                    <p className={`mt-1 text-2xl font-bold tabular-nums ${Number(s.saldo) < 0 ? "text-rose-600 dark:text-rose-400" : ""}`}>
                      {formatearDinero(s.saldo, s.moneda)}
                    </p>
                    {/* Saldo negativo: faltan movimientos por anotar (no se puede deber efectivo). */}
                    {Number(s.saldo) < 0 && <p className="mt-2 text-xs text-tenue">¿Falta anotar algún retiro?</p>}
                    {Number(s.saldo) >= 0 && s.moneda !== saldos[0]?.moneda && (
                      <p className="mt-2 text-xs text-tenue tabular-nums">≈ {formatearDinero(s.saldo_principal)}</p>
                    )}
                    {/* Contar los billetes y escribir lo que hay: lo más rápido para que cuadre. */}
                    <Boton
                      variante="fantasma"
                      className="mt-2 -ml-2 px-2 py-1 text-xs"
                      onClick={() => {
                        const cartera = carteras.find((c) => c.id === s.cuenta_id);
                        if (cartera) setModal({ modo: "ajustar", cartera });
                      }}
                    >
                      <Scale size={14} /> Cuadrar con lo que hay
                    </Boton>
                  </Tarjeta>
                ))}
              </div>

              <Tarjeta
                titulo="Últimos movimientos"
                accion={
                  <Boton variante="fantasma" className="px-2 py-1 text-xs" onClick={() => setModal({ modo: "cartera" })}>
                    <Plus size={14} /> Otra cartera
                  </Boton>
                }
              >
                {movimientos.length === 0 ? (
                  <Vacio mensaje="Aún no hay movimientos en efectivo. Empieza con un retiro o un gasto rápido." />
                ) : (
                  <ul className="divide-y divide-linea">
                    {movimientos.map((m) =>
                      m.clase === "transaccion" ? (
                        <FilaTransaccion
                          key={`t-${m.transaccion.id}`}
                          transaccion={m.transaccion}
                          categoria={categoriaPorId.get(m.transaccion.categoria_id)}
                          cuenta={cuentaPorId.get(m.transaccion.cuenta_id)}
                          onEditar={() => setModal({ modo: "editar", transaccion: m.transaccion })}
                          onEliminar={() =>
                            confirmarYEliminar("¿Eliminar este movimiento?", () => transaccionesApi.eliminar(m.transaccion.id), estado.recargar)
                          }
                        />
                      ) : (
                        <FilaMovimientoCartera
                          key={`m-${m.transferencia.id}`}
                          transferencia={m.transferencia}
                          origen={cuentaPorId.get(m.transferencia.cuenta_origen_id)}
                          destino={cuentaPorId.get(m.transferencia.cuenta_destino_id)}
                        />
                      ),
                    )}
                  </ul>
                )}
              </Tarjeta>

            </div>
          );
        }}
      </Contenido>

      {/* Fuera de <Contenido>: así se puede crear la primera cartera cuando aún no hay ninguna */}
      <Modal titulo={modal ? tituloModal(modal) : ""} abierto={modal !== null} onCerrar={() => setModal(null)}>
        {modal?.modo === "cartera" && <FormularioCuenta tipoInicial="efectivo" onGuardado={alGuardar} onCancelar={() => setModal(null)} />}
        {datos && modal?.modo === "gasto" && (
          <FormularioGastoRapido
            carteras={datos.carteras}
            categorias={ordenarPorUso(datos.categorias, datos.transacciones, "gasto")}
            onGuardado={alGuardar}
            onCancelar={() => setModal(null)}
          />
        )}
        {datos && modal?.modo === "transferir" && (
          <FormularioTransferencia sentido={modal.sentido} cuentas={datos.cuentas} onGuardado={alGuardar} onCancelar={() => setModal(null)} />
        )}
        {datos && modal?.modo === "editar" && (
          <FormularioTransaccion
            key={modal.transaccion.id}
            inicial={modal.transaccion}
            categorias={datos.categorias}
            cuentas={datos.cuentas}
            onGuardado={alGuardar}
            onCancelar={() => setModal(null)}
          />
        )}
        {datos && modal?.modo === "ajustar" && (
          <PanelAjusteSaldo
            // Con el saldo en la key: al deshacer un ajuste, el campo empieza de nuevo con el saldo nuevo.
            key={`${modal.cartera.id}:${saldoDe(modal.cartera)}`}
            cuenta={modal.cartera}
            saldo={Number(saldoDe(modal.cartera))}
            onAjustado={(ajuste) => alAjustar(modal.cartera, ajuste)}
            onCambio={estado.recargar}
            onCancelar={() => setModal(null)}
          />
        )}
      </Modal>
    </>
  );
}

function tituloModal(modal: NonNullable<EstadoModal>): string {
  if (modal.modo === "gasto") return "Gasto rápido en efectivo";
  if (modal.modo === "transferir") return modal.titulo;
  if (modal.modo === "editar") return "Editar movimiento";
  if (modal.modo === "ajustar") return `Cuadrar · ${modal.cartera.nombre}`;
  return "Nueva cartera";
}

interface FilaMovimientoCarteraProps {
  transferencia: Transferencia;
  origen: Cuenta | undefined;
  destino: Cuenta | undefined;
}

/** Retiro (entra efectivo) o depósito (sale efectivo). Se edita desde Cuentas. */
function FilaMovimientoCartera({ transferencia: t, origen, destino }: FilaMovimientoCarteraProps) {
  const esRetiro = destino?.tipo === "efectivo";
  // Lo que se mueve en la cartera: si entra, lo que llega; si sale, lo que sale.
  const cartera = esRetiro ? destino : origen;
  const monto = esRetiro ? (t.monto_destino ?? t.monto_origen) : t.monto_origen;
  return (
    <li className="flex items-center gap-3 py-3">
      <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-acento-50 text-acento-600 dark:bg-acento-950 dark:text-acento-400">
        {esRetiro ? <ArrowDownToLine size={18} /> : <ArrowUpFromLine size={18} />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate font-medium">{esRetiro ? "Retiro" : "Depósito"}</p>
        <p className="line-clamp-2 text-xs text-tenue sm:truncate">
          {formatearFecha(t.fecha)} · {origen?.nombre}
          <ArrowRight size={12} className="mx-0.5 inline" aria-label="a" />
          {destino?.nombre}
          {t.notas && ` · ${t.notas}`}
        </p>
      </div>
      <span className={`font-semibold tabular-nums ${esRetiro ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400"}`}>
        {esRetiro ? "+" : "−"}
        {cartera && formatearDinero(monto, cartera.moneda)}
      </span>
      <Link
        to="/cuentas"
        title="Las transferencias se editan desde Cuentas"
        aria-label="Editar desde Cuentas"
        className="shrink-0 rounded-lg p-1.5 text-tenue-2 transition-colors hover:bg-realce hover:text-texto"
      >
        <ArrowRight size={16} />
      </Link>
    </li>
  );
}
