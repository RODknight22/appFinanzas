# Registro de cambios

Formato basado en [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/); versiones con
[SemVer](https://semver.org/lang/es/).

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
