**Finanzas Personales** es una app de finanzas que funciona en tu ordenador, con varias monedas,
metas de ahorro y un panel personalizable. Tus datos no salen de tu equipo.

## Novedades de la 1.2: multidivisa a fondo

- **Cuánto te cuesta cada envío** entre monedas frente a la tasa del BCE, y el total del año.
- **Poder adquisitivo:** cuánto rinden tus pesos en euros (o al revés) frente a la media de 12
  meses.
- **Importar extractos mejor:** reglas de categoría, los cambios entre tus cuentas cuentan como
  transferencias y los dos extractos de un mismo cambio no se duplican.
- **Más rápido de usar:** gasto en dos toques, selector de mes con "Hoy", presupuestos que se
  repiten con un toque y un recorrido de bienvenida con globos.

Si ya usabas una versión anterior, tus datos se conservan: la base de datos se actualiza sola al
abrir la app. Aun así, haz una copia (Ajustes → Seguridad y datos) antes de actualizar.

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
