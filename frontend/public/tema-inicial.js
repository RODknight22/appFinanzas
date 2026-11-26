// Aplica tema, estilo y color de acento antes de pintar, para evitar un destello.
// Va en un archivo aparte (no dentro de index.html) porque la política de
// seguridad (CSP) prohíbe cualquier script embebido en la página.
try {
  const guardado = localStorage.getItem("tema");
  // Sin elección guardada, oscuro: es el estilo principal de la app.
  const oscuro = guardado ? guardado === "oscuro" : true;
  document.documentElement.classList.toggle("dark", oscuro);
  // Sin elección guardada, los de la marca ORVYN (igual que el backend).
  const acento = localStorage.getItem("acento") || "saffron";
  document.documentElement.dataset.acento = acento;
  // "grafito" ya no existe: lo sustituyó Obsidian (igual que en el backend).
  const guardadoEstilo = localStorage.getItem("estilo");
  const estilo = guardadoEstilo === "grafito" ? "obsidian" : guardadoEstilo || "orvyn";
  document.documentElement.dataset.estilo = estilo;
  if (estilo === "personal") {
    // Tono e intensidad propios (la intensidad se guarda en centésimas, como en el backend).
    const tinte = Number(localStorage.getItem("tinte"));
    const viveza = Number(localStorage.getItem("viveza"));
    if (Number.isFinite(tinte) && Number.isFinite(viveza)) {
      document.documentElement.style.setProperty("--tinte", String(tinte));
      document.documentElement.style.setProperty("--viveza", String(viveza / 100));
    }
    if (localStorage.getItem("negro") === "1") document.documentElement.dataset.negro = "";
  }
} catch {}
