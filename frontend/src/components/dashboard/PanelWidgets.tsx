import {
  closestCenter,
  DndContext,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  rectSortingStrategy,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { EyeOff, GripVertical, Plus } from "lucide-react";

import type { TamanoWidget, WidgetDisposicion } from "../../types";
import { esIdWidget, WIDGETS, type DatosPanel } from "./registroWidgets";

/**
 * Columnas que ocupa cada tamaño. La cuadrícula tiene 2 columnas en móvil y
 * tablet y 4 en escritorio: los pequeños van de dos en dos incluso en el móvil.
 */
const COLUMNAS: Record<TamanoWidget, string> = {
  pequeno: "col-span-1",
  mediano: "col-span-2",
  ancho: "col-span-2 lg:col-span-3",
  grande: "col-span-2 lg:col-span-4",
};

const TAMANOS: { valor: TamanoWidget; etiqueta: string; nombre: string }[] = [
  { valor: "pequeno", etiqueta: "S", nombre: "Pequeño" },
  { valor: "mediano", etiqueta: "M", nombre: "Mediano" },
  { valor: "ancho", etiqueta: "L", nombre: "Ancho (3/4)" },
  { valor: "grande", etiqueta: "XL", nombre: "Ancho completo" },
];

/**
 * En móvil (2 columnas) los pequeños van de dos en dos. Recorre los widgets en
 * orden y devuelve los pequeños que se quedan sin compañero al lado.
 */
function pequenosSinPareja(widgets: WidgetDisposicion[]): Set<string> {
  const solos = new Set<string>();
  for (let i = 0; i < widgets.length; i++) {
    if (widgets[i].tamano !== "pequeno") continue;
    if (widgets[i + 1]?.tamano === "pequeno") i++; // forman pareja: saltamos el segundo
    else solos.add(widgets[i].id);
  }
  return solos;
}

interface WidgetOrdenableProps {
  widget: WidgetDisposicion;
  datos: DatosPanel;
  editando: boolean;
  onTamano: (tamano: TamanoWidget) => void;
  onOcultar: () => void;
  /** Pequeño sin pareja: en móvil ocupa la fila entera en vez de dejar medio hueco. */
  solitario: boolean;
}

/** Un widget en la cuadrícula. En modo edición muestra su barra de herramientas. */
function WidgetOrdenable({ widget, datos, editando, onTamano, onOcultar, solitario }: WidgetOrdenableProps) {
  // useSortable conecta el elemento con dnd-kit: nos da la posición mientras se
  // arrastra (transform) y los manejadores para el "asa" de arrastre.
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } =
    useSortable({ id: widget.id, disabled: !editando });
  if (!esIdWidget(widget.id)) return null;
  const definicion = WIDGETS[widget.id];

  return (
    <div
      ref={setNodeRef}
      // Translate (no Transform): mover sin deformar widgets de distinto tamaño.
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={`${solitario ? "col-span-2 lg:col-span-1" : COLUMNAS[widget.tamano]} ${isDragging ? "relative z-10 opacity-80" : ""}`}
    >
      {editando && (
        <div className="mb-1.5 flex select-none items-center gap-1 rounded-lg bg-acento-50 px-1.5 py-1 text-xs dark:bg-acento-950/60">
          <button
            type="button"
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Mover ${definicion.titulo}`}
            className="cursor-grab touch-none rounded p-1 text-tenue hover:bg-realce active:cursor-grabbing"
          >
            <GripVertical size={16} />
          </button>
          <span className="flex-1 truncate font-medium text-acento-700 dark:text-acento-300">{definicion.titulo}</span>
          <div className="flex rounded-md bg-superficie p-0.5" role="group" aria-label="Tamaño">
            {TAMANOS.map(({ valor, etiqueta, nombre }) => (
              <button
                key={valor}
                type="button"
                onClick={() => onTamano(valor)}
                aria-pressed={widget.tamano === valor}
                title={nombre}
                aria-label={`${nombre}: ${definicion.titulo}`}
                className={`h-6 min-w-6 rounded px-1 font-semibold ${
                  widget.tamano === valor ? "bg-acento-600 text-white" : "text-tenue hover:bg-realce"
                }`}
              >
                {etiqueta}
              </button>
            ))}
          </div>
          <button type="button" onClick={onOcultar} aria-label={`Ocultar ${definicion.titulo}`} title="Ocultar" className="rounded p-1 text-tenue hover:bg-realce hover:text-rose-600">
            <EyeOff size={16} />
          </button>
        </div>
      )}
      {/* En edición, el contenido no reacciona a clics (evita abrir enlaces al arrastrar). */}
      <div className={editando ? "pointer-events-none select-none rounded-3xl outline-2 outline-offset-2 outline-dashed outline-acento-300" : "h-full"}>
        {definicion.pintar(datos)}
      </div>
    </div>
  );
}

interface PanelWidgetsProps {
  disposicion: WidgetDisposicion[];
  datos: DatosPanel;
  editando: boolean;
  onCambiar: (nueva: WidgetDisposicion[]) => void;
}

/** Cuadrícula de widgets; en modo edición se pueden reordenar, redimensionar y ocultar. */
export function PanelWidgets({ disposicion, datos, editando, onCambiar }: PanelWidgetsProps) {
  // Ratón/dedo (tras moverse 5 px, para no confundir un clic con un arrastre) y teclado.
  const sensores = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );
  const visibles = disposicion.filter((w) => w.visible);
  const ocultos = disposicion.filter((w) => !w.visible && esIdWidget(w.id));
  const solitarios = pequenosSinPareja(visibles);

  function alSoltar({ active, over }: DragEndEvent) {
    if (!over || active.id === over.id) return;
    const desde = disposicion.findIndex((w) => w.id === active.id);
    const hasta = disposicion.findIndex((w) => w.id === over.id);
    onCambiar(arrayMove(disposicion, desde, hasta));
  }

  const cambiarWidget = (id: string, cambios: Partial<WidgetDisposicion>) =>
    onCambiar(disposicion.map((w) => (w.id === id ? { ...w, ...cambios } : w)));

  return (
    <div className="space-y-4">
      {editando && ocultos.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-linea-fuerte p-3 text-sm">
          <span className="text-tenue">Widgets ocultos:</span>
          {ocultos.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => cambiarWidget(w.id, { visible: true })}
              className="inline-flex items-center gap-1 rounded-full bg-superficie-2 px-3 py-1 text-xs font-medium hover:bg-acento-100 hover:text-acento-700 dark:hover:bg-acento-950"
            >
              <Plus size={12} /> {esIdWidget(w.id) && WIDGETS[w.id].titulo}
            </button>
          ))}
        </div>
      )}

      <DndContext sensors={sensores} collisionDetection={closestCenter} onDragEnd={alSoltar}>
        <SortableContext items={visibles.map((w) => w.id)} strategy={rectSortingStrategy}>
          <div className="grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
            {visibles.map((widget) => (
              <WidgetOrdenable
                key={widget.id}
                widget={widget}
                datos={datos}
                editando={editando}
                onTamano={(tamano) => cambiarWidget(widget.id, { tamano })}
                onOcultar={() => cambiarWidget(widget.id, { visible: false })}
                solitario={solitarios.has(widget.id)}
              />
            ))}
          </div>
        </SortableContext>
      </DndContext>

      {visibles.length === 0 && (
        <p className="py-10 text-center text-sm text-tenue">Todos los widgets están ocultos. Pulsa “Personalizar” para mostrar alguno.</p>
      )}
    </div>
  );
}
