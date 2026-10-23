import { Check, ChevronDown, Plus } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { Link } from "react-router";

import { transaccionesApi } from "../../api/recursos";
import { useConfiguracion } from "../../hooks/useConfiguracion";
import { useEnvio } from "../../hooks/useEnvio";
import type { Categoria, Cuenta, Moneda, TipoMovimiento, Transaccion } from "../../types";
import { ordenarPorUso } from "../../utils/categorias";
import { formatearDinero, formatearFecha, hoyISO } from "../../utils/formato";
import { Boton } from "../ui/Boton";
import { CLASE_ENTRADA, Campo, ErrorFormulario } from "../ui/Campo";
import { SelectMoneda } from "../ui/SelectMoneda";
import { SelectorFecha } from "../ui/SelectorFecha";
import { CategoriaRapida } from "./CategoriaRapida";
import { VistaPreviaConversion } from "./FormularioTransaccion";
import { CLASE_CASILLA, RejillaCategorias } from "./RejillaCategorias";

// Comodidad de este navegador: la cuenta con la que se anotó la última vez.
const CLAVE_CUENTA = "registro-ultima-cuenta";
// Movimientos recientes que deciden qué categorías salen primero.
const RECIENTES_PARA_ORDENAR = 200;

function leerUltimaCuenta(): number | undefined {
  try {
    return Number(localStorage.getItem(CLAVE_CUENTA)) || undefined;
  } catch {
    return undefined; // navegación privada: se usa la primera cuenta
  }
}

function recordarCuenta(id: number) {
  try {
    localStorage.setItem(CLAVE_CUENTA, String(id));
  } catch {
    // Sin almacenamiento, la próxima vez se propone la primera cuenta.
  }
}

interface FormularioRegistroRapidoProps {
  categorias: Categoria[];
  cuentas: Cuenta[];
  /** Cuenta propuesta (p. ej. la del filtro activo); si no, la última usada. */
  cuentaInicial?: number;
  /** Tras cada movimiento guardado o deshecho: la página recarga su lista. */
  onGuardado: () => void;
  onCerrar: () => void;
}

/**
 * Anotar un movimiento en dos toques: el importe y la categoría, que guarda al tocarla.
 * Fecha (hoy) y cuenta (la última usada) van plegadas porque casi nunca cambian.
 * La ventana no se cierra al guardar: así se apuntan varios tickets seguidos.
 */
export function FormularioRegistroRapido({ categorias, cuentas, cuentaInicial, onGuardado, onCerrar }: FormularioRegistroRapidoProps) {
  const { moneda: monedaPrincipal } = useConfiguracion();
  const cuentaDe = (id: number | undefined) => cuentas.find((c) => c.id === id);
  const [cuentaId, setCuentaId] = useState(() => (cuentaDe(cuentaInicial) ?? cuentaDe(leerUltimaCuenta()) ?? cuentas[0])?.id ?? 0);
  const [tipo, setTipo] = useState<TipoMovimiento>("gasto");
  const [monto, setMonto] = useState("");
  // Como en el formulario completo: la moneda de la cuenta salvo que se elija otra a mano.
  const [moneda, setMoneda] = useState<Moneda>(() => cuentaDe(cuentaId)?.moneda ?? monedaPrincipal);
  const [monedaElegida, setMonedaElegida] = useState(false);
  const [fecha, setFecha] = useState(hoyISO);
  const [notas, setNotas] = useState("");
  const [masOpciones, setMasOpciones] = useState(false);
  const [categoriasLocales, setCategoriasLocales] = useState(categorias);
  const [creandoCategoria, setCreandoCategoria] = useState(false);
  const [recientes, setRecientes] = useState<Transaccion[]>([]);
  // Lo anotado sin cerrar la ventana, el más reciente primero.
  const [anotadas, setAnotadas] = useState<Transaccion[]>([]);
  const formulario = useRef<HTMLFormElement>(null);
  const entradaMonto = useRef<HTMLInputElement>(null);
  const { enviando, error, ejecutar } = useEnvio();

  useEffect(() => {
    // Si falla, las categorías salen en el orden en que se crearon: no merece un error.
    transaccionesApi.buscar({ limit: RECIENTES_PARA_ORDENAR }).then((pagina) => setRecientes(pagina.items), () => {});
  }, []);

  if (cuentas.length === 0) {
    return (
      <p className="text-sm text-suave">
        Primero necesitas una cuenta.{" "}
        <Link to="/cuentas" className="font-medium text-acento-600 hover:underline">Crear cuenta</Link>
      </p>
    );
  }

  const cuenta = cuentaDe(cuentaId);
  // Solo con los recientes de antes de abrir: si cambiara con cada guardado, las casillas
  // se moverían de sitio justo cuando el dedo va a tocar la siguiente.
  const opciones = ordenarPorUso(categoriasLocales, recientes, tipo);
  const nombreCategoria = (id: number) => categoriasLocales.find((c) => c.id === id)?.nombre ?? "";
  const ultima = anotadas[0];

  function cambiarCuenta(id: number) {
    setCuentaId(id);
    if (!monedaElegida) setMoneda(cuentaDe(id)?.moneda ?? moneda);
  }

  async function guardar(categoria: Categoria) {
    // Aviso nativo del navegador si falta el importe o no es válido.
    if (!cuenta || !formulario.current?.reportValidity()) return;
    const resultado: { creada?: Transaccion } = {};
    const ok = await ejecutar(async () => {
      resultado.creada = await transaccionesApi.crear({
        tipo,
        monto,
        moneda,
        fecha,
        categoria_id: categoria.id,
        cuenta_id: cuenta.id,
        notas: notas.trim() || null,
      });
    });
    const creada = resultado.creada;
    if (!ok || !creada) return;
    setAnotadas((actuales) => [creada, ...actuales]);
    recordarCuenta(cuenta.id);
    // Listo para el siguiente: se conservan tipo, fecha y cuenta, que suelen repetirse.
    setMonto("");
    setNotas("");
    entradaMonto.current?.focus();
    onGuardado();
  }

  async function deshacer(transaccion: Transaccion) {
    const ok = await ejecutar(() => transaccionesApi.eliminar(transaccion.id));
    if (!ok) return;
    setAnotadas((actuales) => actuales.filter((t) => t.id !== transaccion.id));
    onGuardado();
  }

  function alCrearCategoria(categoria: Categoria) {
    setCategoriasLocales((actuales) => [...actuales, categoria]);
    setCreandoCategoria(false);
  }

  // Enter en el importe no guarda: falta saber la categoría.
  const evitarEnvio = (evento: FormEvent) => evento.preventDefault();
  const resumenOpciones = `${fecha === hoyISO() ? "Hoy" : formatearFecha(fecha)} · ${cuenta?.nombre ?? ""}`;

  return (
    <form ref={formulario} onSubmit={evitarEnvio} className="space-y-4">
      <div className="grid grid-cols-2 gap-1 rounded-xl bg-superficie-2 p-1">
        {(["gasto", "ingreso"] as const).map((opcion) => (
          <button
            key={opcion}
            type="button"
            onClick={() => setTipo(opcion)}
            className={`rounded-lg py-2 text-sm font-medium capitalize transition ${
              tipo === opcion
                ? opcion === "gasto" ? "bg-rose-600 text-white" : "bg-emerald-600 text-white"
                : "text-tenue"
            }`}
          >
            {opcion}
          </button>
        ))}
      </div>

      <div className="space-y-1.5">
        <div className="flex items-end gap-1.5">
          <label className="block min-w-0 flex-1 space-y-1.5">
            <span className="text-sm font-medium text-suave">Importe</span>
            <input
              ref={entradaMonto}
              className={`${CLASE_ENTRADA} text-2xl font-semibold tabular-nums`}
              type="number"
              inputMode="decimal"
              step="0.01"
              min="0.01"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              required
              autoFocus
              placeholder="0.00"
            />
          </label>
          <SelectMoneda
            valor={moneda}
            onCambiar={(nueva) => {
              setMoneda(nueva);
              setMonedaElegida(true);
            }}
            compacta
            className="w-[5.5rem]"
            etiqueta="Moneda"
          />
        </div>
        <VistaPreviaConversion monto={Number(monto)} de={moneda} a={cuenta?.moneda} />
      </div>

      <input
        className={CLASE_ENTRADA}
        value={notas}
        onChange={(e) => setNotas(e.target.value)}
        maxLength={500}
        aria-label="Nota (opcional)"
        placeholder="Nota (opcional): tacos, súper, propina…"
      />

      <div>
        <button
          type="button"
          onClick={() => setMasOpciones(!masOpciones)}
          aria-expanded={masOpciones}
          className="flex items-center gap-1 text-sm text-tenue hover:text-texto"
        >
          {resumenOpciones}
          <ChevronDown size={16} className={`transition ${masOpciones ? "rotate-180" : ""}`} />
        </button>
        {masOpciones && (
          <div className="mt-3 grid animate-entrada grid-cols-2 gap-3">
            <SelectorFecha etiqueta="Fecha" valor={fecha} onCambiar={setFecha} />
            <Campo etiqueta="Cuenta">
              <select className={CLASE_ENTRADA} value={cuentaId} onChange={(e) => cambiarCuenta(Number(e.target.value))}>
                {cuentas.map((c) => (
                  <option key={c.id} value={c.id}>{c.nombre}</option>
                ))}
              </select>
            </Campo>
          </div>
        )}
      </div>

      <div>
        <p className="mb-2 text-sm font-medium text-suave">Toca la categoría para guardar</p>
        <RejillaCategorias categorias={opciones} deshabilitada={enviando} onElegir={guardar}>
          <button type="button" onClick={() => setCreandoCategoria(true)} className={`${CLASE_CASILLA} justify-center text-tenue`}>
            <Plus size={18} />
            <span>Nueva</span>
          </button>
        </RejillaCategorias>
        {creandoCategoria && (
          <div className="mt-2">
            <CategoriaRapida tipo={tipo} onCreada={alCrearCategoria} onCancelar={() => setCreandoCategoria(false)} />
          </div>
        )}
      </div>

      {ultima && (
        // key: la animación se repite con cada movimiento nuevo.
        <div key={ultima.id} role="status" className="flex animate-pop items-center gap-2 rounded-xl bg-emerald-500/10 px-3 py-2 text-sm">
          <Check size={16} className="shrink-0 text-emerald-600 dark:text-emerald-400" />
          <span className="min-w-0 flex-1 truncate">
            {ultima.tipo === "gasto" ? "Gasto" : "Ingreso"} de <strong className="tabular-nums">{formatearDinero(ultima.monto, ultima.moneda)}</strong>{" "}
            en {nombreCategoria(ultima.categoria_id)}
          </span>
          <button type="button" onClick={() => deshacer(ultima)} disabled={enviando} className="shrink-0 font-semibold text-acento-600 hover:underline disabled:opacity-50">
            Deshacer
          </button>
        </div>
      )}

      <ErrorFormulario mensaje={error} />
      <div className="flex items-center justify-end gap-2">
        {anotadas.length > 0 ? (
          <Boton onClick={onCerrar}>Listo · {anotadas.length} anotado{anotadas.length === 1 ? "" : "s"}</Boton>
        ) : (
          <Boton variante="secundario" onClick={onCerrar}>Cancelar</Boton>
        )}
      </div>
    </form>
  );
}
