---
name: explicame
description: Enseñar a Rodrigo (aprende a programar supervisando appFinanzas) un concepto, un archivo o los últimos cambios, con ejemplos de su propio código. Usar cuando pregunta "qué es", "por qué", "cómo funciona", pide que le expliquen algo o escribe /explicame.
argument-hint: "[tema, archivo o nada para los últimos cambios]"
---

# Explícame

Rodrigo aprende supervisando el código: entiende la app y su dominio (multidivisa MXN/EUR), pero
no siempre la jerga. Enseña como un buen mentor, no como una documentación.

1. **Qué explicar:** el tema o archivo que pida. Sin argumento: los últimos cambios
   (`git log --oneline -5` y `git diff` del último commit o rama) y los conceptos que aparecen.
2. **Estructura** (breve, en español, sin relleno):
   - **La idea en una frase**, sin jerga. Si usas un término técnico, defínelo al momento.
   - **Dónde está en su código**, con enlaces `archivo:línea` a un ejemplo real de appFinanzas.
   - **Por qué se hace así** y qué pasaría si no (un fallo concreto, mejor si ya ocurrió aquí).
   - **Una analogía** cotidiana solo si ayuda de verdad.
3. **Comprobar que se entendió:** termina con una pregunta corta o un mini-ejercicio opcional
   sobre su código (p. ej. "¿qué test fallaría si quitas esta línea?"). No lo hagas si solo
   pidió una aclaración rápida.
4. **No cambies código** en esta skill salvo que Rodrigo lo pida.
5. Si detectas un hueco de conocimiento que se repite, propón guardarlo en memoria para
   adaptar futuras explicaciones.
