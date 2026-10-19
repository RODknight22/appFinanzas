// Aplica tema y color de acento antes de pintar, para evitar un destello.
// Va en un archivo aparte (no dentro de index.html) porque la política de
// seguridad (CSP) prohíbe cualquier script embebido en la página.
try {
  const guardado = localStorage.getItem("tema");
  // Sin elección guardada, oscuro: es el estilo principal de la app.
  const oscuro = guardado ? guardado === "oscuro" : true;
  document.documentElement.classList.toggle("dark", oscuro);
  const acento = localStorage.getItem("acento");
  if (acento) document.documentElement.dataset.acento = acento;
} catch {}
