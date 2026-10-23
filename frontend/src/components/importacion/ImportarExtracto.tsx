import { ArrowRightLeft, Check, CheckCircle2, FileUp } from "lucide-react";
import { useRef, useState, type DragEvent } from "react";

import { importacionesApi } from "../../api/recursos";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, FilaImportacion, ResultadoImportacion, VistaPreviaImportacion } from "../../types";
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

/**
 * Una fila de la vista previa más la decisión del usuario: ¿se importa? `unirCon` guarda
 * con qué cuenta se propuso unirla, para recuperar la unión si se vuelve a elegir esa cuenta.
 */
type Fila = FilaImportacion & { incluir: boolean; unirCon: number | null };

const porRevisar = (fila: Fila) => fila.incluir && fila.confianza !== "alta";

/** Lo que se elige en el desplegable de una fila: una categoría u otra cuenta tuya. */
type Eleccion = Pick<Fila, "categoria_id" | "cuenta_transferencia_id">;

/**
 * Importar un extracto bancario en tres pasos: elegir archivo → revisar → listo.
 * La vista previa se pide sola al soltar el archivo; solo hay que mirar lo dudoso.
 */
export function ImportarExtracto({ cuentas, categorias, cuentaInicial, onImportado, onCerrar }: ImportarExtractoProps) {
  const [cuentaId, setCuentaId] = useState(cuentaInicial ?? cuentas[0]?.id);
  const [archivo, setArchivo] = useState<File | null>(null);
  // null = lo que se usó la última vez en la cuenta (lo dice la vista previa).
  const [invertirSignos, setInvertirSignos] = useState<boolean | null>(null);
  const [vista, setVista] = useState<VistaPreviaImportacion | null>(null);
  const [filas, setFilas] = useState<Fila[]>([]);
  const [verTodas, setVerTodas] = useState(false);
  // Filas que eran dudosas al leer el archivo: siguen a la vista (con ✓) al resolverlas,
  // en vez de desaparecer de golpe, y miden el progreso de la revisión.
  const [revisables, setRevisables] = useState<Set<number>>(new Set());
  const [aviso, setAviso] = useState<{ id: number; texto: string } | null>(null);
  const [resultado, setResultado] = useState<ResultadoImportacion | null>(null);
  const lectura = useEnvio();
  const guardado = useEnvio();
  // Cambiar de cuenta o invertir signos relee el archivo: si la respuesta de una lectura
  // anterior llega tarde, se ignora (solo cuenta la última petición).
  const ultimaLectura = useRef(0);

  async function leer(nuevoArchivo: File, cuenta: number, invertir: boolean | null) {
    const peticion = ++ultimaLectura.current;
    setArchivo(nuevoArchivo);
    setVista(null);
    if (nuevoArchivo.size > TAMANO_MAXIMO) {
      void lectura.ejecutar(() => Promise.reject(new Error("El archivo pasa de 1 MB: exporta un periodo más corto")));
      return;
    }
    await lectura.ejecutar(async () => {
      let leida: VistaPreviaImportacion;
      try {
        leida = await importacionesApi.vistaPrevia(cuenta, nuevoArchivo, invertir);
      } catch (e) {
        if (peticion !== ultimaLectura.current) return; // el error de una lectura vieja no importa
        throw e;
      }
      if (peticion !== ultimaLectura.current) return;
      setVista(leida);
      setInvertirSignos(leida.invertir_signos);
      setFilas(leida.filas.map((fila) => ({
        ...fila,
        incluir: !fila.duplicado,
        unirCon: fila.transaccion_a_unir_id ? fila.cuenta_transferencia_id : null,
      })));
      const dudosas = leida.filas.filter((fila) => !fila.duplicado && fila.confianza !== "alta");
      setRevisables(new Set(dudosas.map((fila) => fila.fila)));
      setAviso(null);
      // Si nada es dudoso no hay nada que revisar: se enseña todo directamente.
      setVerTodas(dudosas.length === 0);
    });
  }

  function alSoltar(evento: DragEvent) {
    evento.preventDefault();
    const soltado = evento.dataTransfer.files[0];
    if (soltado && cuentaId) void leer(soltado, cuentaId, invertirSignos);
  }

  /** Aplica la elección a una fila y a las demás con el mismo concepto que aún no estaban seguras. */
  function elegir(fila: Fila, eleccion: Eleccion) {
    const afectada = (f: Fila) =>
      f === fila || (f.concepto === fila.concepto && f.tipo === fila.tipo && f.confianza !== "alta");
    const otras = filas.filter(afectada).length - 1;
    setFilas((actuales) =>
      actuales.map((f) => {
        if (!afectada(f)) return f;
        // La unión con un movimiento de otra cuenta solo vale para esa cuenta.
        const unir = eleccion.cuenta_transferencia_id !== null && eleccion.cuenta_transferencia_id === f.unirCon;
        return { ...f, ...eleccion, transaccion_a_unir_id: unir ? f.transaccion_a_unir_id : null, confianza: "alta" };
      }),
    );
    // Que se note el trabajo ahorrado: sin el aviso, las otras filas cambian sin que se vea.
    if (otras > 0) {
      const nombre =
        eleccion.cuenta_transferencia_id !== null
          ? "Transferencia"
          : (categorias.find((c) => c.id === eleccion.categoria_id)?.nombre ?? "La categoría");
      setAviso({ id: Date.now(), texto: `${nombre} también en ${otras} movimiento${otras === 1 ? "" : "s"} igual${otras === 1 ? "" : "es"}` });
    }
  }

  /** Da por buena la categoría propuesta en todas las filas que faltan por revisar. */
  const aceptarSugerencias = () =>
    setFilas((actuales) => actuales.map((f) => (porRevisar(f) ? { ...f, confianza: "alta" } : f)));

  const alternar = (fila: Fila) =>
    setFilas((actuales) => actuales.map((f) => (f === fila ? { ...f, incluir: !f.incluir } : f)));

  async function importar() {
    if (!cuentaId) return;
    const elegidas = filas.filter((f) => f.incluir);
    await guardado.ejecutar(async () => {
      const hecho = await importacionesApi.importar(
        cuentaId,
        elegidas.map((f) => ({
          fecha: f.fecha,
          monto: f.monto,
          tipo: f.tipo,
          concepto: f.concepto,
          categoria_id: f.categoria_id,
          cuenta_transferencia_id: f.cuenta_transferencia_id,
          transaccion_a_unir_id: f.unirCon === f.cuenta_transferencia_id ? f.transaccion_a_unir_id : null,
          transferencia_a_completar_id: f.transferencia_a_completar_id,
        })),
        Boolean(invertirSignos),
      );
      setResultado(hecho);
      onImportado();
    });
  }

  if (resultado !== null) {
    const { creadas, transferencias, unidas, completadas } = resultado;
    return (
      <div className="space-y-4 py-6 text-center">
        <CheckCircle2 size={40} className="mx-auto text-acento-500" />
        <p className="font-semibold">
          {creadas} movimiento{creadas === 1 ? "" : "s"} importado{creadas === 1 ? "" : "s"}
        </p>
        {transferencias > 0 && (
          <p className="text-sm text-tenue">
            {transferencias} como transferencia{transferencias === 1 ? "" : "s"} entre tus cuentas: no cuentan como ingreso ni gasto
            {unidas > 0 && ` (${unidas} unida${unidas === 1 ? "" : "s"} a lo que ya tenías en la otra cuenta)`}
          </p>
        )}
        {completadas > 0 && (
          <p className="text-sm text-tenue">
            {completadas} transferencia{completadas === 1 ? "" : "s"} completada{completadas === 1 ? "" : "s"} con lo que salió o llegó de verdad
          </p>
        )}
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
  const revisadas = revisables.size - dudosas;
  const visibles = verTodas ? filas : filas.filter((f) => revisables.has(f.fila));

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
              // y los signos, a lo que se usó la última vez en esa cuenta.
              if (archivo) void leer(archivo, nueva, null);
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
            {vista.filas_ignoradas > 0 && (
              <span className="text-tenue" title="Totales, notas o líneas sin fecha o importe">
                {vista.filas_ignoradas} línea{vista.filas_ignoradas === 1 ? "" : "s"} ignorada{vista.filas_ignoradas === 1 ? "" : "s"}
              </span>
            )}
          </div>

          {revisables.size > 0 && (
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-sm">
                {dudosas > 0 ? (
                  <span>Revisa <strong className="tabular-nums">{dudosas}</strong> de {revisables.size} categorías dudosas</span>
                ) : (
                  <span className="flex items-center gap-1.5 font-medium text-exito">
                    <CheckCircle2 size={16} /> Todo revisado: listo para importar
                  </span>
                )}
                {dudosas > 0 && (
                  <button type="button" onClick={aceptarSugerencias} className="font-medium text-acento-600 hover:underline">
                    Dar por buenas las sugerencias
                  </button>
                )}
              </div>
              <div
                className="h-2 overflow-hidden rounded-full bg-superficie-2"
                role="progressbar"
                aria-label="Revisión"
                aria-valuemin={0}
                aria-valuemax={revisables.size}
                aria-valuenow={revisadas}
              >
                <div
                  className={`h-full rounded-full transition-all duration-500 ${dudosas === 0 ? "bg-exito" : "bg-acento-500"}`}
                  style={{ width: `${(revisadas / revisables.size) * 100}%` }}
                />
              </div>
              {aviso && (
                // key: la animación se repite con cada aviso nuevo.
                <p key={aviso.id} role="status" className="animate-pop text-sm text-tenue">✨ {aviso.texto}</p>
              )}
            </div>
          )}

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
                className="accent-acento-600"
                checked={Boolean(invertirSignos)}
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
                  otrasCuentas={cuentas.filter((c) => c.id !== cuenta.id)}
                  revisada={revisables.has(fila.fila) && !porRevisar(fila)}
                  onAlternar={() => alternar(fila)}
                  onElegir={(eleccion) => elegir(fila, eleccion)}
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
  otrasCuentas: Cuenta[];
  /** Era dudosa y ya está resuelta: se marca con ✓ en vez de quitarla de la lista. */
  revisada: boolean;
  onAlternar: () => void;
  onElegir: (eleccion: Eleccion) => void;
}

function FilaVistaPrevia({ fila, moneda, categorias, otrasCuentas, revisada, onAlternar, onElegir }: FilaVistaPreviaProps) {
  const esGasto = fila.tipo === "gasto";
  const dudosa = porRevisar(fila);
  const esTransferencia = fila.cuenta_transferencia_id !== null;
  const completa = fila.transferencia_a_completar_id !== null;
  const unida = fila.transaccion_a_unir_id !== null && fila.unirCon === fila.cuenta_transferencia_id;
  const otraCuenta = otrasCuentas.find((c) => c.id === fila.cuenta_transferencia_id)?.nombre;
  // En el desplegable conviven categorías ("12") y cuentas ("cuenta:3").
  const valor = esTransferencia ? `cuenta:${fila.cuenta_transferencia_id}` : String(fila.categoria_id);
  function cambiar(nuevo: string) {
    onElegir(
      nuevo.startsWith("cuenta:")
        ? { categoria_id: fila.categoria_id, cuenta_transferencia_id: Number(nuevo.slice(7)) }
        : { categoria_id: Number(nuevo), cuenta_transferencia_id: null },
    );
  }
  return (
    <li className={`flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5 ${fila.incluir ? "" : "opacity-50"}`}>
      <input
        type="checkbox"
        className="accent-acento-600"
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
          {completa && ` · completa la transferencia con ${otraCuenta}`}
          {unida && ` · se une con el movimiento igual de ${otraCuenta}`}
        </p>
      </div>
      {completa ? (
        // Ya existe como transferencia: solo se le pone el importe real, no hay nada que elegir.
        <span className="w-40 truncate rounded-xl bg-superficie-2 px-3 py-2 text-sm text-suave" title="Ya registrada desde la otra cuenta">
          {esGasto ? "A" : "Desde"} {otraCuenta}
        </span>
      ) : (
        <select
          className={`${CLASE_ENTRADA_BASE} w-40 ${dudosa ? "ring-2 ring-amber-400/60" : ""}`}
          value={valor}
          onChange={(e) => cambiar(e.target.value)}
          aria-label="Categoría o transferencia"
          title={
            esTransferencia
              ? "Dinero entre tus cuentas: no es ingreso ni gasto"
              : fila.confianza === "media" ? "Sugerida por un concepto parecido" : undefined
          }
        >
          {/* "Otros…" puede haberse recreado al leer el archivo y no estar aún en la lista */}
          {!categorias.some((c) => c.id === fila.categoria_id) && <option value={fila.categoria_id}>Otros</option>}
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>{c.nombre}</option>
          ))}
          {otrasCuentas.length > 0 && (
            <optgroup label="Transferencia entre tus cuentas">
              {otrasCuentas.map((c) => (
                <option key={c.id} value={`cuenta:${c.id}`}>{esGasto ? "A" : "Desde"} {c.nombre}</option>
              ))}
            </optgroup>
          )}
        </select>
      )}
      {/* Mismo ancho en los tres casos para que la columna del importe no baile */}
      <span className="flex w-8 justify-center">
        {dudosa ? (
          <button
            type="button"
            onClick={() => onElegir({ categoria_id: fila.categoria_id, cuenta_transferencia_id: fila.cuenta_transferencia_id })}
            aria-label={`Aceptar la sugerencia para ${fila.concepto || "este movimiento"}`}
            title="Dar por buena"
            className="rounded-full p-1.5 text-tenue ring-1 ring-linea transition hover:bg-realce hover:text-exito active:scale-90"
          >
            <Check size={14} />
          </button>
        ) : (
          revisada && <CheckCircle2 size={18} className="animate-pop text-exito" aria-label="Revisada" />
        )}
      </span>
      {/* Una transferencia no es ingreso ni gasto: en neutro y con su icono */}
      <span
        className={`flex w-28 items-center justify-end gap-1 text-sm font-semibold tabular-nums ${
          esTransferencia ? "text-suave" : esGasto ? "text-gasto" : "text-ingreso"
        }`}
      >
        {esTransferencia && <ArrowRightLeft size={14} className="text-tenue" aria-label="Transferencia" />}
        {esGasto ? "−" : "+"}{formatearDinero(fila.monto, moneda)}
      </span>
    </li>
  );
}
