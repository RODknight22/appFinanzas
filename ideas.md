# Ideas y lluvia de ideas

Cuaderno de Rodrigo para apuntar lo que se le ocurra de la app, sin orden ni filtro.
Cuando diga "revisa las ideas", Claude lo lee, pregunta, propone y va tachando.
Lo que madure pasa a `docs/hoja-de-ruta.md` (en `main`) con su versión.

## Dónde vive

En la rama **`ideas`**, que solo tiene este archivo (nada de código) y nunca se fusiona con
`main`. Es un buzón compartido: tú escribes desde la laptop o desde GitHub y Claude lo recoge.

- **Desde GitHub (web o móvil):** abre el repo, elige la rama `ideas`, abre `ideas.md`,
  pulsa el lápiz ✏️ y "Commit changes". Lo más rápido.
- **Desde la laptop**, en una carpeta aparte para no tocar el código que pruebas
  (solo la primera vez):
  `git fetch origin ideas && git worktree add ../appFinanzas-ideas ideas`.
  Después, en `appFinanzas-ideas/`: `git pull`, editas, `git commit -am "ideas: ..."` y `git push`.
- **Claude** hace `git pull` en su carpeta `appFinanzas-ideas`, responde y hace push.
  Antes de escribir tú, haz `git pull` para traer sus respuestas.

## Cómo se usa

- **Escribe rápido en la Bandeja de entrada.** Una línea basta. No hace falta clasificar.
- Estados (al principio de cada línea):
  - `- [ ]` pendiente · `- [x] ~~idea~~ → hecho (PR #12)` · `- [-] ~~idea~~ → descartada: por qué`
  - `- [>] idea → hoja de ruta v1.2`: ya es una tarea planificada.
  - `- [~] idea → PR #7`: programada, falta que revises y fusiones la PR.
- Etiquetas opcionales al final: `#funcion` `#fix` `#mejora` `#concepto` `#aprender` `#duda`.
  Prioridad si la sabes: `!alta` `!baja`.
- Conversación debajo de cada idea, con sangría:
  - `💬 Claude:` preguntas, propuestas, riesgos o ideas parecidas.
  - `🗣️ Rodrigo:` tu respuesta. Cuando esté clara, Claude actualiza la idea o la mueve.

Ejemplo:

```markdown
- [ ] Ver cuánto gasto en café al mes #funcion !baja
  - 💬 Claude: ¿solo café o cualquier "etiqueta"? Las etiquetas ya están en la v1.3.
  - 🗣️ Rodrigo: cualquier etiqueta, vale.
```

---

## 📥 Bandeja de entrada

<!-- Vacía: Claude movió tus ideas a su sección. Sigue escribiendo aquí. -->

- [ ] Cambiar lo de desplegar de las cuentas a la izquierda para mayor comodidad

- [ ] Me gusta, pero la parte del tutorial donde te dice donde esta cada cosa estaria mejor que te la explicara con glovos de texto y la parte de los "desafios" haz que si ellos abren la cuenta, ponen una meta, etc se marque sola como completada. Tambien me gustaria que la parte de donde metes la transacciones cuando las importas, tengan un boton de aceptarlas mas rapido ya que los estados de cuenta podrian tener muchas transacciones y estar picando y bajando es tedioso, igual no se si haya alguna foma de darle una categoria por defecto sin que el usuario la tenga que elegir forzosamente o sea que el programa identifique en que categoria entra "Solo si es posible"

## ✨ Funciones nuevas

<!-- Cosas que la app aún no hace. -->

- [>] Selector de mes más ágil en Dashboard y Transacciones: volver al mes actual fácil y
  saltar a meses lejanos #funcion → hoja de ruta v1.2
  - 💬 Claude: propuesta: botón "Hoy" que aparece cuando no estás en el mes actual, y al pulsar
    el nombre del mes, una cuadrícula con los 12 meses y flechas para cambiar de año.
  - 🗣️ Rodrigo: Me parece tu idea
- [>] Bienvenida al día: explicar lo nuevo, rápida y entretenida, para meter los datos básicos
  #funcion → hoja de ruta v1.2
  - 💬 Claude: ¿qué datos básicos son imprescindibles para ti? Propongo: moneda principal,
    primera cuenta con su saldo y, opcional, el sueldo como ingreso fijo. Con eso el panel ya
    tiene sentido desde el primer minuto.
  - 🗣️ Rodrigo: Perfecto, pero puedes añadir una especie de tutorial que explique todos los apartados pero no quiero que sea tedioso ni aburrido

## 🐛 Arreglos (fixes)

<!-- Algo que falla o se comporta raro: qué hiciste, qué esperabas y qué pasó. -->

## 🎨 Mejoras y pulido

<!-- Algo que ya existe pero podría ser más cómodo, rápido o bonito. -->

- [x] ~~Botón para desplegar y plegar las subcuentas~~ #mejora → hecho (PR #7)
  - 💬 Claude: hecho. Flecha en la cuenta madre; plegada muestra cuántas oculta ("2 ›").
    Por defecto se ven desplegadas y el navegador recuerda cuáles plegaste.
- [x] ~~Metas y Deseos, Suscripciones e Ingresos fijos en un mismo apartado con pestañas,
  como Cuentas | Efectivo~~ #mejora → hecho (PR #8)
  - 💬 Claude: hecho. Menú: "Metas" (Metas | Deseos) y "Pagos fijos"
    (Suscripciones | Ingresos fijos). El menú pasa de 10 a 8 entradas. Las direcciones
    viejas (/deseos, /suscripciones, /ingresos) siguen funcionando.
- [>] Ordenar Ajustes y hacerlo más bonito #mejora → hoja de ruta v1.1 (tarea 1 del plan)
  - 💬 Claude: con pestañas, como elegiste. Va después de fusionar la PR #8, porque reutiliza
    su componente de pestañas. Propuesta de grupos:
    - **Perfil:** foto y nombre, preferencias (página de inicio, mes), recordatorios.
    - **Apariencia:** tema y color.
    - **Monedas:** monedas activas y tasas de cambio.
    - **Seguridad y datos:** contraseña y copia de seguridad.
  - 💬 Claude: ¿te cuadra así o moverías algo? Si no contestas, lo hago tal cual.
  - 🗣️ Rodrigo:
  - 💬 Claude (23/10): sin respuesta, así que va con estos grupos. Si quieres mover algo,
    escríbelo aquí antes de que empiece la tarea.
- [>] Mejorar la pestaña de personalización: no gustan los iconos de los estilos ni la
  descripción del primero #mejora → v1.1, dentro de la tarea de Ajustes
  - 💬 Claude: ¿qué te gustaría en lugar de los iconos? Opciones: una mini vista previa de los
    colores de cada estilo (recomendada: se ve el resultado antes de elegir), un icono distinto
    o nada. Y de la descripción del primero, ¿qué no te gustó, el texto o el tono?
  - 🗣️ Rodrigo:
- [>] Widgets más personalizables: tamaños, cómo muestran los datos y widgets nuevos
  #mejora → hoja de ruta v1.3
  - 💬 Claude: es grande, así que va después de publicar. Cuando llegue, dime qué widgets
    echas de menos y qué datos quieres ver distinto.

## 🧭 Siguientes pasos

<!-- Lo que quieres atacar pronto, en el orden en que te apetece. -->

- [x] ~~Desarrollo con BD propia (data-dev/) y defensas en el puerto 8000~~ → hecho (PR #6)
  - 💬 Claude: de la hoja de ruta v1.1. Tras fusionarla, `docker compose` arranca con la app
    vacía: si quieres tus datos de prueba, copia data/finance.db a data-dev/ con la app parada.
- [x] ~~CI completo: E2E y linters (ruff, eslint) en GitHub~~ → hecho (PR #9)
- [x] ~~Release más seguro~~ → hecho (PR #11)
- [ ] Terminar la v1.1: Ajustes con pestañas → publicar v1.1.0 → probar el release en la
  laptop. El plan completo está en docs/hoja-de-ruta.md (PR #14).

## 💭 Conceptos e ideas abstractas

<!-- Ideas grandes o difusas: "¿y si la app...?", modelos de negocio, visión a largo plazo. -->

## 🎓 Para aprender

<!-- Conceptos de programación que quieres entender (para /explicame). -->

## ❓ Preguntas abiertas

<!-- Dudas tuyas o de Claude que bloquean alguna idea. -->

---

## 📦 Archivo

<!-- Lo hecho, lo descartado y lo pasado a la hoja de ruta. Se mueve aquí para no perder el porqué. -->
