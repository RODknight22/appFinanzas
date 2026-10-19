Primera versión pública de **Finanzas Personales**: una app de finanzas que funciona en tu
ordenador, con varias monedas, metas de ahorro y un panel personalizable. Tus datos no salen de tu
equipo.

## Descarga

| Sistema | Archivo | Cómo abrirla |
| --- | --- | --- |
| Windows | `AppFinanzas-…-windows.exe` | Doble clic. Si aparece "Windows protegió su PC": **Más información → Ejecutar de todas formas** (el ejecutable no está firmado). |
| Linux | `AppFinanzas-…-linux` | `chmod +x` y ejecutar. |
| Docker | `ghcr.io/rodknight22/appfinanzas` | `docker run -d -p 127.0.0.1:8000:8000 -v finanzas:/data ghcr.io/rodknight22/appfinanzas:latest` |

Se abre una ventana de consola (esa ventana es la app: ciérrala para detenerla) y tu navegador.
Comprueba la descarga con `SHA256SUMS.txt`.

Instrucciones completas, copias de seguridad y privacidad: ver el
[README](https://github.com/RODknight22/appFinanzas#readme). Novedades: [CHANGELOG](https://github.com/RODknight22/appFinanzas/blob/main/CHANGELOG.md).
