import { ExternalLink, Hourglass, PiggyBank, Plus, ShoppingBag, Sparkles, X } from "lucide-react";
import { useState, type ReactNode } from "react";

import { deseosApi, ingresosApi, metasApi } from "../api/recursos";
import { avisarError } from "../components/ajustes/avisarError";
import { FormularioDeseo, PRIORIDADES } from "../components/formularios/FormularioDeseo";
import { BarraMeta } from "../components/metas/BarraMeta";
import { AccionesFila } from "../components/ui/AccionesFila";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { TotalConvertido } from "../components/ui/TotalConvertido";
import { useConfiguracion } from "../hooks/useConfiguracion";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import type { DecisionDeseo, Deseo, Meta } from "../types";
import { sumarConvertidos } from "../utils/divisas";
import { formatearDinero, formatearFecha } from "../utils/formato";
import { cobrosPorMes } from "../utils/periodicidad";

type EstadoModal = null | "nuevo" | Deseo;

/** "faltan 3 días", "faltan 5 h", "faltan 20 min". */
function textoRestante(hasta: string): string {
  const minutos = Math.max(1, Math.round((new Date(hasta).getTime() - Date.now()) / 60000));
  if (minutos < 60) return `faltan ${minutos} min`;
  const horas = Math.round(minutos / 60);
  if (horas < 48) return `faltan ${horas} h`;
  return `faltan ${Math.round(horas / 24)} días`;
}

const COLOR_PRIORIDAD = { alta: "text-peligro", media: "text-amber-600 dark:text-amber-400", baja: "text-tenue" };

export function DeseosPage() {
  const [modal, setModal] = useState<EstadoModal>(null);
  const [verHistorial, setVerHistorial] = useState(false);
  const { convertir } = useConfiguracion();
  const estado = useDatos(() => Promise.all([deseosApi.listar(), metasApi.listar(), ingresosApi.listar()]), [], "deseos");

  async function accion(promesa: Promise<unknown>) {
    try {
      await promesa;
      estado.recargar();
    } catch (e) {
      avisarError(e);
    }
  }

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Lista de deseos"
        consejo="Mete los caprichos en la máquina del tiempo: no podrás marcarlos como comprados hasta que pase la espera. Muchas veces, al leer tu carta, ya no lo querrás."
        descripcion="Lo que quieres comprar, sin prisas"
        acciones={<Boton onClick={() => setModal("nuevo")}><Plus size={16} /> Nuevo deseo</Boton>}
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([deseos, metas, ingresos]) => {
          const metaPorId = new Map(metas.map((m) => [m.id, m]));
          const enPrincipal = (d: Deseo) => convertir(Number(d.precio), d.moneda);
          const sumarPrecios = (lista: Deseo[]) => sumarConvertidos(lista.map((d) => ({ monto: Number(d.precio), moneda: d.moneda })), convertir);
          // Lo que ganas al día con tus ingresos fijos: da perspectiva al precio (aproximado si falta alguna tasa).
          const ingresoDiario =
            sumarConvertidos(ingresos.map((i) => ({ monto: Number(i.monto) * cobrosPorMes(i), moneda: i.moneda })), convertir).total / 30;
          const enMaquina = deseos.filter((d) => d.estado === "en_reflexion");
          const lista = deseos.filter((d) => d.estado === "deseado");
          const historial = deseos.filter((d) => d.estado === "comprado" || d.estado === "descartado");
          const noGastado = sumarPrecios(historial.filter((d) => d.estado === "descartado"));

          const decidir = (deseo: Deseo, decision: DecisionDeseo) => accion(deseosApi.decidir(deseo.id, decision));
          const tarjetaProps = {
            metaPorId,
            ingresoDiario,
            enPrincipal,
            onEditar: (d: Deseo) => setModal(d),
            onEliminar: (d: Deseo) => confirmarYEliminar(`¿Eliminar «${d.nombre}»?`, () => deseosApi.eliminar(d.id), estado.recargar),
          };

          return (
            <div className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-3">
                <Tarjeta>
                  <p className="text-sm font-semibold text-tenue">En la lista</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums"><TotalConvertido suma={sumarPrecios(lista)} /></p>
                </Tarjeta>
                <Tarjeta>
                  <p className="flex items-center gap-1.5 text-sm font-semibold text-tenue"><Hourglass size={15} /> En la máquina del tiempo</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums">{enMaquina.length}</p>
                </Tarjeta>
                <Tarjeta>
                  <p className="text-sm font-semibold text-tenue">Dinero que no gastaste</p>
                  <p className="mt-1 text-2xl font-bold tabular-nums text-ingreso"><TotalConvertido suma={noGastado} /></p>
                </Tarjeta>
              </div>

              {enMaquina.length > 0 && (
                <Tarjeta titulo="Máquina del tiempo">
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {enMaquina.map((deseo) => (
                      <TarjetaDeseo key={deseo.id} deseo={deseo} {...tarjetaProps}>
                        {deseo.listo_para_decidir ? (
                          <div className="space-y-2">
                            <p className="flex items-center gap-1.5 text-sm font-semibold text-acento-600 dark:text-acento-400">
                              <Sparkles size={15} /> ¡Ya puedes decidir! ¿Aún lo quieres?
                            </p>
                            {deseo.carta && (
                              <blockquote className="rounded-xl bg-superficie-2 p-3 text-sm italic text-suave">
                                «{deseo.carta}»
                                <span className="mt-1 block text-xs not-italic text-tenue">— Tú, el {formatearFecha(deseo.creado.slice(0, 10))}</span>
                              </blockquote>
                            )}
                            <div className="flex flex-wrap gap-1.5">
                              <Boton className="px-3 py-1.5 text-xs" onClick={() => decidir(deseo, "comprar")}>Lo compro</Boton>
                              <Boton variante="secundario" className="px-3 py-1.5 text-xs" onClick={() => decidir(deseo, "guardar")}>A la lista</Boton>
                              <Boton variante="secundario" className="px-3 py-1.5 text-xs" onClick={() => decidir(deseo, "descartar")}>Ya no lo quiero</Boton>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="flex items-center gap-1.5 text-xs text-tenue">
                              <Hourglass size={14} /> {textoRestante(deseo.reflexion_hasta!)}
                            </span>
                            <Boton variante="fantasma" className="px-2 py-1 text-xs" onClick={() => decidir(deseo, "descartar")}>
                              <X size={14} /> Ya no lo quiero
                            </Boton>
                          </div>
                        )}
                      </TarjetaDeseo>
                    ))}
                  </ul>
                </Tarjeta>
              )}

              <Tarjeta titulo="Lista de deseos">
                {lista.length === 0 ? (
                  <Vacio mensaje="Tu lista está vacía" accion={<Boton variante="secundario" onClick={() => setModal("nuevo")}>Añadir un deseo</Boton>} />
                ) : (
                  <ul className="grid gap-3 sm:grid-cols-2">
                    {lista.map((deseo) => (
                      <TarjetaDeseo key={deseo.id} deseo={deseo} {...tarjetaProps}>
                        <div className="flex flex-wrap gap-1.5">
                          {deseo.meta_id === null && (
                            <Boton variante="secundario" className="px-2.5 py-1 text-xs" onClick={() => accion(deseosApi.crearMeta(deseo.id))}>
                              <PiggyBank size={14} /> Ahorrar para esto
                            </Boton>
                          )}
                          <Boton variante="secundario" className="px-2.5 py-1 text-xs" onClick={() => accion(deseosApi.reflexionar(deseo.id, 7))}>
                            <Hourglass size={14} /> Pensarlo 1 semana
                          </Boton>
                          <Boton variante="fantasma" className="px-2.5 py-1 text-xs" onClick={() => decidir(deseo, "comprar")}>
                            <ShoppingBag size={14} /> Lo compré
                          </Boton>
                          <Boton variante="fantasma" className="px-2.5 py-1 text-xs" onClick={() => decidir(deseo, "descartar")}>
                            <X size={14} /> Descartar
                          </Boton>
                        </div>
                      </TarjetaDeseo>
                    ))}
                  </ul>
                )}
              </Tarjeta>

              {historial.length > 0 && (
                <Tarjeta
                  titulo="Historial"
                  accion={
                    <Boton variante="fantasma" className="px-2 py-1 text-xs" onClick={() => setVerHistorial((v) => !v)}>
                      {verHistorial ? "Ocultar" : `Ver (${historial.length})`}
                    </Boton>
                  }
                >
                  {verHistorial && (
                    <ul className="divide-y divide-linea text-sm">
                      {historial.map((deseo) => (
                        <li key={deseo.id} className="flex items-center gap-3 py-2.5">
                          <span className="min-w-0 flex-1 truncate">{deseo.nombre}</span>
                          <span className={`text-xs ${deseo.estado === "descartado" ? "text-ingreso" : "text-tenue"}`}>
                            {deseo.estado === "descartado" ? "No lo compraste" : "Comprado"}
                            {deseo.fecha_decision && ` · ${formatearFecha(deseo.fecha_decision)}`}
                          </span>
                          <span className="tabular-nums">{formatearDinero(deseo.precio, deseo.moneda)}</span>
                          <AccionesFila nombre={deseo.nombre} onEditar={() => setModal(deseo)} onEliminar={() => tarjetaProps.onEliminar(deseo)} />
                        </li>
                      ))}
                    </ul>
                  )}
                </Tarjeta>
              )}

              <Modal titulo={modal === "nuevo" ? "Nuevo deseo" : "Editar deseo"} abierto={modal !== null} onCerrar={() => setModal(null)}>
                {modal !== null && (
                  <FormularioDeseo
                    key={modal === "nuevo" ? "nuevo" : modal.id}
                    inicial={modal === "nuevo" ? undefined : modal}
                    metas={metas}
                    onGuardado={alGuardar}
                    onCancelar={() => setModal(null)}
                  />
                )}
              </Modal>
            </div>
          );
        }}
      </Contenido>
    </>
  );
}

interface TarjetaDeseoProps {
  deseo: Deseo;
  metaPorId: Map<number, Meta>;
  ingresoDiario: number;
  enPrincipal: (deseo: Deseo) => number | undefined;
  onEditar: (deseo: Deseo) => void;
  onEliminar: (deseo: Deseo) => void;
  children: ReactNode;
}

/** Un deseo: precio, tienda, prioridad, meta vinculada y las acciones de su sección. */
function TarjetaDeseo({ deseo, metaPorId, ingresoDiario, enPrincipal, onEditar, onEliminar, children }: TarjetaDeseoProps) {
  const meta = deseo.meta_id !== null ? metaPorId.get(deseo.meta_id) : undefined;
  const precio = enPrincipal(deseo);
  const diasDeTrabajo = ingresoDiario > 0 && precio !== undefined ? precio / ingresoDiario : null;

  return (
    <li className="flex flex-col gap-3 rounded-2xl p-4 ring-1 ring-linea">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{deseo.nombre}</p>
          <p className="text-xs text-tenue">
            <span className={COLOR_PRIORIDAD[deseo.prioridad]}>Prioridad {PRIORIDADES[deseo.prioridad].toLowerCase()}</span>
            {deseo.notas && ` · ${deseo.notas}`}
          </p>
        </div>
        <AccionesFila nombre={deseo.nombre} onEditar={() => onEditar(deseo)} onEliminar={() => onEliminar(deseo)} />
      </div>
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xl font-bold tabular-nums">{formatearDinero(deseo.precio, deseo.moneda)}</span>
        {deseo.enlace && (
          <a href={deseo.enlace} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-xs font-medium text-acento-600 hover:underline dark:text-acento-400">
            {deseo.tienda ?? "Ver en la tienda"} <ExternalLink size={12} />
          </a>
        )}
      </div>
      {diasDeTrabajo !== null && (
        <p className="text-xs text-tenue">≈ {diasDeTrabajo < 1 ? "menos de 1 día" : `${diasDeTrabajo.toFixed(1)} días`} de tus ingresos fijos</p>
      )}
      {meta && <BarraMeta meta={meta} conNombre />}
      {children}
    </li>
  );
}
