import { Boton } from "../ui/Boton";
import { ErrorFormulario } from "../ui/Campo";

interface PieFormularioProps {
  error: string | null;
  enviando: boolean;
  onCancelar: () => void;
  textoGuardar?: string;
}

/** Error de la API + botones Cancelar/Guardar, comunes a todos los formularios. */
export function PieFormulario({ error, enviando, onCancelar, textoGuardar = "Guardar" }: PieFormularioProps) {
  return (
    <div className="space-y-4 pt-2">
      <ErrorFormulario mensaje={error} />
      <div className="flex justify-end gap-2">
        <Boton variante="secundario" onClick={onCancelar}>
          Cancelar
        </Boton>
        <Boton type="submit" disabled={enviando}>
          {enviando ? "Guardando…" : textoGuardar}
        </Boton>
      </div>
    </div>
  );
}
