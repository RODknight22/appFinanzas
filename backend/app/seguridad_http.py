"""Defensas HTTP del servidor de producción (app/servidor.py).

La app escucha solo en este ordenador, pero el navegador también visita otras
webs, y una web maliciosa puede intentar hablar con http://127.0.0.1:<puerto>.
Estas capas lo impiden:

- Host: solo se aceptan peticiones dirigidas a 127.0.0.1 o localhost. Frena el
  "DNS rebinding" (evil.com que de repente resuelve a 127.0.0.1).
- Origin: una escritura (POST, PATCH, DELETE…) solo vale si viene de la propia app.
- Tamaño: ninguna petición puede mandar más de 1 MB (la foto de perfil ocupa < 400 KB),
  ni declarándolo ni enviándolo por trozos sin declarar su tamaño.
- Cabeceras: el navegador solo ejecuta scripts de la propia app (CSP), no deja
  meterla en un <iframe> ajeno, no adivina tipos de archivo, etc.
"""

from starlette.datastructures import Headers
from starlette.exceptions import HTTPException
from starlette.responses import JSONResponse
from starlette.types import ASGIApp, Message, Receive, Scope, Send

HOSTS_PERMITIDOS = {"127.0.0.1", "localhost"}
TAMANO_MAXIMO = 1_000_000  # bytes
MENSAJE_DEMASIADO_GRANDE = "La petición es demasiado grande"
METODOS_SEGUROS = {"GET", "HEAD", "OPTIONS"}

# 'unsafe-inline' solo en estilos: React y Recharts escriben style="…" al vuelo.
# Los scripts, en cambio, solo pueden venir de la propia app ('self').
CSP = (
    "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; "
    "img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; "
    "manifest-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'; object-src 'none'"
)
CABECERAS = [
    (b"content-security-policy", CSP.encode()),
    (b"x-content-type-options", b"nosniff"),
    (b"x-frame-options", b"DENY"),
    (b"referrer-policy", b"no-referrer"),
    (b"cross-origin-opener-policy", b"same-origin"),
    (b"cross-origin-resource-policy", b"same-origin"),
    (b"permissions-policy", b"camera=(), microphone=(), geolocation=(), payment=(), usb=()"),
]


def _rechazar(codigo: int, mensaje: str) -> JSONResponse:
    return JSONResponse({"detail": mensaje}, status_code=codigo)


class ProteccionLocal:
    """Middleware ASGI con las cuatro defensas. Se escribe "a mano" (sin
    BaseHTTPMiddleware) para no copiar en memoria cada respuesta.

    `con_cabeceras=False` en desarrollo: allí la web la sirve Vite y la CSP
    rompería /docs, que carga sus scripts de un CDN.
    """

    def __init__(self, app: ASGIApp, con_cabeceras: bool = True) -> None:
        self.app = app
        self.cabeceras_extra = CABECERAS if con_cabeceras else []

    async def __call__(self, scope: Scope, receive: Receive, send: Send) -> None:
        if scope["type"] != "http":
            return await self.app(scope, receive, send)

        cabeceras = Headers(scope=scope)
        host = cabeceras.get("host", "")
        nombre_host = host.rsplit(":", 1)[0] if not host.startswith("[") else host
        if nombre_host not in HOSTS_PERMITIDOS:
            return await _rechazar(400, "Host no permitido")(scope, receive, send)

        origen = cabeceras.get("origin")
        if scope["method"] not in METODOS_SEGUROS and origen is not None:
            # El navegador manda Origin en las escrituras: debe ser esta misma app.
            if origen not in (f"http://{host}", f"https://{host}"):
                return await _rechazar(403, "Origen no permitido")(scope, receive, send)

        if int(cabeceras.get("content-length") or 0) > TAMANO_MAXIMO:
            return await _rechazar(413, MENSAJE_DEMASIADO_GRANDE)(scope, receive, send)

        recibidos = 0

        async def recibir_con_limite() -> Message:
            # Content-Length puede faltar (envío "chunked") o mentir: se cuentan los bytes reales.
            # HTTPException la convierte FastAPI en un 413 normal, esté donde esté leyéndose el cuerpo.
            nonlocal recibidos
            mensaje = await receive()
            if mensaje["type"] == "http.request":
                recibidos += len(mensaje.get("body", b""))
                if recibidos > TAMANO_MAXIMO:
                    raise HTTPException(413, MENSAJE_DEMASIADO_GRANDE)
            return mensaje

        async def enviar_con_cabeceras(mensaje: Message) -> None:
            if mensaje["type"] == "http.response.start":
                mensaje.setdefault("headers", [])
                mensaje["headers"] = [*mensaje["headers"], *self.cabeceras_extra]
            await send(mensaje)

        await self.app(scope, recibir_con_limite, enviar_con_cabeceras)
