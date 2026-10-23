import { CheckCircle2, FileUp } from "lucide-react";
import { useState, type DragEvent } from "react";

import { importacionesApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, FilaImportacion, VistaPreviaImportacion } from "../../types";
import { formatearDinero, formatearFecha } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, CLASE_ENTRADA_BASE, Campo, ErrorFormulario } from "../ui/Campo";

// El servidor de producción rechaza peticiones de más de 1 MB: mejor avisar antes.
const TAMANO_MAXIMO = 1_000_000;

interface ImportarExtractoProps {
  cuentas: Cuenta[];
  categorias: Categoria[];
  cuentaInicial?: number;
  onImportado: () => void;
  onCerrar: () => void;
}

/** Una fila de la vista previa más la decisión del usuario: ¿se importa? */
type Fila = FilaImportacion & { incluir: boolean };

const porRevisar = (fila: Fila) => fila.incluir && fila.confianza !== "alta";

/**
 * Importar un extracto bancario en tres pasos: elegir archivo → revisar → listo.
 * La vista previa se pide sola al soltar el archivo; solo hay que mirar lo dudoso.
 */
export function ImportarExtracto({ cuentas, categorias, cuentaInicial, onImportado, onCerrar }: ImportarExtractoProps) {
  const [cuentaId, setCuentaId] = useState(cuentaInicial ?? cuentas[0]?.id);
  const [archivo, setArchivo] = useState<File | null>(null);
  const [invertirSignos, setInvertirSignos] = useState(false);
  const [vista, setVista] = useState<VistaPreviaImportacion | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  const [creadas, setCreadas] = useState<number | null>(null);
  const lectura = useEnvio();
  const guardado = useEnvio();

  async function leer(nuevoArchivo: File, cuenta: number, invertir: boolean) {
    setArchivo(nuevoArchivo);
    setVista(null);
    if (nuevoArchivo.size > TAMANO_MAXIMO) {
      void lectura.ejecutar(() => Promise.reject(new Error("El archivo pasa de 1 MB: exporta un periodo más corto")));
      return;
    }
    await lectura.ejecutar(async () => {
      const resultado = await importacionesApi.vistaPrevia(cuenta, nuevoArchivo, invertir);
      setVista(resultado);
      setFilas(resultado.filas.map((fila) => ({ ...fila, incluir: !fila.duplicado })));
      // Si nada es dudoso no hay nada que revisar: se enseña todo directamente.
      setVerTodas(!resultado.filas.some((fila) => !fila.duplicado && fila.confianza !== "alta"));
    });
  }

  function alSoltar(evento: DragEvent) {
    evento.preventDefault();
    const soltado = evento.dataTransfer.files[0];
    if (soltado && cuentaId) void leer(soltado, cuentaId, invertirSignos);
  }

  /** Cambia la categoría de una fila y de las demás con el mismo concepto que aún no estaban seguras. */
  function elegirCategoria(fila: Fila, categoriaId: number) {
    setFilas((actuales) =>
      actuales.map((f) =>
        f === fila || (f.concepto === fila.concepto && f.tipo === fila.tipo && f.confianza !== "alta")
          ? { ...f, categoria_id: categoriaId, confianza: "alta" }
          : f,
      ),
    );
  }

  const alternar = (fila: Fila) =>
    setFilas((actuales) => actuales.map((f) => (f === fila ? { ...f, incluir: !f.incluir } : f)));

  async function importar() {
    if (!cuentaId) return;
    const elegidas = filas.filter((f) => f.incluir);
    await guardado.ejecutar(async () => {
      const resultado = await importacionesApi.importar(
        cuentaId,
        elegidas.map(({ fecha, monto, tipo, concepto, categoria_id }) => ({ fecha, monto, tipo, concepto, categoria_id })),
      );
      setCreadas(resultado.creadas);
      onImportado();
    });
  }

  if (creadas !== null) {
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-acento-500" />
        <p className="font-semibold">
          {creadas} movimiento{creadas === 1 ? "" : "s"} importado{creadas === 1 ? "" : "s"}
        </p>
        <Boton onClick={onCerrar}>Cerrar</Boton>
      </div>
    );
  }

  if (cuentas.length === 0) {
    return <p className="text-sm text-tenue">Crea primero una cuenta para poder importar sus movimientos.</p>;
  }

  const cuenta = cuentas.find((c) => c.id === cuentaId);
  const incluidas = filas.filter((f) => f.incluir);
  const duplicadas = filas.filter((f) => f.duplicado).length;
  const dudosas = filas.filter(porRevisar).length;
  const visibles = verTodas ? filas : filas.filter(porRevisar);

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Cuenta">
          <select
            className={CLASE_ENTRADA}
            value={cuentaId}
            onChange={(e) => {
              const nueva = Number(e.target.value);
              setCuentaId(nueva);
              // Los duplicados dependen de la cuenta: hay que volver a mirar el archivo.
              if (archivo) void leer(archivo, nueva, invertirSignos);
            }}
          >
            {cuentas.map((c) => (
              <option key={c.id} value={c.id}>{c.nombre} ({c.moneda})</option>
            ))}
          </select>
        </Campo>

        <div className="space-y-1.5">
          <span className="text-sm font-medium text-suave">Extracto del banco</span>
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={alSoltar}
            className="flex cursor-pointer items-center gap-3 rounded-xl border-2 border-dashed border-linea-fuerte px-3 py-2 text-sm transition hover:border-acento-500 hover:bg-realce"
          >
            <FileUp size={18} className="shrink-0 text-tenue" />
            <span className="truncate">{archivo ? archivo.name : "Suelta aquí el CSV o Excel, o haz clic"}</span>
            <input
              type="file"
              accept=".csv,.txt,.xlsx,.xls"
              className="sr-only"
              onChange={(e) => {
                const elegido = e.target.files?.[0];
                if (elegido && cuentaId) void leer(elegido, cuentaId, invertirSignos);
                e.target.value = ""; // permite volver a elegir el mismo archivo
              }}
            />
          </label>
        </div>
      </div>

      <ErrorFormulario mensaje={lectura.error} />
      {lectura.enviando && <p className="text-sm text-tenue">Leyendo el archivo…</p>}

      {vista && cuenta && (
        <>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
            <span><strong className="tabular-nums">{incluidas.length}</strong> por importar</span>
            {duplicadas > 0 && <span className="text-tenue">{duplicadas} ya registrado{duplicadas === 1 ? "" : "s"}</span>}
            {dudosas > 0 && (
              <span className="text-amber-600 dark:text-amber-400">{dudosas} con categoría por revisar</span>
            )}
            {vista.filas_ignoradas > 0 && (
              <span className="text-tenue" title="Totales, notas o líneas sin fecha o importe">
                {vista.filas_ignoradas} línea{vista.filas_ignoradas === 1 ? "" : "s"} ignorada{vista.filas_ignoradas === 1 ? "" : "s"}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex rounded-full bg-superficie-2 p-1 text-sm">
              {[
                { valor: false, texto: `Por revisar (${dudosas})` },
                { valor: true, texto: `Todos (${filas.length})` },
              ].map((opcion) => (
                <button
                  key={opcion.texto}
                  type="button"
                  onClick={() => setVerTodas(opcion.valor)}
                  className={`rounded-full px-3 py-1 transition ${verTodas === opcion.valor ? "bg-superficie font-semibold shadow-sm" : "text-tenue hover:text-texto"}`}
                >
                  {opcion.texto}
                </button>
              ))}
            </div>
            <label className="flex items-center gap-2 text-sm text-suave">
              <input
                type="checkbox"
                checked={invertirSignos}
                onChange={(e) => {
                  setInvertirSignos(e.target.checked);
                  if (archivo && cuentaId) void leer(archivo, cuentaId, e.target.checked);
                }}
              />
              Invertir signos <span className="text-tenue">(si los gastos salen como ingresos)</span>
            </label>
          </div>

          {visibles.length === 0 ? (
            <p className="rounded-xl bg-superficie-2 px-4 py-6 text-center text-sm text-tenue">
              Todo tiene categoría conocida. Puedes importar directamente.
            </p>
          ) : (
            <ul className="max-h-[45vh] divide-y divide-linea overflow-y-auto rounded-xl ring-1 ring-linea">
              {visibles.map((fila) => (
                <FilaVistaPrevia
                  key={fila.fila}
                  fila={fila}
                  moneda={cuenta.moneda}
                  categorias={categorias.filter((c) => c.tipo === fila.tipo)}
                  onAlternar={() => alternar(fila)}
                  onCategoria={(id) => elegirCategoria(fila, id)}
                />
              ))}
            </ul>
          )}
        </>
      )}

      <div className="space-y-4 pt-2">
        <ErrorFormulario mensaje={guardado.error} />
        <div className="flex justify-end gap-2">
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
          <Boton onClick={importar} disabled={!vista || incluidas.length === 0 || guardado.enviando}>
            {guardado.enviando
              ? "Importando…"
              : `Importar ${incluidas.length} movimiento${incluidas.length === 1 ? "" : "s"}`}
          </Boton>
        </div>
      </div>
    </div>
  );
}

interface FilaVistaPreviaProps {
  fila: Fila;
  moneda: Cuenta["moneda"];
  categorias: Categoria[];
  onAlternar: () => void;
  onCategoria: (id: number) => void;
}

function FilaVistaPrevia({ fila, moneda, categorias, onAlternar, onCategoria }: FilaVistaPreviaProps) {
  const esGasto = fila.tipo === "gasto";
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${fila.incluir ? "" : "opacity-50"}`}>
      <input
        type="checkbox"
        checked={fila.incluir}
        onChange={onAlternar}
        aria-label={`Importar ${fila.concepto || "movimiento"} del ${formatearFecha(fila.fecha)}`}
      />
      {/* basis-48: en pantallas estrechas el concepto se queda su línea y lo demás baja debajo */}
      <div className="min-w-0 flex-1 basis-48">
        <p className="truncate text-sm font-medium">{fila.concepto || "Sin concepto"}</p>
        <p className="text-xs text-tenue">
          {formatearFecha(fila.fecha)}
          {fila.duplicado && " · ya registrado"}
        </p>
      </div>
      <select
        className={`${CLASE_ENTRADA_BASE} w-40 ${fila.incluir && fila.confianza !== "alta" ? "ring-2 ring-amber-400/60" : ""}`}
        value={fila.categoria_id}
        onChange={(e) => onCategoria(Number(e.target.value))}
        aria-label="Categoría"
        title={fila.confianza === "media" ? "Sugerida por un concepto parecido" : undefined}
      >
        {/* "Otros…" puede haberse recreado al leer el archivo y no estar aún en la lista */}
        {!categorias.some((c) => c.id === fila.categoria_id) && <option value={fila.categoria_id}>Otros</option>}
        {categorias.map((c) => (
          <option key={c.id} value={c.id}>{c.nombre}</option>
        ))}
      </select>
      <span className={`w-28 text-right text-sm font-semibold tabular-nums ${esGasto ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}`}>
        {esGasto ? "−" : "+"}{formatearDinero(fila.monto, moneda)}
      </span>
    </li>
  );
}
