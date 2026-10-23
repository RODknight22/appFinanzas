**Finanzas Personales** es una app de finanzas que funciona en tu ordenador, con varias monedas,
metas de ahorro y un panel personalizable. Tus datos no salen de tu equipo.

## Novedades de la 1.3: pulido y confianza

- **Nada se pierde ni queda a medias:** si una importación falla, no se guarda nada; antes de
  actualizar la base de datos se hace una copia automática junto a ella.
- **Más monedas:** pesos colombiano, argentino y chileno y sol peruano (actívalas en Ajustes →
  Monedas).
- **Tus colores:** un estilo personalizado con tu propio tono e intensidad.
- **Envíos corregidos solos:** una transferencia entre monedas anotada sin la tasa de su día se
  corrige cuando llega la tasa oficial.
- **Más pulida:** totales que avisan si falta una tasa, ventanas más cómodas con el teclado,
  porcentajes y euros con el formato de tu región, y sin pagos dobles por un doble clic.

Si ya usabas una versión anterior, tus datos se conservan: la base de datos se actualiza sola al
abrir la app. Aun así, haz una copia (Ajustes → Seguridad y datos) antes de actualizar.

## Descarga

| Sistema | Archivo | Cómo abrirla |
| --- | --- | --- |
| Windows | `AppFinanzas-…-windows.exe` | Doble clic. Si aparece "Windows protegió su PC": **Más información → Ejecutar de todas formas** (el ejecutable no está firmado). Si «Control de aplicaciones inteligentes» lo bloquea, usa Docker: la versión firmada llega en la 1.4. |
| Linux | `AppFinanzas-…-linux` | `chmod +x` y ejecutar. |
| Docker | `ghcr.io/rodknight22/appfinanzas` | `docker run -d -p 127.0.0.1:8000:8000 -v finanzas:/data ghcr.io/rodknight22/appfinanzas:latest` |

Se abre una ventana de consola (esa ventana es la app: ciérrala para detenerla) y tu navegador.
Comprueba la descarga con `SHA256SUMS.txt`.

Instrucciones completas, copias de seguridad y privacidad: ver el
[README](https://github.com/RODknight22/appFinanzas#readme). Todos los cambios: [CHANGELOG](https://github.com/RODknight22/appFinanzas/blob/main/CHANGELOG.md).
