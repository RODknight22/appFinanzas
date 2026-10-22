import { Database, FileSpreadsheet } from "lucide-react";

import { copiasApi } from "../../api/copias";
import { Tarjeta } from "../ui/Tarjeta";

const CLASE_ENLACE =
  "inline-flex items-center justify-center gap-2 rounded-full px-4 py-2 text-sm font-semibold transition active:scale-[0.97] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-acento-500";

/** Descargar todos los datos: la BD para restaurar y un CSV para Excel. */
export function SeccionCopias() {
  return (
    <Tarjeta titulo="Copia de seguridad">
      <div className="space-y-3 text-sm">
        <p className="text-tenue">
          Guarda la copia fuera de este ordenador (un USB o tu nube). Para restaurarla, cierra la app y sustituye{" "}
          <span className="font-mono">data/finance.db</span> por el archivo descargado.
        </p>
        <div className="flex flex-wrap gap-2">
          {/* Enlaces con estilo de botón: un <a download> descarga sin salir de la página. */}
          <a href={copiasApi.urlBd} download className={`${CLASE_ENLACE} bg-acento-600 text-white hover:bg-acento-500`}>
            <Database size={16} /> Descargar copia completa
          </a>
          <a href={copiasApi.urlCsv} download className={`${CLASE_ENLACE} bg-superficie-2 text-texto ring-1 ring-linea hover:bg-realce`}>
            <FileSpreadsheet size={16} /> Movimientos en CSV
          </a>
        </div>
      </div>
    </Tarjeta>
  );
}
