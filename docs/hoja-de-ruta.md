# Hoja de ruta

Plan orientativo por versiones: se puede reordenar cuando haga falta. Cada tarea dice **por qué**,
**dónde** se toca y **cuándo está hecha**. Al fusionar una tarea en `main`, marcarla con `[x]`.
Las ideas en bruto van al cuaderno `ideas.md` de la rama `ideas`; aquí solo llegan las que ya son
tarea.

Origen: auditorías de estado, seguridad, rendimiento y producto del 21-22/10/2026, y segunda
ronda (frontend, backend, seguridad, diseño y mercado) del 23/10/2026.

## Visión

**Las finanzas de quien vive entre dos monedas** (cobra en una y gasta en otra: migrantes,
remoto para fuera, remesas entre Latinoamérica y Europa). Local, privada y sin depender de
conectar el banco. No competimos con YNAB en presupuestos ni con Fintonic en bancos: lo que nadie
hace es guardar cada movimiento con la tasa de su día, medir cuánto cuesta cambiar de moneda y
cuánto rinde el sueldo.

Cada versión tiene **una innovación**: lo nuevo que justifica actualizar. Prioridades: **P1**
imprescindible para publicar la versión, **P2** conviene, **P3** si sobra tiempo (si no, pasa a
la siguiente).

| Versión | Nombre | La innovación |
| --- | --- | --- |
| v1.3 | Pulido y confianza | Nada se rompe ni se pierde: todo o nada, copia antes de migrar, más monedas |
| v1.4 | Remesas | Saber cuándo y por dónde cambiar dinero sale más barato |
| v1.5 | En el bolsillo | Anotar desde el móvil como una app instalada, y en inglés |
| v2.0 | Conectada | Preguntar a tu asistente de IA por tus finanzas sin que salgan de tu equipo |

---

## Hecho desde v1.0.0

- [x] Tests de propiedades financieras (modelo de referencia) y benchmark con 10k-100k movimientos.
- [x] Rendimiento: `LIMIT 1` al buscar tasas (patrimonio de ~2 s a ~50 ms).
- [x] Importar extractos CSV/.xlsx sin configurar nada: categoría aprendida y duplicados.
- [x] Seguridad de la importación: límite real de 1 MB (también "chunked") y freno a bombas ZIP.
- [x] Tasas históricas del BCE para fechas pasadas, con recálculo de lo ya guardado.
- [x] Ingresos fijos (calendario flexible) y efectivo (pestaña de Cuentas, subcuentas, fijadas).
- [x] UX: ver contraseña, presupuestos con divisa, selector de fecha, bienvenida y consejos.
- [x] Deudas (quién te debe y a quién debes), lista de deseos, campana de avisos.
- [x] E2E en el repo (`scripts/e2e.sh`) y `scripts/verificar.sh`; CLAUDE.md dividido.
- [x] Apariencia: 5 estilos visuales (claro/oscuro), 12 acentos y fundido al cambiarlos;
  navegación fluida (páginas precargadas en reposo y caché de datos en `useDatos`).

---

## v1.1: Consolidar y publicar

**Objetivo:** publicar todo lo anterior con red de seguridad. Ninguna función grande nueva salvo
las copias de seguridad, que una app de dinero necesita antes de que nadie más la use.

**Plan (23/10/2026):** en este orden, una PR cada vez. La importación con extractos reales pasó
a la v1.2: espera a que Rodrigo tenga los extractos y no debe frenar la publicación.

| Orden | Tarea | Depende de | Zona que toca |
| --- | --- | --- | --- |
| 1 | Ajustes con pestañas y personalización | — | AjustesPage.tsx, components/ajustes/ |
| 2 | Publicar v1.1.0 | 1 | version.py, package.json, CHANGELOG, README |
| 3 | Probar el release en la laptop (Rodrigo) | 2 | — |

- [x] **Ajustes con pestañas** (idea de Rodrigo): Perfil · Apariencia · Monedas · Seguridad y
  datos, con `SeccionConPestanas` (una ruta por pestaña). En Apariencia, los iconos de los estilos
  pasan a ser una vista previa clara y oscura, y el primero tiene descripción de verdad.
  *Por qué:* Ajustes es un muro de tarjetas que no para de crecer. *Hecho cuando:* cada pestaña
  tiene su ruta, sin scroll horizontal a 390 px (E2E).
- [x] **Copia de seguridad y exportación.** Botón en Ajustes que descarga la BD y un CSV.
  *Por qué:* hoy no hay forma segura de guardar los datos. *Dónde:* nuevo services/copias.py +
  Ajustes. *Ojo:* con WAL no basta copiar el archivo: usar `VACUUM INTO` o la API de backup de
  sqlite3; en el CSV, anteponer `'` a celdas que empiecen por `= + - @` (inyección de fórmulas).
  *Hecho cuando:* restaurar la copia en una BD vacía da los mismos saldos (test).
- [x] **Desarrollo sin datos reales y con defensas.** *Por qué:* `docker compose` usa
  data/finance.db y el puerto 8000 no tiene las defensas de Host/Origin (auditoría M3).
  *Dónde:* docker-compose.yml, main.py. *Hecho cuando:* una web ajena no puede escribir en :8000.
- [x] **CI completo:** ejecutar `scripts/verificar.sh --e2e` en GitHub Actions y añadir linters
  (ruff para Python, eslint para TS). *Dónde:* .github/workflows/ci.yml.
- [x] **Release más seguro** (auditoría B1): permisos por trabajo y acciones fijadas por SHA.
  *Dónde:* .github/workflows/release.yml.
- [x] **Publicar v1.1.0:** versión en backend/app/version.py y frontend/package.json, CHANGELOG.md
  y README.md al día (importación, ingresos, efectivo, deudas, deseos), tag `v1.1.0`.

## v1.2: Multidivisa a fondo (lo que distingue a la app)

**Plan (23/10/2026):** extractos reales y registro ágil ya están (PRs #17 y #18). El resto, en
este orden, una PR cada vez. "Más monedas" y "Recalcular transferencias antiguas" entran solo si
da tiempo; si no, pasan a la v1.3.

| Orden | Tarea | Depende de | Zona que toca |
| --- | --- | --- | --- |
| 1 | Selector de mes más ágil | — | ui/SelectorMes.tsx |
| 2 | Flecha de las subcuentas a la izquierda | Respuesta de Rodrigo (cuaderno) | FilaCuenta.tsx |
| 3 | Bienvenida al día con tutorial de globos | — | components/bienvenida/, Layout.tsx |
| 4 | Coste real de cada envío MXN↔EUR | — | services/transferencias.py, widgets |
| 5 | Poder adquisitivo | 4 (mismo panel) | services/dashboard.py, widgets |
| 6 | Importación: transferencias propias y signos (6a); reglas editables (6b) | 6b tras 6a | services/importaciones.py |
| 7 | Presupuestos repetibles | — | services/presupuestos.py |
| 8 | Publicar v1.2.0 | 1-7 | version.py, package.json, CHANGELOG |
| 9 | Probar el release en la laptop (Rodrigo) | 8 | — |

- [x] **Probar la importación con extractos reales** de los bancos de Rodrigo (España y México).
  *Por qué:* los tests usan formatos inventados. *Dónde:* services/lector_extractos.py.
  *Hecho cuando:* cada banco se lee bien y tiene un test con su formato (datos inventados).
  Probados con los archivos reales (23/10, sin guardarlos): 5 CSV de Revolut (333 movimientos)
  y el .xls de Santander (6). Ojo: los `TRANSFER` de Revolut (31) entran como ingreso o gasto.
- [x] **Registro ágil** (idea de Rodrigo: que anotar no aburra): gasto en dos toques, varios
  seguidos con «Deshacer» y revisión de la importación con progreso. *Dónde:*
  FormularioRegistroRapido.tsx, ImportarExtracto.tsx.
- [x] **Selector de mes más ágil** (Dashboard, Transacciones y Presupuestos; idea de Rodrigo):
  botón "Hoy" fuera del mes en curso y, al tocar el nombre del mes, una cuadrícula de 12 meses
  con flechas de año. *Dónde:* ui/SelectorMes.tsx y el hook compartido usePanelFlotante.
- [x] **Bienvenida al día** (idea de Rodrigo): moneda, primera cuenta y sueldo opcional (ingreso
  fijo mensual); después, un recorrido de 9 globos de texto sobre el menú real, una frase por
  apartado (efectivo, deudas, deseos y copias incluidos). Se salta con un botón o Esc y se repite
  desde Ajustes. *Dónde:* components/bienvenida/ y `data-tutorial` en Layout.tsx.
- [x] **Flecha de las subcuentas a la izquierda** (idea de Rodrigo), más cómoda de pulsar.
- [x] **Avisos propios en vez de `alert`/`confirm`** (adelantado de la v1.3): toasts y diálogo de
  confirmación con el estilo de la app. *Dónde:* components/ui/Avisos.tsx, tablonAvisos.ts.
- [x] **Publicar v1.2.0:** versión, CHANGELOG, notas del release y README al día; tag `v1.2.0`.
- [x] **Coste real de cada envío MXN↔EUR:** en transferencias entre monedas, lo que no llegó
  frente a la tasa del BCE de ese día más la comisión ("Te costó X (Y %)") y un widget con el
  total del año. Solo cuenta si se indicó lo que llegó (columna `destino_estimado`).
  *Dónde:* services/transferencias.py, ListaTransferencias.tsx, registroWidgets.tsx.
- [x] **Poder adquisitivo:** cuántos euros rindió el ingreso en pesos este mes frente a la media
  de 12 meses. Las monedas de ingreso y de gasto se detectan solas (las de más dinero en el
  último año). *Dónde:* services/dashboard.py, widget en registroWidgets.tsx.
- [x] **Presupuestos repetibles:** "¿Repites los de septiembre? [Copiar N]" copia los del último
  mes que los tiene sin pisar los que ya hay. *Dónde:* services/presupuestos.py.
- [x] **Importación: transferencias propias y signos por cuenta.** Los cambios de divisa ("To
  MXN", "From EUR") se proponen como transferencia con tu otra cuenta (la de esa moneda, mejor
  del mismo banco) y no inflan ingresos ni gastos; cada cuenta recuerda si se invirtieron los
  signos. *Dónde:* services/importaciones.py, ImportarExtracto.tsx.
- [x] **Reglas de categoría editables** ("contiene X → categoría Y", en Categorías) que mandan
  sobre el historial; al importar, se une lo ya registrado en otra cuenta: completa la
  transferencia hecha desde el otro extracto (coste real) o une un ingreso o gasto suelto con
  el mismo importe. *Dónde:* services/reglas_categoria.py, services/importaciones.py.

## v1.3: Pulido y confianza

**Objetivo:** que la app se instale sin avisos de Windows y se pueda hacer tuya (colores y
panel), con más monedas y las transferencias antiguas bien convertidas.

**Plan (23/10/2026):** la tarea 1 va sola porque toca casi todo el frontend. Después, las tareas
2, 4 y 5 pueden ir en sesiones a la vez (zonas distintas). La 3 va después de la 2, porque las
dos tocan services/divisas.py.

| Orden | Tarea | Depende de | Zona que toca |
| --- | --- | --- | --- |
| 1 | react-router 7 y limpieza | — | package.json, imports de rutas en todo frontend/src |
| 2 | Monedas de Latinoamérica | 1 | models.py (`Moneda`), services/divisas.py, config.ts |
| 3 | Recalcular transferencias antiguas | 2 | services/transferencias.py, divisas.py, importaciones.py |
| 4 | Estilo personalizado | 1 | SeccionApariencia.tsx, index.css, Configuración |
| 5 | Widgets personalizables | 1; ideas de Rodrigo (cuaderno) | components/dashboard/ |
| 6 | Firmar el ejecutable | Rodrigo elige y contrata el certificado | release.yml, empaquetado/ |
| 7 | Publicar v1.3.0 | 1-5 (y 6 si está) | version.py, package.json, CHANGELOG |
| 8 | Probar el release en la laptop (Rodrigo) | 7 | — |
| A | Auditoría 23/10: seguridad y guía (P1) | — | lector_extractos, seguridad_http, CI, docs/ |
| B | Auditoría 23/10: todo o nada (P1) | — | divisas.py, migraciones.py, cuentas.py |
| C | Auditoría 23/10: pulido del frontend (P1) | — | frontend/src (sin backend) |

A, B y C van en paralelo (zonas distintas) y antes que la 2, que también toca divisas.py.

Si la firma (6) no está lista al terminar la 5, la v1.3 se publica sin ella y pasa a la v1.4.

- [x] **react-router 7 y limpieza.** `react-router-dom` 6.30.6 → `react-router` 7.18.4 (la 8
  exige React 19: queda para la v1.4); `npm audit` sin vulnerabilidades. `#64748b` →
  `COLOR_CATEGORIA_POR_DEFECTO` y el mensaje de error repetido → `utils/errores.ts`.
- [x] **Monedas de Latinoamérica:** COP, ARS, CLP y PEN (elegidas por Rodrigo). Aditivo: el enum
  `Moneda` se guarda como texto. Revisar `_validar_tasas` (que falte una no debe tumbar la
  descarga de las demás), `SelectMoneda`, `MONEDAS` en config.ts y las tasas de ejemplo de los
  tests. El BCE no da tasas históricas de estas: se usa la más cercana (decirlo en la app).
  *Hecho cuando:* una cuenta en COP convierte bien a la principal (test) y se ve con su formato.
- [ ] **Recalcular transferencias antiguas** cuando lleguen tasas históricas: hoy solo se
  recalculan las transacciones. Hace falta saber qué lado se estimó (`destino_estimado` no lo
  dice): columna opcional nueva con el lado. *Hecho cuando:* una transferencia estimada se
  corrige al llegar la tasa de su día (test), sin tocar los lados reales.
- [x] **Estilo personalizado:** elegir tinte y viveza propios además de los 5 estilos. index.css
  ya calcula los colores de `--tinte` y `--viveza`: basta guardarlos en Configuración (columnas
  opcionales) y escribirlos en el `style` de `<html>`. *Hecho cuando:* se ve igual al recargar
  y con buen contraste en claro y oscuro (E2E con capturas).
- [ ] **Widgets personalizables** (idea de Rodrigo): más tamaños, elegir cómo muestran los datos
  y widgets nuevos. *Antes:* Rodrigo dice en el cuaderno qué widgets echa de menos y qué quiere
  ver distinto. *Dónde:* components/dashboard/.
- [ ] **Firmar el ejecutable de Windows.** "Control de aplicaciones inteligentes" bloquea el
  .exe sin firma (le pasó a Rodrigo el 23/10). Opciones: SignPath Foundation (gratis para código
  abierto, si aceptan el proyecto), Azure Trusted Signing (de pago mensual, verificación de
  identidad) o un certificado de firma de pago. *Antes:* Rodrigo elige y lo contrata; Claude
  prepara la comparación y el paso de firma en release.yml. *Hecho cuando:* el .exe publicado
  abre con el control activado.
- [x] **A. Seguridad y guía** (P1, PR #31): máximo de columnas al importar (un CSV de 1 MB podía
  colgar la app), errores claros en vez de 500, acciones del CI fijadas por SHA, Docker sin registro
  de accesos y con zona horaria, y docs/como-funciona.md para Rodrigo.
- [x] **B. Todo o nada** (P1, PR #32): la descarga de tasas hacía commit en mitad de una
  importación; copia de la BD antes de migrar; índices que faltaban en columnas migradas; no cambiar
  la moneda de una cuenta con deudas.
- [x] **C. Pulido del frontend** (P1, PR #33): totales que contaban como 0 lo que no tiene tasa,
  foco en los diálogos, carreras al cambiar de cuenta al importar, formato de % y €, contraste,
  chunks.
- [ ] **Resto de la auditoría** (P2, una PR pequeña cada uno):
  - Pagar una suscripción o cobrar un ingreso fijo dos veces con un doble clic (idempotencia).
  - Un mismo movimiento a unir en dos filas de una importación; `IntegrityError` → 409.
  - `assets/` inexistente devuelve index.html cacheado un año: debe ser 404.
  - Navegación móvil con los mismos nombres que en escritorio y una pestaña "Más".
  - Un único recorrido de bienvenida (hoy hay modal, tarjeta y globos que se solapan).
  - Colores de ingreso/gasto propios, separados del acento elegido (22 archivos con `emerald`).
- [ ] **Publicar v1.3.0.**

## v1.4: Remesas

**La innovación:** antes de mandar dinero, saber cuánto te va a costar por cada vía y si es buen
momento. Ninguna app de finanzas lo hace; es lo que más valor da a quien vive entre dos monedas.

- [ ] **Comparar vías de envío** (P1): con tus envíos pasados, cuánto te costó cada vía (Revolut,
  banco, Wise…) frente a la tasa oficial, y cuál conviene. *Antes:* Rodrigo dice qué vías usa.
- [ ] **Tasa de Banxico (FIX)** para las fechas pasadas de MXN (P1): hoy solo hay BCE, que mide
  el euro; para el peso la referencia natural es Banxico. Fuente pública y gratuita.
- [ ] **Aviso de buen momento** (P2): "el euro está un 3 % por debajo de su media de 3 meses".
- [ ] **Más bancos al importar** (P1): BBVA México/España, Nu, Wise, CaixaBank. Cada lector con su
  test y un extracto inventado. *Antes:* Rodrigo consigue la forma (no los datos) de cada uno.
- [ ] **Etiquetas / viajes** (P2): agrupar gastos de varias categorías y monedas ("Viaje CDMX").
- [ ] Inversiones y ahorro con valoración (P3): valor por fecha, aportado frente a valor actual.
- [ ] Monedas de Europa (GBP, CHF: tienen tasas del BCE) y fuente histórica para GTQ/HNL (P3).
- [ ] Recordatorios por correo y seguir precios de los deseos (P3).
- [ ] Atajo ASCII en `normalizar_texto` si la búsqueda se nota lenta (medido: 35×) (P3).
- [ ] **React 19 y react-router 8** (P2; la 8 exige React ≥ 19.2): revisar Recharts y dnd-kit.

## v1.5: En el bolsillo

**La innovación:** la app se instala en el móvil y en el escritorio como una app de verdad
(PWA), sin tienda ni nube: el gasto se anota donde ocurre.

- [ ] **PWA instalable** (P1): manifiesto e iconos; se abre como ventana propia. En el móvil,
  conectado a tu PC por la red de casa (con contraseña y aviso claro) o con la sincronización.
- [ ] **Interfaz en inglés** (P1): sin inglés el alcance se queda en una fracción. Textos en un
  archivo por idioma; el español sigue siendo el principal.
- [ ] **Copias automáticas programadas** (P1): una al día en la carpeta que elijas, guardando 30.
- [ ] Paleta de comandos y apunte en lenguaje natural ("32 cena revolut ayer") (P2).
- [ ] "Cierre de mes": 4-5 tarjetas al empezar un mes nuevo con lo más llamativo del anterior (P3).
- [ ] Publicar en winget y plantillas de una línea para servidores caseros (P2; con el .exe
  firmado).

## v2.0: Conectada

**La innovación:** preguntar "¿cuánto gasté en México este año?" a Claude (u otro asistente) y que
responda con tus datos, que siguen en tu equipo.

Antes de vender nada: **decidir la licencia** (GPL-3.0 choca con la App Store; Rodrigo tiene
todos los derechos, así que puede ofrecer doble licencia si nadie más contribuye sin acuerdo).

- [ ] **Servidor MCP de solo lectura** (resumen del mes, buscar movimientos, convertir) para usar
  la app desde Claude Desktop. Reutiliza services/ tal cual; sin red ni contraseñas nuevas.
- [ ] **IA con clave propia del usuario:** sugerir categoría solo de lo que el historial no
  resuelve al importar (sin importes ni datos personales); leer tickets después.
- [ ] **Sincronización cifrada** del archivo completo en la nube del usuario (iCloud/Drive).
- [ ] **Bancos de España con clave propia** (Enable Banking, gratis para tus propias cuentas;
  opción avanzada). En México no hay vía para particulares: allí se sigue importando.

## Por ahora no

Nube multiusuario (RGPD, `usuario_id` en todo, PostgreSQL, 2FA), conexión bancaria como
producto (licencia PSD2), app nativa o Capacitor (duplicar la lógica de divisas), chat de IA
genérico (MCP da lo mismo con menos), importes en céntimos o Alembic "por si acaso".

---

## Ideas sin clasificar

- (añadir aquí)
