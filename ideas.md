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

- [ ]

## ✨ Funciones nuevas

<!-- Cosas que la app aún no hace. -->

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
- [ ] Ordenar Ajustes y hacerlo más bonito #mejora
  - 💬 Claude: con pestañas, como elegiste. Va después de fusionar la PR #8, porque reutiliza
    su componente de pestañas. Propuesta de grupos:
    - **Perfil:** foto y nombre, preferencias (página de inicio, mes), recordatorios.
    - **Apariencia:** tema y color.
    - **Monedas:** monedas activas y tasas de cambio.
    - **Seguridad y datos:** contraseña y copia de seguridad.
  - 💬 Claude: ¿te cuadra así o moverías algo? Si no contestas, lo hago tal cual.
  - 🗣️ Rodrigo:

## 🧭 Siguientes pasos

<!-- Lo que quieres atacar pronto, en el orden en que te apetece. -->

- [x] ~~Desarrollo con BD propia (data-dev/) y defensas en el puerto 8000~~ → hecho (PR #6)
  - 💬 Claude: de la hoja de ruta v1.1. Tras fusionarla, `docker compose` arranca con la app
    vacía: si quieres tus datos de prueba, copia data/finance.db a data-dev/ con la app parada.
- [~] CI completo: E2E y linters (ruff, eslint) en GitHub → PR #9
- [ ] Lo que queda de v1.1: release más seguro y publicar la v1.1.0.
- [ ] Ajustes con pestañas: espera a que se fusione la sesión de apariencia (tocan lo mismo).

## 💭 Conceptos e ideas abstractas

<!-- Ideas grandes o difusas: "¿y si la app...?", modelos de negocio, visión a largo plazo. -->

## 🎓 Para aprender

<!-- Conceptos de programación que quieres entender (para /explicame). -->

## ❓ Preguntas abiertas

<!-- Dudas tuyas o de Claude que bloquean alguna idea. -->

---

## 📦 Archivo

<!-- Lo hecho, lo descartado y lo pasado a la hoja de ruta. Se mueve aquí para no perder el porqué. -->
