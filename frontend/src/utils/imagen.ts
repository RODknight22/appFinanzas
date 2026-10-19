/** Preparación de la foto de perfil, entera en el navegador (no se sube el original). */

const LADO = 256; // px: de sobra para un avatar, incluso en pantallas de alta densidad
const CALIDAD_JPEG = 0.85;

/**
 * Recorta la imagen al cuadrado central, la reduce a 256×256 y la devuelve
 * como JPEG en "data URL". Una foto de móvil de 5 MB queda en ~20 KB.
 */
export async function prepararFoto(archivo: File): Promise<string> {
  if (!archivo.type.startsWith("image/")) throw new Error("El archivo no es una imagen");

  // createImageBitmap decodifica la imagen y respeta la orientación EXIF de las fotos de móvil.
  const imagen = await createImageBitmap(archivo, { imageOrientation: "from-image" }).catch(() => {
    throw new Error("No se pudo leer la imagen. Prueba con una JPG o PNG.");
  });

  const lado = Math.min(imagen.width, imagen.height);
  const x = (imagen.width - lado) / 2;
  const y = (imagen.height - lado) / 2;

  const lienzo = document.createElement("canvas");
  lienzo.width = lienzo.height = LADO;
  const contexto = lienzo.getContext("2d");
  if (!contexto) throw new Error("Tu navegador no permite procesar imágenes");
  // Fondo blanco: JPEG no tiene transparencia (un PNG transparente saldría negro).
  contexto.fillStyle = "#ffffff";
  contexto.fillRect(0, 0, LADO, LADO);
  contexto.drawImage(imagen, x, y, lado, lado, 0, 0, LADO, LADO);
  imagen.close();

  return lienzo.toDataURL("image/jpeg", CALIDAD_JPEG);
}
