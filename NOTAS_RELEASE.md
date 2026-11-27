**ORVYN** es una app de finanzas personales para quien vive entre dos monedas: cada movimiento
guarda su valor en la moneda de la cuenta y en la tuya con la tasa de su día. Funciona en tu
ordenador y tus datos no salen de tu equipo.

## Novedades de la 1.4: remesas

- **¿Buen momento para cambiar?** La tasa de hoy frente a su media de 90 días, con un aviso en
  la campana cuando tu dinero rinde más de lo normal.
- **¿Por dónde te sale más barato?** Con tus envíos pasados, cuánto te costó cada vía
  (transferir, sacar efectivo y depositarlo…) frente a la tasa oficial.
- **Plan del mes:** lo que entra, lo comprometido en fijos y presupuestos y lo que te queda de
  verdad. Los cobros fijos se reconocen al anotarlos o importarlos, para no contarlos dos veces.
- **Tu saldo cuadra:** ajusta una cuenta a lo que dice el banco sin inventar gastos.
- **Dashboard a tu medida:** elige el periodo (de 3 días a un año) y añade widgets nuevos.
- **Edición en lote:** cambia la cuenta o la categoría de muchas transacciones de una vez.
- **Nueva imagen, ORVYN:** negro puro, acento Saffron y animaciones más fluidas.

Si ya usabas una versión anterior, tus datos se conservan: la base de datos se actualiza sola al
abrir la app. Aun así, haz una copia (Ajustes → Seguridad y datos) antes de actualizar.

## Descarga

| Sistema | Archivo | Cómo abrirla |
| --- | --- | --- |
| Windows | `AppFinanzas-…-windows.exe` | Doble clic. Si aparece "Windows protegió su PC": **Más información → Ejecutar de todas formas** (el ejecutable no está firmado). Si «Control de aplicaciones inteligentes» lo bloquea, usa Docker. |
| Linux | `AppFinanzas-…-linux` | `chmod +x` y ejecutar. |
| Docker | `ghcr.io/rodknight22/appfinanzas` | `docker run -d -p 127.0.0.1:8000:8000 -v finanzas:/data ghcr.io/rodknight22/appfinanzas:latest` |

Se abre una ventana de consola (esa ventana es la app: ciérrala para detenerla) y tu navegador.
Comprueba la descarga con `SHA256SUMS.txt`.

Instrucciones completas, copias de seguridad, privacidad y cómo desinstalar: ver el
[README](https://github.com/RODknight22/appFinanzas#readme). Todos los cambios: [CHANGELOG](https://github.com/RODknight22/appFinanzas/blob/main/CHANGELOG.md).
