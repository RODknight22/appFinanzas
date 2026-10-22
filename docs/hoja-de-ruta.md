# Hoja de ruta

Plan orientativo por versiones: se puede reordenar cuando haga falta. Cada tarea dice **por qué**,
**dónde** se toca y **cuándo está hecha**. Al fusionar una tarea en `main`, marcarla con `[x]`.
Las ideas en bruto van al cuaderno `ideas.md` de la rama `ideas`; aquí solo llegan las que ya son tarea.

Origen: auditorías de estado, seguridad, rendimiento y producto del 21-22/10/2026.

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

- [ ] **Probar la importación con extractos reales** de los bancos de Rodrigo (España y México).
  *Por qué:* los tests usan formatos inventados. *Dónde:* services/lector_extractos.py.
  *Hecho cuando:* cada banco se lee bien y tiene un test con su formato (datos inventados).
- [x] **Copia de seguridad y exportación.** Botón en Ajustes que descarga la BD y un CSV.
  *Por qué:* hoy no hay forma segura de guardar los datos. *Dónde:* nuevo services/copias.py +
  Ajustes. *Ojo:* con WAL no basta copiar el archivo: usar `VACUUM INTO` o la API de backup de
  sqlite3; en el CSV, anteponer `'` a celdas que empiecen por `= + - @` (inyección de fórmulas).
  *Hecho cuando:* restaurar la copia en una BD vacía da los mismos saldos (test).
- [x] **Desarrollo sin datos reales y con defensas.** *Por qué:* `docker compose` usa
  data/finance.db y el puerto 8000 no tiene las defensas de Host/Origin (auditoría M3).
  *Dónde:* docker-compose.yml, main.py. *Hecho cuando:* una web ajena no puede escribir en :8000.
- [ ] **CI completo:** ejecutar `scripts/verificar.sh --e2e` en GitHub Actions y añadir linters
  (ruff para Python, eslint para TS). *Dónde:* .github/workflows/ci.yml.
- [ ] **Release más seguro** (auditoría B1): permisos por trabajo y acciones fijadas por SHA.
  *Dónde:* .github/workflows/release.yml.
- [ ] **Publicar v1.1.0:** versión en backend/app/version.py y frontend/package.json, CHANGELOG.md
  y README.md al día (importación, ingresos, efectivo, deudas, deseos), tag `v1.1.0`.

## v1.2: Multidivisa a fondo (lo que distingue a la app)

- [ ] **Coste real de cada envío MXN↔EUR:** en transferencias entre monedas, comparar la tasa
  obtenida con la del BCE de ese día ("perdiste X € (Y %)") y un widget con el total del año.
  *Dónde:* services/transferencias.py (los datos ya existen), registroWidgets.tsx.
- [ ] **Poder adquisitivo:** cuántos euros rindió el ingreso en pesos este mes frente a la media
  de 12 meses. *Dónde:* dashboard + tasas históricas.
- [ ] **Más monedas** (COP, ARS, GBP, CHF…). Aditivo: el enum `Moneda` se guarda como texto.
  Revisar `_validar_tasas`, `SelectMoneda` y qué fuente da sus tasas históricas.
- [ ] **Recalcular transferencias antiguas** cuando lleguen tasas históricas (hoy solo las
  transacciones) y fuente histórica para GTQ/HNL.
- [ ] **Presupuestos repetibles** o "copiar del mes anterior". *Dónde:* services/presupuestos.py.
- [ ] **Importación más lista:** reglas editables ("contiene X → categoría Y"), recordar por
  cuenta si se invierten signos, detectar transferencias entre cuentas propias (mismo importe que
  sale de una y entra en otra), leer `.xls` si algún banco lo usa.

## v1.3: Pulido

- [ ] **Notificaciones propias en vez de `alert`/`confirm`** (useEnvio.ts, avisarError.ts,
  SeccionMonedas.tsx, CuentasPage.tsx).
- [ ] **react-router 7** (quita 2 avisos moderados de `npm audit`).
- [ ] **Inversiones y ahorro con valoración:** valor por fecha, aportado frente a valor actual.
- [ ] **Etiquetas / viajes:** agrupar gastos de varias categorías y monedas ("Viaje CDMX").
- [ ] **Limpieza:** `#64748b` repetido → constante o token; manejo de errores duplicado; atajo
  ASCII en `normalizar_texto` si la búsqueda empieza a notarse lenta (medido: 35× más rápido).
- [ ] Recordatorios por correo (`correo_recordatorios`) y seguir precios de los deseos.
- [ ] **Estilo personalizado:** elegir tinte y viveza propios (o un acento libre). *Dónde:*
  index.css ya calcula los colores de `--tinte` y `--viveza`: basta guardarlos en Configuración
  y escribirlos en el `style` de `<html>`. *Hecho cuando:* se ve igual al recargar (E2E).

## v2.0: Conectada

Antes de vender nada: **decidir la licencia** (GPL-3.0 choca con la App Store) y **firmar los
ejecutables**.

- [ ] **Servidor MCP de solo lectura** (resumen del mes, buscar movimientos, convertir) para usar
  la app desde Claude Desktop. Reutiliza services/ tal cual; sin red ni contraseñas nuevas.
- [ ] **IA con clave propia del usuario:** sugerir categoría solo de lo que el historial no
  resuelve al importar (sin importes ni datos personales); leer tickets después.
- [ ] **PWA de escritorio:** instalar la app como ventana propia desde localhost.
- [ ] **Sincronización cifrada** del archivo completo en la nube del usuario (iCloud/Drive).

## Por ahora no

Nube multiusuario (RGPD, `usuario_id` en todo, PostgreSQL, 2FA), conexión bancaria como
producto (licencia PSD2), app nativa o Capacitor (duplicar la lógica de divisas), chat de IA
genérico (MCP da lo mismo con menos), importes en céntimos o Alembic "por si acaso".

---

## Ideas sin clasificar

- (añadir aquí)
