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

## ✨ Funciones nuevas

<!-- Cosas que la app aún no hace. -->

- [x] ~~Selector de mes más ágil en Dashboard y Transacciones: volver al mes actual fácil y
  saltar a meses lejanos~~ #funcion → hecho (PR #19)
  - 💬 Claude: propuesta: botón "Hoy" que aparece cuando no estás en el mes actual, y al pulsar
    el nombre del mes, una cuadrícula con los 12 meses y flechas para cambiar de año.
  - 🗣️ Rodrigo: Me parece tu idea
- [x] ~~Bienvenida al día: explicar lo nuevo, rápida y entretenida, para meter los datos básicos~~
  #funcion → hecho (PR #20)
  - 💬 Claude: ¿qué datos básicos son imprescindibles para ti? Propongo: moneda principal,
    primera cuenta con su saldo y, opcional, el sueldo como ingreso fijo. Con eso el panel ya
    tiene sentido desde el primer minuto.
  - 🗣️ Rodrigo: Perfecto, pero puedes añadir una especie de tutorial que explique todos los apartados pero no quiero que sea tedioso ni aburrido
  - 💬 Claude (23/10): propuesta: un tutorial de globos de texto que señalan cada zona de la
    pantalla, con una frase por globo (5 o 6 en total). Se puede saltar en cualquier momento y
    se repite desde Ajustes. Va en la v1.2 junto a la bienvenida.
  - 💬 Claude (23/10): hecho en la PR #20. Al final quedaron 9 globos, uno por apartado del
    menú, para que estén todos; cada uno es una frase y se avanza con Intro. Además hay un paso
    opcional para apuntar el sueldo.

## 🐛 Arreglos (fixes)

<!-- Algo que falla o se comporta raro: qué hiciste, qué esperabas y qué pasó. -->

## 🎨 Mejoras y pulido

<!-- Algo que ya existe pero podría ser más cómodo, rápido o bonito. -->

- [ ] Mover la flecha de desplegar/plegar las subcuentas a la izquierda, para más comodidad
  #mejora
  - 💬 Claude (23/10): ¿te refieres a la flecha que está a la derecha del nombre de la cuenta?
    Propongo ponerla a la izquierda, antes del nombre. ¿Te cuadra?
  - 🗣️ Rodrigo:
- [ ] Primeros pasos: que se tachen solos al abrir una cuenta, poner una meta, etc. #fix
  - 💬 Claude (23/10): el código ya los tacha solos (cuenta, movimiento, presupuesto y meta).
    Si alguno no se tachó, dime cuál y qué hiciste. Puede que la tarjeta solo se actualice al
    recargar la página, y eso lo arreglamos.
  - 🗣️ Rodrigo:
- [x] ~~Aceptar los movimientos importados más rápido, con una categoría por defecto~~ #mejora
  → hecho (PR #18; llega en la v1.2)
  - 💬 Claude (23/10): esto lo hizo otra sesión una hora antes de que lo escribieras: ✓ en
    cada fila para aceptar su sugerencia, "Dar por buenas las sugerencias" para todas a la vez
    (las que no tienen categoría clara se quedan en "Otros") y una barra "Revisa N de M". La
    categoría ya se adivina sola por el historial. Si probaste el .exe de la v1.1.0, no lo
    viste: pruébalo con `docker compose` y dime si sigue siendo pesado.
  - 🗣️ Rodrigo:

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
  - 💬 Claude (23/10): entra en la v1.3 (tarea 5). Para diseñarlo necesito tres cosas:
    1. ¿Qué widgets echas de menos? Ideas: gasto por cuenta, comparar este mes con el anterior,
       próximo cobro destacado, top 5 comercios del mes, ahorro del año.
    2. ¿Qué quieres ver distinto en los que ya hay? (p. ej. categorías en barras en vez de
       dona, el calendario por semanas…)
    3. ¿Qué tamaños te faltan? Hoy hay pequeño, mediano y ancho.
  - 🗣️ Rodrigo:

## 🧭 Siguientes pasos

<!-- Lo que quieres atacar pronto, en el orden en que te apetece. -->

- [x] ~~Desarrollo con BD propia (data-dev/) y defensas en el puerto 8000~~ → hecho (PR #6)
  - 💬 Claude: de la hoja de ruta v1.1. Tras fusionarla, `docker compose` arranca con la app
    vacía: si quieres tus datos de prueba, copia data/finance.db a data-dev/ con la app parada.
- [x] ~~CI completo: E2E y linters (ruff, eslint) en GitHub~~ → hecho (PR #9)
- [x] ~~Release más seguro~~ → hecho (PR #11)
- [x] ~~Terminar la v1.1 y la v1.2~~ → publicadas (v1.1.0 y v1.2.0, 23/10)
- [ ] v1.3: react-router 7 → monedas de Latinoamérica, estilo personalizado y widgets (en
  paralelo) → recalcular transferencias → firmar el .exe → publicar. Plan en
  docs/hoja-de-ruta.md. Tu parte: ideas de widgets (arriba) y elegir el certificado de firma.

## 💭 Conceptos e ideas abstractas

- [ ] Conexión con Drive y con asistentes (Claude, ChatGPT, Gemini…) mediante un servidor MCP
  #concepto
  - 💬 Claude (23/10): buena idea y encaja: un servidor MCP dejaría que un asistente consulte tus
    finanzas ("¿cuánto gasté en restaurantes este mes?"). Es grande y toca la privacidad (hoy
    nada sale de tu ordenador), así que la propongo para después de la v1.3. Dos preguntas:
    1. ¿Para qué la quieres? ¿Preguntar a un asistente, guardar copias en Drive o las dos?
    2. ¿Solo leer o también que el asistente apunte gastos por ti?
  - 🗣️ Rodrigo: Para preguntar a un asistente, guardar copias en Drive y tambien leer y que apunte gastos por mi

<!-- Ideas grandes o difusas: "¿y si la app...?", modelos de negocio, visión a largo plazo. -->

## 🎓 Para aprender

<!-- Conceptos de programación que quieres entender (para /explicame). -->

## ❓ Preguntas abiertas

<!-- Dudas tuyas o de Claude que bloquean alguna idea. -->

### Preguntas de Claude (23/10) para conocer tus gustos y a dónde llevar la app

Contesta debajo de cada una con `🗣️ Rodrigo:`. Una palabra basta; sáltate las que no tengas
claras. Con tus respuestas Claude ajusta la hoja de ruta.

**Cómo la usas**
1. ¿Cuántas veces a la semana abres la app y para qué: anotar, revisar o importar? 🗣️ Rodrigo: Solo la uso para ver como va, todavia no la implemento
2. ¿Anotas cada gasto al momento o prefieres importar el extracto cada cierto tiempo? 🗣️ Rodrigo: Al incio al momentl pero despues cada cierto tiempo yo creo
3. ¿Desde dónde querrías anotar: PC, laptop o móvil? ¿Echas de menos el móvil? 🗣️ Rodrigo: Si el monil pero tambien desde la laptop
4. ¿Qué pantalla te gusta más y cuál menos? ¿Por qué? 🗣️ Rodrigo: El Dashboard a la vez me gusta y a la vez no siento que esta bloated
5. ¿Qué te da pereza hoy, algún paso que repites siempre? 🗣️ Rodrigo: Anotar todos mis gastos y que mi salgo cuadre (Que se pueda editar el saldo actual para hacer ajustes)
6. ¿Miras las gráficas o solo los números? 🗣️ Rodrigo: Las graficas me gustan. me gusta ver la telemetria y los datos
   - 💬 Claude (23/10): gracias. Lo que cambia en el plan de la v1.4 (PR #39):
     - **Ajustar el saldo** entra como tarea nueva: escribes lo que dice el banco y la app
       apunta un "Ajuste de saldo" por la diferencia, para que el historial siga cuadrando.
     - **Dashboard recargado:** va con los widgets. Menos widgets a la vista por defecto y
       más para elegir, sin quitar gráficas.
     - **Móvil y laptop:** confirma la app instalable de la v1.5.

**Gustos**
7. ¿Claro u oscuro? ¿Qué estilo y acento usas? 🗣️ Rodrigo: Oscuros
8. ¿El tono de los textos (cercano, tuteando) te gusta o lo quieres más serio? 🗣️ Rodrigo: Me gusta como estan quiero algo serio pero calido
9. Animaciones y celebraciones (metas, "días sin gastar"): ¿más, igual o menos? 🗣️ Rodrigo: Mas igual, quiero que motiven
10. ¿Una app que le cabe a todo el mundo o muy hecha a tu medida aunque a otros les sobre? 🗣️ Rodrigo: Prefiero que les sobre y que despues puedan desactivar o quitar funciones "personalizable"

**Tu dinero entre dos monedas**
11. ¿Cómo mandas hoy dinero de MXN a EUR (Revolut, Wise, banco…) y cada cuánto?
   - 💬 Claude (23/10): esta es la que más necesito para la v1.4 ("Comparar vías de envío").
     Basta con la lista: p. ej. "Revolut casi siempre, a veces Santander, una vez al mes".
12. ¿Usarías un aviso de "buen momento para cambiar" para decidir cuándo enviar?
13. Para el peso, ¿qué tasa de referencia prefieres: BCE o Banxico (FIX)?
14. ¿Tienes inversiones o ahorro (CETES, fondos, cripto, plan de pensiones) que quieras ver?
15. ¿Compartes gastos con alguien (pareja, piso)? ¿Te serviría dividirlos?
16. ¿Qué otros bancos usas o usarás, aunque sean PDF? (para preparar sus lectores)
17. ¿Haces la declaración en México, en España o en las dos? ¿Un resumen anual por país?

**El futuro**
18. Dentro de un año, ¿para quién es la app: solo tú, tu familia y amigos, o cualquiera?
19. Recomiendo seguir con el código abierto público. ¿Qué te preocupa de que sea público?
20. ¿Quieres ganar algo de dinero con ella o es aprendizaje y portafolio?
   - 💬 Claude (23/10): importa para la firma del .exe. SignPath es gratis pero exige no
     vender la app con otra licencia (doble licencia). Si algún día quieres venderla, habría
     que pagar un certificado propio. Para firmar ahora: ¿te vale seguir solo con código abierto?
21. ¿Hacemos la interfaz en inglés (v1.5) o no te importa?
22. Móvil: ¿app instalada conectada a tu PC de casa, o copia cifrada en tu Drive?
23. ¿Conectar el banco automáticamente (solo España, con tu clave) o te basta importar?
24. Si pudieras preguntarle a Claude por tus finanzas (v2.0), ¿qué le preguntarías?
25. ¿Cuántas horas a la semana quieres dedicarle? ¿Fecha que te gustaría para la v1.3?

**Aprender y trabajar juntos**
26. ¿Qué quieres aprender: leer código, escribir cosas pequeñas tú, arquitectura, git?
27. ¿Te sirvió docs/como-funciona.md? ¿Qué parte no entendiste?
28. ¿Quieres más o menos explicaciones mientras trabajo?
29. ¿Te va bien tener 2-3 sesiones a la vez o te satura revisar tantas PR?
30. ¿Me dejas fusionar yo las PR de solo documentación con el CI en verde, o siempre tú?

**Lo que a mí (Claude) me gustaría dejar en tu app** (¿sí, no, más adelante?)
31. **Un "¿de dónde sale?" en cada número:** tocar un total y ver cómo se calculó (qué
    movimientos, qué tasa y de qué día). Da confianza y, de paso, enseña cómo funciona por dentro.
32. **Una nota del mes en palabras**, sin IA ni internet, con plantillas: "gastaste un 12 % menos en
    restaurantes; el envío de marzo te costó 40 $ menos que el de febrero".
33. **Las promesas de la app** en un documento (tus datos no salen de tu equipo, nada se pierde a
    medias, cada importe con la tasa de su día…) y un test que vigile cada una.
34. **Una página de créditos** con la historia: hecha por Rodrigo, que aprendió a programar
    haciéndola, con ayuda de Claude.

---

## 📦 Archivo

<!-- Lo hecho, lo descartado y lo pasado a la hoja de ruta. Se mueve aquí para no perder el porqué. -->
