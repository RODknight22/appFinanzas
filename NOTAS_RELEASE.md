**Finanzas Personales** es una app de finanzas que funciona en tu ordenador, con varias monedas,
metas de ahorro y un panel personalizable. Tus datos no salen de tu equipo.

## Novedades de la 1.1

- **Importar extractos** del banco en CSV o Excel, sin configurar nada y sin duplicados.
- **Ingresos fijos, efectivo, deudas y lista de deseos**, con avisos en la campana.
- **Copia de seguridad** de un clic y exportación de movimientos a CSV (Ajustes → Seguridad y
  datos).
- **5 estilos visuales** con versión clara y oscura, y 12 colores de acento.
- Menú más corto, Ajustes en pestañas y navegación más fluida.

Si ya usabas la 1.0, tus datos se conservan: la base de datos se actualiza sola al abrir la app.
Aun así, haz una copia de la carpeta de datos antes de actualizar.

## Descarga

| Sistema | Archivo | Cómo abrirla |
| --- | --- | --- |
| Windows | `AppFinanzas-…-windows.exe` | Doble clic. Si aparece "Windows protegió su PC": **Más información → Ejecutar de todas formas** (el ejecutable no está firmado). |
| Linux | `AppFinanzas-…-linux` | `chmod +x` y ejecutar. |
| Docker | `ghcr.io/rodknight22/appfinanzas` | `docker run -d -p 127.0.0.1:8000:8000 -v finanzas:/data ghcr.io/rodknight22/appfinanzas:latest` |

Se abre una ventana de consola (esa ventana es la app: ciérrala para detenerla) y tu navegador.
Comprueba la descarga con `SHA256SUMS.txt`.

Instrucciones completas, copias de seguridad y privacidad: ver el
[README](https://github.com/RODknight22/appFinanzas#readme). Todos los cambios: [CHANGELOG](https://github.com/RODknight22/appFinanzas/blob/main/CHANGELOG.md).
