# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con
[SemVer](https://semver.org/lang/es/).

## [1.3.0] - 2026-10-23

### Añadido
- Estilo personalizado: elige tu propio tono e intensidad de color en Ajustes → Apariencia,
  con vista previa en claro y oscuro.
- Monedas de Latinoamérica: peso colombiano (COP), argentino (ARS) y chileno (CLP), y sol
  peruano (PEN). Se activan en Ajustes → Monedas; las que no tienen tasas oficiales de días
  pasados lo indican («sin histórico») y usan la tasa guardada más cercana.
- Copia automática de la base de datos antes de actualizar su estructura
  (`finance.antes-de-migrar-AAAA-MM-DD.db`).
- Guía de cómo funciona la app por dentro (docs/como-funciona.md).

### Cambiado
- Si el servicio de tasas deja de publicar una moneda, se guardan las demás en vez de ninguna.
- Totales en varias monedas: si falta la tasa de alguna, se avisa («≈») en vez de sumarla como 0.
- Porcentajes con el formato de tu región y el euro como «€» cuando no es la moneda principal.
- Ventanas: el foco entra al abrirlas y no se escapa; al borrar, el foco empieza en «Cancelar».
- Docker: hora de España por defecto (`-e TZ=...` para otra zona) y sin registro de accesos.
- Un doble clic al pagar una suscripción, cobrar un ingreso fijo u omitirlo ya no lo anota dos
  veces.

### Arreglado
- Las transferencias entre monedas anotadas sin la tasa de su día se corrigen solas cuando
  llega la tasa oficial (solo el lado estimado: lo que dijo el banco no se toca).
- Una importación que fallaba podía dejar a medias una transferencia ya completada.
- Un extracto manipulado con miles de columnas podía colgar la app.
- Índices que faltaban en bases de datos actualizadas desde versiones antiguas.
- Ya no se puede cambiar la moneda de una cuenta con deudas (mezclaría dos divisas).
- Al importar, el mismo movimiento ya no se puede unir dos veces (contaría doble).
- Una pestaña abierta de una versión anterior ya no se queda rota tras actualizar.

## [1.2.0] - 2026-10-23

### Añadido
- Coste real de cada envío entre monedas: lo que no llegó frente a la tasa del BCE de ese día
  más la comisión ("Te costó 80 $ (4 %)"), y un widget con el total del año.
- Poder adquisitivo: cuánto rinde lo que cobras en una moneda al gastarlo en otra, este mes
  frente a la media de 12 meses. Las monedas se detectan solas.
- Reglas de categoría para importar ("si contiene MERCADONA, es Supermercado"), en Categorías.
- Al importar, los cambios de divisa entre cuentas propias ("To MXN") se guardan como
  transferencias y no como ingresos. El extracto de la otra cuenta completa esas
  transferencias en vez de duplicarlas, y un ingreso o gasto suelto con el mismo importe en
  otra cuenta tuya se puede unir a ellas.
- Repetir los presupuestos del último mes con un toque.
- Bienvenida con un paso opcional para el sueldo y un recorrido con globos de texto por el menú.
- Gasto en dos toques (importe y categoría), varios seguidos con «Deshacer».

### Cambiado
- Selector de mes con botón "Hoy" y cuadrícula para saltar a cualquier mes y año.
- La revisión de la importación muestra el progreso, una ✓ por fila y "Dar por buenas las
  sugerencias"; cada cuenta recuerda si se invirtieron los signos.
- Avisos y confirmaciones propios de la app en lugar de las ventanas del navegador.
- En Cuentas, la flecha para plegar las subcuentas pasa a la izquierda del nombre.

### Arreglado
- Extractos de Revolut México (fecha de la compra, comisión aparte) y .xls antiguos de
  Santander España, probados con archivos reales.

## [1.1.0] - 2026-10-23

### Añadido
- Importar extractos del banco en CSV o Excel (.xlsx) sin configurar columnas: detecta
  duplicados y aprende la categoría de cada concepto.
- Ingresos fijos (sueldo, rentas) con calendario flexible, junto a las suscripciones en
  "Pagos fijos".
- Efectivo como pestaña de Cuentas, con subcuentas que se pliegan.
- Deudas (quién te debe y a quién debes), lista de deseos y campana de avisos.
- Copia de seguridad y exportación: descarga la base de datos o tus movimientos en CSV desde
  Ajustes → Seguridad y datos.
- Tasas históricas del BCE para fechas pasadas, con recálculo de lo ya guardado.
- Apariencia: 5 estilos visuales (cada uno con versión clara y oscura) con vista previa, 12
  colores de acento y un fundido suave al cambiarlos.
- Ver la contraseña al escribirla, selector de fecha, bienvenida y consejos de uso.

### Cambiado
- Menú más corto: Metas agrupa la lista de deseos; Pagos fijos agrupa suscripciones e ingresos.
  Las direcciones antiguas siguen funcionando.
- Ajustes en pestañas: Perfil, Apariencia, Monedas y Seguridad y datos.
- Navegación más fluida: las páginas se descargan en segundo plano y, al volver a una, se
  muestran al instante los últimos datos mientras se actualizan.
- El patrimonio se calcula unas 40 veces más rápido con muchos movimientos.

### Seguridad
- Importación con límite real de 1 MB y freno a archivos comprimidos maliciosos ("bombas ZIP").
- En el CSV exportado, las celdas que empiezan por `=`, `+`, `-` o `@` no se ejecutan como
  fórmulas al abrirlo en Excel.
- Release: cada paso de GitHub Actions tiene solo los permisos que necesita y las acciones van
  fijadas por su huella (SHA).

## [1.0.0] - 2026-10-19

Primera versión pública.

### Añadido
- Transacciones con búsqueda sin tildes, filtros guardados en la URL y paginación.
- Cuentas de efectivo, débito, crédito (corte, pago y límite) y con rendimientos diarios.
- Transferencias entre cuentas y monedas con tipo de cambio real y comisión; pago de tarjeta.
- Multidivisa (MXN, USD, EUR, GTQ, HNL) con tasas históricas automáticas y manuales.
- Metas de ahorro (por cuenta o por aportaciones) con ahorro mensual sugerido y celebraciones.
- Presupuestos, suscripciones y categorías personalizables.
- Panel de widgets reordenable con gráficas de patrimonio, flujo, categorías y calendario de gastos.
- Estilo oscuro tipo fintech, modo claro, color de acento, foto de perfil y mes financiero.
- Ejecutables para Windows y Linux, e imagen Docker.

### Seguridad
- Servidor solo en `127.0.0.1`, validación de `Host` y `Origin`, CSP estricta y cabeceras de
  seguridad, límite de tamaño de peticiones y bloqueos crecientes de contraseña.
- Datos en la carpeta del usuario con permisos privados.
- Dependencias sin vulnerabilidades conocidas en el momento de publicar (pip-audit, npm audit).
  Aviso moderado conocido de react-router 6 (redirección con rutas controladas por un atacante y
  SSR): no aplica a esta app; se resolverá al migrar a react-router 7.
