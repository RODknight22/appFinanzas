import { Plus } from "lucide-react";
import { useState } from "react";

import { cuentasApi, metasApi } from "../api/recursos";
import { FormularioMeta } from "../components/formularios/FormularioMeta";
import { CelebracionHito } from "../components/metas/CelebracionHito";
import { PanelAportaciones } from "../components/metas/PanelAportaciones";
import { TarjetaMeta } from "../components/metas/TarjetaMeta";
import { avisarError } from "../components/ajustes/avisarError";
import { Boton } from "../components/ui/Boton";
import { EncabezadoPagina } from "../components/ui/EncabezadoPagina";
import { Contenido, Vacio } from "../components/ui/Estados";
import { Modal } from "../components/ui/Modal";
import { Tarjeta } from "../components/ui/Tarjeta";
import { confirmarYEliminar } from "../hooks/useEnvio";
import { useDatos } from "../hooks/useDatos";
import { useHitosMetas } from "../hooks/useHitosMetas";
import type { Cuenta, Meta } from "../types";

type EstadoModal = null | "nueva" | Meta;

export function MetasPage() {
  const [modal, setModal] = useState<EstadoModal>(null);
  // La meta cuyas aportaciones se están viendo (modal aparte del de editar).
  const [aportando, setAportando] = useState<Meta | null>(null);
  const estado = useDatos(() => Promise.all([metasApi.listar(), cuentasApi.listar()]), [], "metas");
  const { celebracion, cerrar } = useHitosMetas(estado.datos?.[0]);

  function alGuardar() {
    setModal(null);
    estado.recargar();
  }

  async function marcarCumplida(meta: Meta, cumplida: boolean) {
    await metasApi.actualizar(meta.id, { cumplida }).then(estado.recargar).catch(avisarError);
  }

  const tarjetas = (metas: Meta[], cuentas: Cuenta[]) => (
    <div className="grid gap-4 md:grid-cols-2">
      {metas.map((meta) => (
        <TarjetaMeta
          key={meta.id}
          meta={meta}
          cuenta={cuentas.find((c) => c.id === meta.cuenta_id)}
          onAportar={() => setAportando(meta)}
          onEditar={() => setModal(meta)}
          onEliminar={() =>
            confirmarYEliminar(
              `¿Eliminar la meta "${meta.nombre}"? El dinero de tus cuentas no cambia.`,
              () => metasApi.eliminar(meta.id),
              estado.recargar,
            )
          }
          onMarcarCumplida={(cumplida) => marcarCumplida(meta, cumplida)}
        />
      ))}
    </div>
  );

  return (
    <>
      <EncabezadoPagina
        titulo="Metas de ahorro"
        consejo="Una meta puede medirse con el saldo de una cuenta o con las aportaciones que vayas anotando. Al cruzar el 25, 50, 75 y 100 % lo celebramos."
        descripcion="Lo que quieres conseguir y cuánto apartar cada mes para llegar"
        acciones={<Boton onClick={() => setModal("nueva")}><Plus size={16} /> Nueva meta</Boton>}
      />

      <Contenido {...estado} onReintentar={estado.recargar}>
        {([metas, cuentas]) => {
          const activas = metas.filter((m) => !m.cumplida);
          const cumplidas = metas.filter((m) => m.cumplida);
          return (
            <div className="space-y-8">
              {activas.length === 0 ? (
                <Tarjeta>
                  <Vacio
                    mensaje={cumplidas.length ? "¡Has cumplido todas tus metas! ¿Cuál es la siguiente?" : "Crea tu primera meta: un viaje, un fondo de emergencia, un coche…"}
                    accion={<Boton variante="secundario" onClick={() => setModal("nueva")}>Nueva meta</Boton>}
                  />
                </Tarjeta>
              ) : (
                tarjetas(activas, cuentas)
              )}
              {cumplidas.length > 0 && (
                <section>
                  <h2 className="mb-3 text-sm font-semibold text-tenue">Cumplidas ({cumplidas.length})</h2>
                  {tarjetas(cumplidas, cuentas)}
                </section>
              )}

              <Modal titulo={modal === "nueva" ? "Nueva meta" : "Editar meta"} abierto={modal !== null} onCerrar={() => setModal(null)}>
                {modal !== null && (
                  <FormularioMeta
                    key={modal === "nueva" ? "nueva" : modal.id}
                    inicial={modal === "nueva" ? undefined : modal}
                    cuentas={cuentas}
                    onGuardado={alGuardar}
                    onCancelar={() => setModal(null)}
                  />
                )}
              </Modal>
            </div>
          );
        }}
      </Contenido>

      <Modal titulo={aportando ? `${aportando.icono} ${aportando.nombre}` : ""} abierto={aportando !== null} onCerrar={() => setAportando(null)}>
        {aportando && <PanelAportaciones key={aportando.id} meta={aportando} onCambio={estado.recargar} />}
      </Modal>

      {celebracion && <CelebracionHito celebracion={celebracion} onCerrar={cerrar} />}
    </>
  );
}
