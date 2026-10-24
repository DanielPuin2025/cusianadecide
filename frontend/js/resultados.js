// Muestra resultados en vivo si hay internet, o el último resultado guardado si no hay
const COLORES = ["#2563eb", "#16a34a", "#f59e0b", "#dc2626", "#7c3aed", "#0891b2"];
const MEDALLAS = ["🥇", "🥈", "🥉"];

function escaparHtml(texto) {
  const mapa = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
  return String(texto ?? "").replace(/[&<>"']/g, (caracter) => mapa[caracter] || caracter);
}

function resolverRutaImagen(imagen) {
  if (!imagen) return "icons/logo.ico";

  const valor = String(imagen).trim();
  if (!valor) return "icons/logo.ico";
  if (/^(https?:)?\/\//i.test(valor)) return valor;

  const normalizada = valor.replace(/^\.\//, "").replace(/^frontend\//, "");
  if (normalizada.startsWith("icons/")) return normalizada;
  if (normalizada.startsWith("/")) return normalizada.slice(1);

  return `icons/${normalizada}`;
}

function crearImgConFallback(src, alt, className = "foto-candidato", extraOnError = "") {
  const fallback = "icons/logo.ico";
  const onError = `this.onerror=null; this.src='${fallback}'; ${extraOnError}`;
  return `<img src="${src}" alt="${alt}" class="${className}" onerror="${onError}" />`;
}

async function encabezadosAdmin(incluirContenido = false) {
  const sesion = await obtenerDeStore("sesion", "actual");
  const headers = {};
  if (sesion?.token) headers["Authorization"] = `Bearer ${sesion.token}`;
  if (incluirContenido) headers["Content-Type"] = "application/json";
  return headers;
}

document.addEventListener("DOMContentLoaded", async () => {
  const sesion = await obtenerDeStore("sesion", "actual");
  if (!sesion || sesion.rol !== "admin") {
    window.location.href = "index.html";
    return;
  }

  const botonReiniciar = document.getElementById("btnReiniciar");
  const botonesCerrarSesion = document.querySelectorAll(".btn-cerrar-sesion");
  const formCandidato = document.getElementById("formCandidato");
  const botonLimpiar = document.getElementById("btnLimpiarForm");
  const botonExportar = document.getElementById("btnExportarCandidatos");
  const botonImportar = document.getElementById("btnImportarCandidatos");
  const importarArchivo = document.getElementById("importarCandidatosArchivo");
  const botonNuevo = document.getElementById("btnNuevoCandidato");
  const imagenArchivo = document.getElementById("imagenArchivo");
  const imagenRuta = document.getElementById("imagenCandidato");
  const btnSeleccionarFoto = document.getElementById("btnSeleccionarFoto");
  const pestanas = document.querySelectorAll("[data-pestana]");
  const botonExportarVotos = document.getElementById("btnExportarVotos");
  const botonCerrarVotaciones = document.getElementById("btnCerrarVotaciones");
  const botonAbrirVotaciones = document.getElementById("btnAbrirVotaciones");
  const estadoVotacionesBadge = document.getElementById("estadoVotacionesBadge");
  const botonImportarEstudiantes = document.getElementById("btnImportarEstudiantes");
  const botonExportarEstudiantes = document.getElementById("btnExportarEstudiantes");
  const importarEstudiantesArchivo = document.getElementById("importarEstudiantesArchivo");
  const selectSede = document.getElementById("selectSede");
  const gradosContainer = document.getElementById("gradosContainer");
  const btnAplicarConfig = document.getElementById("btnAplicarConfig");
  const btnLimpiarConfig = document.getElementById("btnLimpiarConfig");
  const configResumen = document.getElementById("configResumen");
  // Candidatos tab elements
  const listaCandidatosAdmin = document.getElementById("listaCandidatosAdmin");

  botonesCerrarSesion.forEach((boton) => {
    boton.addEventListener("click", async () => {
      await eliminarDeStore("sesion", "actual");
      await eliminarDeStore("candidatos", "all");
      await eliminarDeStore("resultadosCache", "all");
      await eliminarDeStore("votosPendientes", "all");
      await eliminarDeStore("votosLocales", "all");
      window.location.href = "index.html";
    });
  });

  // Formulario candidatos
  if (formCandidato) {
    formCandidato.addEventListener("submit", guardarCandidato);
  }

      const agMensaje = document.getElementById("agMensaje");
      if (formAgregarEstudiante) {
        formAgregarEstudiante.addEventListener("submit", async (e) => {
          e.preventDefault();
          const nombre = document.getElementById("agNombre").value.trim();
          const grado = document.getElementById("agGrado").value.trim();
          const sede = document.getElementById("agSede").value.trim();
          if (!nombre || !grado || !sede) {
            if (agMensaje) { agMensaje.textContent = "Faltan datos requeridos."; agMensaje.className = "mensaje error"; }
            return;
          }
          try {
            const resp = await fetch("/api/auth/estudiantes/agregar", {
              method: "POST",
              headers: await encabezadosAdmin(true),
              body: JSON.stringify({ nombre, grado, sede }),
            });
            const data = await resp.json().catch(() => ({}));
            if (!resp.ok || !data.ok) throw new Error(data.motivo || "No se pudo agregar.");
            if (agMensaje) {
              agMensaje.textContent = `Estudiante agregado. Número: ${data.numero || ""} · Código: ${data.codigo || ""}`;
              agMensaje.className = "mensaje exito";
            }
            formAgregarEstudiante.reset();
          } catch (err) {
            if (agMensaje) { agMensaje.textContent = err.message || "Error al agregar."; agMensaje.className = "mensaje error"; }
          }
        });
      }

  if (botonExportar) {
    botonExportar.addEventListener("click", exportarCandidatos);
  }

  if (botonImportar) {
    botonImportar.addEventListener("click", () => importarArchivo?.click());
  }
  importarArchivo?.addEventListener("change", importarCandidatos);

  // Botón nuevo candidato
  if (botonNuevo) {
    botonNuevo.addEventListener("click", () => {
      limpiarFormularioCandidato();
      document.getElementById("nombreCandidato")?.focus();
    });
  }

  // Photo selection button - toggle between file and URL
  if (btnSeleccionarFoto) {
    btnSeleccionarFoto.addEventListener("click", () => {
      const isFileVisible = !imagenArchivo.hidden;
      imagenArchivo.hidden = isFileVisible;
      imagenRuta.hidden = !isFileVisible;
      if (!isFileVisible) {
        imagenArchivo.click();
      } else {
        imagenRuta.focus();
      }
      btnSeleccionarFoto.innerHTML = isFileVisible
        ? '<span class="icono-foto">📷</span><span>Seleccionar foto</span>'
        : '<span class="icono-foto">🔗</span><span>Pegar URL</span>';
    });
  }

  // Exportar/Importar votos y estudiantes
  botonExportarVotos?.addEventListener("click", exportarVotos);
  if (botonExportarEstudiantes) {
    botonExportarEstudiantes.addEventListener("click", exportarEstudiantes);
  }
  if (botonImportarEstudiantes) {
    botonImportarEstudiantes.addEventListener("click", () => importarEstudiantesArchivo?.click());
  }
  importarEstudiantesArchivo?.addEventListener("change", importarEstudiantes);

  async function cargarEstadoVotaciones() {
    try {
      const resp = await fetch("/api/estado");
      const data = await resp.json();
      actualizarEstadoVotaciones(data.abierto);
      actualizarConfigDesdeEstado(data.gradosPermitidos || [], data.sedesPermitidas || []);
    } catch (e) {
      console.error("Error cargando estado de votaciones:", e);
    }
  }

  function actualizarConfigDesdeEstado(gradosPermitidos, sedesPermitidas) {
    // Determinar qué sede está seleccionada basado en las sedes permitidas
    if (sedesPermitidas.length === 0) {
      // Sin filtro de sedes = todas las sedes
      selectSede.value = "__TODAS__";
      sedeActual = "__TODAS__";
      renderizarGrados("__TODAS__");
      // Marcar todos los grados si no hay filtro
      const checkboxes = gradosContainer.querySelectorAll('input[type="checkbox"][value!="__TODOS_SEDE__"]');
      checkboxes.forEach(cb => cb.checked = true);
    } else if (sedesPermitidas.length === 1) {
      // Una sola sede permitida
      const sedeUI = SEDE_MAP_INV[sedesPermitidas[0]] || sedesPermitidas[0];
      selectSede.value = sedeUI;
      sedeActual = sedeUI;
      renderizarGrados(sedeActual);
      // Marcar los grados permitidos
      const checkboxes = gradosContainer.querySelectorAll('input[type="checkbox"][value!="__TODOS_SEDE__"]');
      checkboxes.forEach(cb => {
        cb.checked = gradosPermitidos.some(g => String(g).toUpperCase() === String(cb.value).toUpperCase());
      });
      // Actualizar checkbox "Todos"
      const chkTodos = document.getElementById("chkTodosGradosSede");
      if (chkTodos) {
        chkTodos.checked = checkboxes.length > 0 && Array.from(checkboxes).every(cb => cb.checked);
        chkTodos.indeterminate = checkboxes.length > 0 && Array.from(checkboxes).some(cb => cb.checked) && !chkTodos.checked;
      }
    } else {
      // Múltiples sedes - mostrar "Todas las sedes" y marcar grados comunes
      selectSede.value = "__TODAS__";
      sedeActual = "__TODAS__";
      renderizarGrados("__TODAS__");
      const checkboxes = gradosContainer.querySelectorAll('input[type="checkbox"][value!="__TODOS_SEDE__"]');
      checkboxes.forEach(cb => {
        cb.checked = gradosPermitidos.some(g => String(g).toUpperCase() === String(cb.value).toUpperCase());
      });
    }
    actualizarResumen();
  }

  function actualizarEstadoVotaciones(abierto) {
    if (!estadoVotacionesBadge) return;
    if (abierto) {
      estadoVotacionesBadge.textContent = "Votaciones abiertas";
      estadoVotacionesBadge.className = "badge badge-abierto";
      if (botonCerrarVotaciones) botonCerrarVotaciones.disabled = false;
      if (botonAbrirVotaciones) botonAbrirVotaciones.disabled = true;
    } else {
      estadoVotacionesBadge.textContent = "Votaciones cerradas";
      estadoVotacionesBadge.className = "badge badge-cerrado";
      if (botonCerrarVotaciones) botonCerrarVotaciones.disabled = true;
      if (botonAbrirVotaciones) botonAbrirVotaciones.disabled = false;
    }
  }

  function actualizarResumen() {
    if (!configResumen) return;
    const grados = obtenerGradosSeleccionados();
    const sedes = obtenerSedesSeleccionadas();
    let texto = "";
    if (selectSede.value === "__TODAS__") {
      texto = "Todas las sedes";
      if (grados.length > 0) {
        const labels = grados.map(g => GRADO_LABELS[g] || g).join(", ");
        texto += ` | Grados: ${labels}`;
      } else {
        texto += " | Todos los grados";
      }
    } else {
      texto = `Sede: ${selectSede.value}`;
      if (grados.length > 0) {
        const labels = grados.map(g => GRADO_LABELS[g] || g).join(", ");
        texto += ` | Grados: ${labels}`;
      } else {
        texto += " | Sin grados seleccionados";
      }
    }
    configResumen.textContent = texto;
    configResumen.className = "config-resumen";
  }

  if (botonCerrarVotaciones) {
    botonCerrarVotaciones.addEventListener("click", async () => {
      if (!confirm("¿Seguro que quieres cerrar las votaciones? Los estudiantes no podrán votar.")) return;
      try {
        const resp = await fetch("/api/estado/cerrar", {
          method: "POST",
          headers: await encabezadosAdmin(),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
          actualizarEstadoVotaciones(false);
          actualizarSelectorGrados([]);
          alert(data.motivo || "Votaciones cerradas.");
        } else if (resp.status === 401 || resp.status === 403) {
          alert("Sesión de administrador inválida o expirada. Vuelve a ingresar desde la pantalla de inicio.");
          await eliminarDeStore("sesion", "actual");
          window.location.href = "index.html";
        } else {
          const motivo = data.motivo || data.mensaje || resp.statusText || "No se pudo cerrar las votaciones.";
          alert("No se pudo cerrar las votaciones.\nMotivo: " + motivo);
        }
      } catch (e) {
        console.error("Error al cerrar las votaciones:", e);
        alert("Error al cerrar las votaciones.");
      }
    });
  }

  if (botonAbrirVotaciones) {
    botonAbrirVotaciones.addEventListener("click", async () => {
      if (!confirm("¿Seguro que quieres abrir las votaciones?")) return;
      try {
        const grados = obtenerGradosSeleccionados();
        const sedes = obtenerSedesSeleccionadas();
        const resp = await fetch("/api/estado/abrir", {
          method: "POST",
          headers: await encabezadosAdmin(true),
          body: JSON.stringify({ grados, sedes }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
          actualizarEstadoVotaciones(true);
          actualizarConfigDesdeEstado(data.gradosPermitidos || [], data.sedesPermitidas || []);
          let msg = "Votaciones abiertas.";
          if (grados.length) msg += ` Grados: ${grados.join(", ")}.`;
          if (sedes.length) msg += ` Sedes: ${sedes.join(", ")}.`;
          alert(msg);
        } else if (resp.status === 401 || resp.status === 403) {
          alert("Sesión de administrador inválida o expirada. Vuelve a ingresar desde la pantalla de inicio.");
          await eliminarDeStore("sesion", "actual");
          window.location.href = "index.html";
        } else {
          const motivo = data.motivo || data.mensaje || resp.statusText || "No se pudo abrir las votaciones.";
          alert("No se pudo abrir las votaciones.\nMotivo: " + motivo);
        }
      } catch (e) {
        console.error("Error al abrir las votaciones:", e);
        alert("Error al abrir las votaciones.");
      }
    });
  }

  if (btnAplicarConfig) {
    btnAplicarConfig.addEventListener("click", async () => {
      try {
        const grados = obtenerGradosSeleccionados();
        const sedes = obtenerSedesSeleccionadas();
        
        if (selectSede.value !== "__TODAS__" && grados.length === 0) {
          alert("Debes seleccionar al menos un grado para la sede elegida.");
          return;
        }

        const resp = await fetch("/api/estado/abrir", {
          method: "POST",
          headers: await encabezadosAdmin(true),
          body: JSON.stringify({ grados, sedes }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
          actualizarEstadoVotaciones(true);
          actualizarConfigDesdeEstado(data.gradosPermitidos || [], data.sedesPermitidas || []);
          let partes = [];
          if (selectSede.value === "__TODAS__") {
            partes.push("Todas las sedes");
          } else {
            partes.push(`Sede: ${selectSede.value}`);
          }
          if (grados.length) {
            const labels = grados.map(g => GRADO_LABELS[g] || g).join(", ");
            partes.push(`Grados: ${labels}`);
          } else {
            partes.push("Todos los grados");
          }
          alert("Configuración aplicada: " + partes.join(" | ") + ".");
        } else if (resp.status === 401 || resp.status === 403) {
          alert("Sesión de administrador inválida o expirada. Vuelve a ingresar desde la pantalla de inicio.");
          await eliminarDeStore("sesion", "actual");
          window.location.href = "index.html";
        } else {
          const motivo = data.motivo || data.mensaje || resp.statusText || "No se pudo aplicar la configuración.";
          alert("No se pudo aplicar la configuración.\nMotivo: " + motivo);
        }
      } catch (e) {
        console.error("Error al aplicar configuración:", e);
        alert("Error al aplicar configuración.");
      }
    });
  }

  if (btnLimpiarConfig) {
    btnLimpiarConfig.addEventListener("click", async () => {
      try {
        const resp = await fetch("/api/estado/abrir", {
          method: "POST",
          headers: await encabezadosAdmin(true),
          body: JSON.stringify({ grados: [], sedes: [] }),
        });
        const data = await resp.json().catch(() => ({}));
        if (resp.ok && data.ok) {
          actualizarEstadoVotaciones(true);
          selectSede.value = "__TODAS__";
          sedeActual = "__TODAS__";
          renderizarGrados("__TODAS__");
          const checkboxes = gradosContainer.querySelectorAll('input[type="checkbox"][value!="__TODOS_SEDE__"]');
          checkboxes.forEach(cb => cb.checked = true);
          actualizarResumen();
          alert("Configuración limpiada: todas las sedes y todos los grados habilitados.");
        } else if (resp.status === 401 || resp.status === 403) {
          alert("Sesión de administrador inválida o expirada.");
          await eliminarDeStore("sesion", "actual");
          window.location.href = "index.html";
        } else {
          alert("No se pudo limpiar la configuración.");
        }
      } catch (e) {
        console.error("Error al limpiar configuración:", e);
        alert("Error al limpiar configuración.");
      }
    });
  }

  cargarEstadoVotaciones();

  // Mapeo de sedes (nombres UI -> nombres en datos) - ahora coinciden directamente
  const SEDE_MAP = {
    "YAGUAROS": "YAGUAROS",
    "IQUIA": "IQUIA",
    "SAN CARLOS": "SAN CARLOS",
    "SEDE CENTRAL": "SEDE CENTRAL"
  };

  const SEDE_MAP_INV = {
    "YAGUAROS": "YAGUAROS",
    "IQUIA": "IQUIA",
    "SAN CARLOS": "SAN CARLOS",
    "SEDE CENTRAL": "SEDE CENTRAL"
  };

  // Grados por sede (nombres normalizados como en los datos)
  const GRADOS_POR_SEDE = {
    "YAGUAROS": ["TRANSICION", "PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO"],
    "IQUIA": ["TRANSICION", "PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO"],
    "SAN CARLOS": ["TRANSICION", "PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO"],
    "SEDE CENTRAL": ["JARDIN A", "JARDIN B", "TRANSICION", "PRIMERO", "SEGUNDO", "TERCERO", "CUARTO", "QUINTO", "SEXTO", "SEPTIMO", "OCTAVO", "NOVENO", "DECIMO", "UNDECIMO"]
  };

  // Etiquetas amigables para mostrar
  const GRADO_LABELS = {
    "JARDIN A": "Jardín A",
    "JARDIN B": "Jardín B",
    "TRANSICION": "Transición",
    "PRIMERO": "1° Primero",
    "SEGUNDO": "2° Segundo",
    "TERCERO": "3° Tercero",
    "CUARTO": "4° Cuarto",
    "QUINTO": "5° Quinto",
    "SEXTO": "6° Sexto",
    "SEPTIMO": "7° Séptimo",
    "OCTAVO": "8° Octavo",
    "NOVENO": "9° Noveno",
    "DECIMO": "10° Décimo",
    "UNDECIMO": "11° Undécimo"
  };

  let sedeActual = "__TODAS__";

  function renderizarGrados(sedeKey) {
    if (!gradosContainer) return;
    gradosContainer.innerHTML = "";
    
    if (sedeKey === "__TODAS__") {
      gradosContainer.innerHTML = '<p class="config-ayuda">Selecciona una sede específica para elegir grados, o usa "Todas las sedes" para habilitar todos los grados de todas las sedes.</p>';
      return;
    }

    const sedeDatos = SEDE_MAP[sedeKey];
    const grados = GRADOS_POR_SEDE[sedeDatos] || [];
    
    if (grados.length === 0) {
      gradosContainer.innerHTML = '<p class="config-ayuda">No hay grados definidos para esta sede.</p>';
      return;
    }

    const grid = document.createElement("div");
    grid.className = "grados-grid";
    
    // Checkbox "Todos" para la sede actual
    const todosLabel = document.createElement("label");
    todosLabel.className = "checkbox-all";
    todosLabel.innerHTML = `<input type="checkbox" id="chkTodosGradosSede" value="__TODOS_SEDE__"><span>Todos los grados de ${sedeKey}</span>`;
    grid.appendChild(todosLabel);

    grados.forEach((grado) => {
      const label = document.createElement("label");
      const labelText = GRADO_LABELS[grado] || grado;
      label.innerHTML = `<input type="checkbox" value="${grado}"><span>${labelText}</span>`;
      grid.appendChild(label);
    });

    gradosContainer.appendChild(grid);

    // Event listener para "Todos" de la sede
    const chkTodosSede = document.getElementById("chkTodosGradosSede");
    if (chkTodosSede) {
      chkTodosSede.addEventListener("change", () => {
        const checkboxes = grid.querySelectorAll('input[type="checkbox"][value!="__TODOS_SEDE__"]');
        checkboxes.forEach(cb => cb.checked = chkTodosSede.checked);
      });
    }
  }

  function obtenerGradosSeleccionados() {
    if (!gradosContainer) return [];
    const checkboxes = gradosContainer.querySelectorAll('input[type="checkbox"][value!="__TODOS_SEDE__"]:checked');
    return Array.from(checkboxes).map(cb => cb.value);
  }

  function obtenerSedesSeleccionadas() {
    const sede = selectSede?.value;
    if (!sede || sede === "__TODAS__") return [];
    return [SEDE_MAP[sede]];
  }

  // Event listener para cambio de sede
  if (selectSede) {
    selectSede.addEventListener("change", () => {
      sedeActual = selectSede.value;
      renderizarGrados(sedeActual);
    });
  }

  // Inicializar con la primera sede por defecto (no "Todas")
  if (selectSede && !selectSede.value) {
    selectSede.value = "YAGUAROS";
    sedeActual = "YAGUAROS";
    renderizarGrados(sedeActual);
  }

  if (botonReiniciar) {
    botonReiniciar.addEventListener("click", reiniciarVotaciones);
  }

  botonesCerrarSesion.forEach((boton) => {
    boton.addEventListener("click", async () => {
      await eliminarDeStore("sesion", "actual");
      await eliminarDeStore("candidatos", "all");
      await eliminarDeStore("resultadosCache", "all");
      await eliminarDeStore("votosPendientes", "all");
      await eliminarDeStore("votosLocales", "all");
      window.location.href = "index.html";
    });
  });

  botonNuevo?.addEventListener("click", () => {
    cambiarPestana("candidatos");
    limpiarFormularioCandidato();
    document.getElementById("nombreCandidato")?.focus();
  });
  const nombreCandidatoInput = document.getElementById("nombreCandidato");
  const cargoGroup = document.getElementById("cargoCandidato")?.closest("label")?.parentElement || document.getElementById("cargoCandidato")?.parentElement;
  const propuestaGroup = document.getElementById("propuestaCandidato")?.closest("label")?.parentElement || document.getElementById("propuestaCandidato")?.parentElement;
  
  function toggleVotoEnBlancoFields() {
    const esVotoEnBlanco = (nombreCandidatoInput?.value || "").trim().toLowerCase() === "voto en blanco";
    const fields = [
      document.getElementById("listaCandidato"),
      document.getElementById("cargoCandidato"),
      document.getElementById("propuestaCandidato")
    ];
    const labels = [
      document.querySelector('label[for="listaCandidato"]'),
      document.querySelector('label[for="cargoCandidato"]'),
      document.querySelector('label[for="propuestaCandidato"]')
    ];
    
    fields.forEach((field, i) => {
      if (field) {
        field.style.display = esVotoEnBlanco ? "none" : "";
        field.required = !esVotoEnBlanco;
        if (esVotoEnBlanco) field.value = "";
      }
      if (labels[i]) labels[i].style.display = esVotoEnBlanco ? "none" : "";
    });
  }
  
  nombreCandidatoInput?.addEventListener("input", toggleVotoEnBlancoFields);
  nombreCandidatoInput?.addEventListener("blur", toggleVotoEnBlancoFields);
  
  // Photo selection button - toggle between file and URL
  if (btnSeleccionarFoto) {
    btnSeleccionarFoto.addEventListener("click", () => {
      const isFileVisible = !imagenArchivo.hidden;
      imagenArchivo.hidden = isFileVisible;
      imagenRuta.hidden = !isFileVisible;
      if (!isFileVisible) {
        imagenArchivo.click();
      } else {
        imagenRuta.focus();
      }
      btnSeleccionarFoto.innerHTML = isFileVisible
        ? '<span class="icono-foto">📷</span><span>Seleccionar foto</span>'
        : '<span class="icono-foto">🔗</span><span>Pegar URL</span>';
    });
  }
  
  imagenArchivo?.addEventListener("change", cargarFotoDesdeEquipo);
  imagenRuta?.addEventListener("input", () => mostrarVistaPrevia(imagenRuta.value.trim()));
  pestanas.forEach((pestana) => {
    pestana.addEventListener("click", () => cambiarPestana(pestana.dataset.pestana));
  });

  const tiempoLimite = setTimeout(() => {
    const contenedor = document.getElementById("listaResultados");
    const texto = contenedor?.textContent || "";
    if (/Cargando|Esperando resultados/.test(texto)) {
      contenedor.innerHTML = "<p>No se pudieron cargar los resultados. Revisa tu conexión o inicia sesión nuevamente.</p>";
    }
    const info = document.getElementById("infoSincronizacion");
    const infoTexto = info?.textContent || "";
    if (/Verificando|Sin conexión/.test(infoTexto)) {
      info.textContent = "No se pudo conectar con el servidor.";
      info.className = "mensaje error";
    }
  }, 12000);

  try {
    await cargarResultados();
    await cargarCandidatosAdmin();
  } catch (error) {
    console.error("Error al iniciar panel:", error);
    const contenedor = document.getElementById("listaResultados");
    if (contenedor) contenedor.innerHTML = `<p>Error al cargar el panel: ${error.message}</p>`;
  } finally {
    clearTimeout(tiempoLimite);
  }
});

function mostrarMensaje(texto, tipo = "exito") {
  const info = document.getElementById("infoSincronizacion");
  if (!info) return;
  info.textContent = texto;
  info.className = `mensaje ${tipo}`;
}

function cambiarPestana(nombre) {
  const verCandidatos = nombre === "candidatos";
  document.getElementById("seccionCandidatos")?.classList.toggle("oculto", !verCandidatos);
  document.getElementById("seccionVotaciones")?.classList.toggle("oculto", verCandidatos);
  document.querySelectorAll("[data-pestana]").forEach((pestana) => {
    pestana.classList.toggle("activa", pestana.dataset.pestana === nombre);
  });
}

function mostrarVistaPrevia(origen) {
  const imagen = document.getElementById("previewImagenCandidato");
  const texto = document.getElementById("sinPreviewImagen");
  if (!imagen || !texto) return;
  if (!origen || origen.trim() === "") {
    imagen.hidden = true;
    imagen.src = "";
    imagen.removeAttribute("src");
    texto.hidden = false;
    return;
  }
  imagen.src = origen;
  imagen.onerror = function() {
    console.warn("Error al cargar imagen:", origen);
    imagen.hidden = true;
    imagen.src = "";
    texto.hidden = false;
  };
  imagen.onload = function() {
    imagen.hidden = false;
    texto.hidden = true;
  };
}

function cargarFotoDesdeEquipo(evento) {
  const archivo = evento.target.files?.[0];
  if (!archivo) return;
  if (!archivo.type.startsWith("image/")) {
    mostrarMensaje("Selecciona un archivo de imagen válido.", "error");
    evento.target.value = "";
    return;
  }
  const lector = new FileReader();
  lector.addEventListener("load", () => {
    document.getElementById("imagenCandidato").value = lector.result;
    mostrarVistaPrevia(lector.result);
  });
  lector.readAsDataURL(archivo);
}

async function limpiarVotosLocales() {
  const [votosLocales, votosPendientes, resultadosCache] = await Promise.all([
    obtenerTodoDeStore("votosLocales"),
    obtenerTodoDeStore("votosPendientes"),
    obtenerTodoDeStore("resultadosCache"),
  ]);

  await Promise.all([
    ...votosLocales.map((voto) => eliminarDeStore("votosLocales", voto.estudianteId)),
    ...votosPendientes.map((voto) => eliminarDeStore("votosPendientes", voto.localId)),
    ...resultadosCache.map((resultado) => eliminarDeStore("resultadosCache", resultado.id)),
  ]);
}

async function cargarCandidatosAdmin() {
    try {
      const respuesta = await fetch("/api/candidatos");
      if (!respuesta.ok) throw new Error("Error de red");
      const candidatos = await respuesta.json();
      renderizarCandidatosAdmin(candidatos);
    } catch (error) {
      renderizarCandidatosAdmin([]);
    }
  }

  function renderizarCandidatosAdmin(candidatos) {
    if (!listaCandidatosAdmin) return;
    
    if (!candidatos.length) {
      listaCandidatosAdmin.innerHTML = '<p style="text-align:center;color:var(--texto-claro);padding:20px;">No hay candidatos registrados.</p>';
      return;
    }

    listaCandidatosAdmin.innerHTML = "";
    
    // Ordenar: "Voto en blanco" al final
    const ordenados = [...candidatos].sort((a, b) => {
      const aBlanco = a.nombre.toLowerCase() === "voto en blanco";
      const bBlanco = b.nombre.toLowerCase() === "voto en blanco";
      if (aBlanco && !bBlanco) return 1;
      if (!aBlanco && bBlanco) return -1;
      return 0;
    });

    ordenados.forEach((candidato) => {
      const esVotoEnBlanco = candidato.nombre.toLowerCase() === "voto en blanco";
      const nombreMostrar = esVotoEnBlanco ? "VOTO EN BLANCO" : candidato.nombre.toUpperCase();
      const rutaImagen = resolverRutaImagen(candidato.imagen);
      
      const item = document.createElement("div");
      item.className = `item-candidato-admin ${esVotoEnBlanco ? "voto-blanco" : ""}`;
      item.innerHTML = `
        <div class="candidato-admin-foto">
          ${crearImgConFallback(rutaImagen, nombreMostrar, "candidato-admin-foto-img")}
        </div>
        <div class="candidato-admin-info">
          <div class="candidato-admin-nombre">${escaparHtml(nombreMostrar)}</div>
          <div class="candidato-admin-detalles">
            ${!esVotoEnBlanco ? `<span>Lista: ${escaparHtml(candidato.lista || "")}</span>` : ""}
            <span>Cargo: ${escaparHtml(candidato.cargo || "")}</span>
          </div>
        </div>
        ${!esVotoEnBlanco ? `
        <div class="candidato-admin-acciones">
          <button type="button" class="icono-accion editar" data-id="${escaparHtml(candidato.id)}" title="Editar candidato">✏️</button>
          <button type="button" class="icono-accion eliminar" data-id="${escaparHtml(candidato.id)}" title="Eliminar candidato">🗑️</button>
        </div>
        ` : ""}
      `;
      
      // Event listeners
      if (!esVotoEnBlanco) {
        item.querySelector(".icono-accion.editar").addEventListener("click", (e) => {
          e.stopPropagation();
          cargarCandidatoParaEditar(candidato.id);
        });
        item.querySelector(".icono-accion.eliminar").addEventListener("click", (e) => {
          e.stopPropagation();
          borrarCandidato(candidato.id);
        });
      }
      
      listaCandidatosAdmin.appendChild(item);
    });
  }

async function guardarCandidato(evento) {
  evento.preventDefault();
  const id = document.getElementById("candidatoId").value;
  const nombre = document.getElementById("nombreCandidato").value.trim();
  const esVotoEnBlanco = nombre.toLowerCase() === "voto en blanco";
  const payload = {
    nombre,
    lista: esVotoEnBlanco ? "" : document.getElementById("listaCandidato").value.trim(),
    cargo: document.getElementById("cargoCandidato").value.trim(),
    propuesta: document.getElementById("propuestaCandidato").value.trim(),
    imagen: document.getElementById("imagenCandidato").value.trim(),
    inspiracion: document.getElementById("inspiracionCandidato").value.trim(),
  };

  const metodo = id ? "PUT" : "POST";
  const url = id ? `/api/candidatos/${id}` : "/api/candidatos";

  try {
    const respuesta = await fetch(url, {
      method: metodo,
      headers: await encabezadosAdmin(true),
      body: JSON.stringify(payload),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.motivo || "No se pudo guardar el candidato");
    limpiarFormularioCandidato();
    await Promise.all([cargarCandidatosAdmin(), cargarResultados()]);
    mostrarMensaje(id ? "Candidato actualizado correctamente." : "Candidato agregado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo guardar el candidato", "error");
  }
}

async function cargarCandidatoParaEditar(id) {
  try {
    const respuesta = await fetch(`/api/candidatos/${id}`);
    if (!respuesta.ok) throw new Error("Error");
    const candidato = await respuesta.json();
    if (!candidato) return;
    cambiarPestana("candidatos");
    document.getElementById("candidatoId").value = candidato.id;
    document.getElementById("nombreCandidato").value = candidato.nombre || "";
    document.getElementById("listaCandidato").value = candidato.lista || "";
    document.getElementById("cargoCandidato").value = candidato.cargo || "";
    document.getElementById("propuestaCandidato").value = candidato.propuesta || "";
    document.getElementById("imagenCandidato").value = candidato.imagen || "";
    document.getElementById("inspiracionCandidato").value = candidato.inspiracion || "";
    document.getElementById("imagenArchivo").value = "";
    // Reset photo selection button state
    const btnSeleccionarFoto = document.getElementById("btnSeleccionarFoto");
    const imagenArchivo = document.getElementById("imagenArchivo");
    const imagenRuta = document.getElementById("imagenCandidato");
    if (btnSeleccionarFoto && imagenArchivo && imagenRuta) {
      imagenArchivo.hidden = false;
      imagenRuta.hidden = true;
      btnSeleccionarFoto.innerHTML = '<span class="icono-foto">📷</span><span>Seleccionar foto</span>';
    }
    mostrarVistaPrevia(candidato.imagen || "");
    document.getElementById("btnGuardarCandidato").textContent = "Guardar cambios";
    document.getElementById("nombreCandidato").scrollIntoView({ behavior: "smooth", block: "center" });
    document.getElementById("nombreCandidato").focus();
  } catch (error) {
    window.alert("No se pudo cargar el candidato");
  }
}

function limpiarFormularioCandidato() {
  document.getElementById("candidatoId").value = "";
  document.getElementById("nombreCandidato").value = "";
  document.getElementById("listaCandidato").value = "";
  document.getElementById("cargoCandidato").value = "";
  document.getElementById("propuestaCandidato").value = "";
  document.getElementById("imagenCandidato").value = "";
  document.getElementById("imagenArchivo").value = "";
  document.getElementById("inspiracionCandidato").value = "";
  document.getElementById("btnGuardarCandidato").textContent = "Guardar candidato";
  // Mostrar campos ocultos por "Voto en blanco"
  const fields = [
    document.getElementById("listaCandidato"),
    document.getElementById("cargoCandidato"),
    document.getElementById("propuestaCandidato")
  ];
  const labels = [
    document.querySelector('label[for="listaCandidato"]'),
    document.querySelector('label[for="cargoCandidato"]'),
    document.querySelector('label[for="propuestaCandidato"]')
  ];
  fields.forEach((field, i) => {
    if (field) {
      field.style.display = "";
      field.required = true;
    }
    if (labels[i]) labels[i].style.display = "";
  });
  // Reset photo selection button
  const btnSeleccionarFoto = document.getElementById("btnSeleccionarFoto");
  const imagenArchivo = document.getElementById("imagenArchivo");
  const imagenRuta = document.getElementById("imagenCandidato");
  if (btnSeleccionarFoto && imagenArchivo && imagenRuta) {
    imagenArchivo.hidden = false;
    imagenRuta.hidden = true;
    btnSeleccionarFoto.innerHTML = '<span class="icono-foto">📷</span><span>Seleccionar foto</span>';
  }
  mostrarVistaPrevia("");
}

async function borrarCandidato(id) {
  const confirmar = window.confirm("¿Deseas borrar este candidato?");
  if (!confirmar) return;
  try {
    const respuesta = await fetch(`/api/candidatos/${id}`, {
      method: "DELETE",
      headers: await encabezadosAdmin(),
    });
    const datos = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(datos.motivo || "No se pudo borrar");
    await Promise.all([cargarCandidatosAdmin(), cargarResultados()]);
    mostrarMensaje("Candidato eliminado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo borrar el candidato", "error");
  }
}

async function exportarCandidatos() {
  // Mostrar modal para seleccionar UN candidato
  const modal = document.getElementById("modalExportarCandidatos");
  const lista = document.getElementById("listaExportarCandidatos");
  if (!modal || !lista) return;

  try {
    const respuesta = await fetch("/api/candidatos", { headers: await encabezadosAdmin() });
    if (!respuesta.ok) throw new Error("Error al cargar candidatos");
    const candidatos = await respuesta.json();

    // Renderizar select con candidatos
    lista.innerHTML = `
      <label>Selecciona un candidato:</label>
      <select id="selectExportarCandidato" style="width:100%; padding:10px; border:2px solid var(--bordes); border-radius:var(--radio-md); font-size:1rem; margin-top:8px;">
        <option value="">-- Elige un candidato --</option>
        ${candidatos.map(c => `<option value="${c.id}">${c.nombre} (Lista: ${c.lista})</option>`).join("")}
      </select>
    `;

    // Configurar botones
    const btnCancelar = document.getElementById("btnCancelarExportar");
    const btnConfirmar = document.getElementById("btnConfirmarExportar");

    const cerrarModal = () => {
      modal.classList.add("oculto");
      btnCancelar.removeEventListener("click", onCancelar);
      btnConfirmar.removeEventListener("click", onConfirmar);
    };

    const onCancelar = () => cerrarModal();

    const onConfirmar = async () => {
      const select = document.getElementById("selectExportarCandidato");
      const id = select?.value;
      if (!id) {
        mostrarMensaje("Selecciona un candidato", "error");
        return;
      }
      cerrarModal();
      await descargarCandidato(id);
    };

    btnCancelar.addEventListener("click", onCancelar);
    btnConfirmar.addEventListener("click", onConfirmar);

    modal.classList.remove("oculto");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo abrir selector de exportación", "error");
  }
}

async function descargarCandidato(id) {
  try {
    const respuesta = await fetch(`/api/candidatos/exportar?id=${encodeURIComponent(id)}`, {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) {
      const texto = await respuesta.text().catch(() => "");
      throw new Error(texto || `Error ${respuesta.status}: No se pudo descargar el archivo`);
    }
    const archivo = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = "candidato.xlsx";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
    mostrarMensaje("Candidato exportado correctamente.");
  } catch (error) {
    console.error("Error al exportar candidato:", error);
    mostrarMensaje(error.message || "No se pudo descargar el archivo", "error");
  }
}

async function importarCandidatos(evento) {
  const archivo = evento.target.files?.[0];
  if (!archivo) return;
  const nombre = archivo.name.toLowerCase();
  const esExcel = nombre.endsWith(".xlsx") || nombre.endsWith(".xls") || nombre.endsWith(".csv");
  const esJSON = nombre.endsWith(".json");
  if (!esExcel && !esJSON) {
    mostrarMensaje("Selecciona un archivo .json, .xlsx, .xls o .csv válido.", "error");
    evento.target.value = "";
    return;
  }

  try {
    let resultado;
    if (esExcel) {
      const formData = new FormData();
      formData.append("archivo", archivo);
      const respuesta = await fetch("/api/candidatos/importar", {
        method: "POST",
        headers: await encabezadosAdmin(),
        body: formData,
      });
      resultado = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(resultado.motivo || resultado.mensaje || "No se pudo importar");
    } else {
      const lector = new FileReader();
      const texto = await new Promise((resolve, reject) => {
        lector.addEventListener("load", () => resolve(lector.result));
        lector.addEventListener("error", () => reject(lector.error));
        lector.readAsText(archivo);
      });
      const datos = JSON.parse(texto);
      const candidatos = Array.isArray(datos) ? datos : [datos];
      const respuesta = await fetch("/api/candidatos/importar", {
        method: "POST",
        headers: await encabezadosAdmin(true),
        body: JSON.stringify({ datos: candidatos }),
      });
      resultado = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) throw new Error(resultado.motivo || resultado.mensaje || "No se pudo importar");
    }
    await Promise.all([cargarCandidatosAdmin(), cargarResultados()]);
    mostrarMensaje(`Se importaron ${resultado.importados || 0} candidatos correctamente.`);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo importar el archivo", "error");
  } finally {
    evento.target.value = "";
  }
}

async function cargarResultados() {
  const info = document.getElementById("infoSincronizacion");
  let resultados = [];

  try {
    const respuesta = await fetch("/api/votos/resultados", {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) throw new Error("Error de red");
    resultados = await respuesta.json();
    for (const r of resultados) {
      await guardarEnStore("resultadosCache", r);
    }
    info.textContent = "Resultados actualizados en tiempo real.";
  } catch (error) {
    try {
      resultados = await obtenerTodoDeStore("resultadosCache");
    } catch (e) {
      resultados = [];
    }
    info.textContent =
      "Sin conexión: mostrando el último resultado guardado en este dispositivo.";
  }

  try {
    renderizarResultados(resultados);
  } catch (error) {
    console.error("Error al renderizar resultados:", error);
    const contenedor = document.getElementById("listaResultados");
    if (contenedor) contenedor.innerHTML = `<p>Error al mostrar resultados: ${error.message}</p>`;
  }
}

function animarNumero(elemento, valorFinal) {
  const duracion = 600;
  const inicio = performance.now();
  function paso(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    elemento.textContent = Math.round(progreso * valorFinal);
    if (progreso < 1) requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
}

function renderizarResultados(resultados) {
  const contenedor = document.getElementById("listaResultados");
  contenedor.innerHTML = "";

  const totalVotos = resultados.reduce((sum, r) => sum + (r.votos || 0), 0);
  const totalCandidatos = resultados.length;
  const lider = resultados.reduce((actual, candidato) => {
    if (!actual || (candidato.votos || 0) > (actual.votos || 0)) return candidato;
    return actual;
  }, null);
  animarNumero(document.getElementById("totalVotosNumero"), totalVotos);
  const totalCandidatosNumero = document.getElementById("totalCandidatosNumero");
  const liderVotaciones = document.getElementById("liderVotaciones");
  if (totalCandidatosNumero) totalCandidatosNumero.textContent = totalCandidatos;
  if (liderVotaciones) {
    liderVotaciones.textContent = lider && (lider.votos || 0) > 0
      ? `${lider.nombre || "Sin nombre"} · ${lider.votos} votos`
      : "—";
  }

  if (!resultados.length) {
    contenedor.innerHTML = "<p>Todavía no hay resultados disponibles.</p>";
    const seccionGrafica = document.getElementById("seccionGrafica");
    if (seccionGrafica) seccionGrafica.innerHTML = "<p class=\"texto-grafica-vacia\">Aún no hay votos registrados.</p>";
    return;
  }

  const ordenados = resultados
    .slice()
    .sort((a, b) =>
      String(a.cargo || "").localeCompare(String(b.cargo || "")) ||
      (a.nombre === "Voto en blanco" ? 1 : b.nombre === "Voto en blanco" ? -1 : 0) ||
      (b.votos || 0) - (a.votos || 0)
    );

  const puestosCalculados = new Map();
  const porCargo = new Map();

  ordenados.forEach((candidato) => {
    const cargo = candidato.cargo || "Sin cargo";
    if (!porCargo.has(cargo)) porCargo.set(cargo, []);
    porCargo.get(cargo).push(candidato);
  });

  porCargo.forEach((lista) => {
    const candidatosOrdenados = [...lista].sort((a, b) => {
      if (a.nombre === "Voto en blanco") return 1;
      if (b.nombre === "Voto en blanco") return -1;
      return (b.votos || 0) - (a.votos || 0);
    });

    const info = candidatosOrdenados.map((candidato, indice) => {
      const votos = candidato.votos || 0;
      const medalla = votos > 0 ? MEDALLAS[indice] || "" : "";
      const esPrimero = indice === 0;
      let textoPuesto = "";

      if (!votos) {
        textoPuesto = "";
      } else if (esPrimero) {
        textoPuesto = "1er puesto";
      } else {
        const candidatosEnMismoPuesto = candidatosOrdenados.filter(
          (c) => (c.votos || 0) === votos
        );
        const hayEmpateEnPuesto = candidatosEnMismoPuesto.length > 1;
        if (hayEmpateEnPuesto) {
          textoPuesto = "Empate";
        } else {
        const puestoBase = indice + 1;
        textoPuesto = puestoBase === 1 ? "1er puesto" : puestoBase === 2 ? "2do puesto" : "3er puesto";
        }
      }

      return { candidato, medalla, textoPuesto, votos };
    });

    info.forEach((item) => {
      puestosCalculados.set(item.candidato.id, item);
    });
  });

  const usados = new Set();
  const tarjetas = [];

  ordenados.forEach((candidato) => {
    if (usados.has(candidato.id)) return;
    usados.add(candidato.id);

    const info = puestosCalculados.get(candidato.id) || {};
    const medalla = info.medalla || "";
    const puesto = info.textoPuesto || "";
    const porcentaje = totalVotos
      ? Math.round(((candidato.votos || 0) / totalVotos) * 100)
      : 0;
    const color = COLORES[usados.size % COLORES.length];

    const rutaImagen = resolverRutaImagen(candidato.imagen);
    const esVotoEnBlanco = candidato.nombre.toLowerCase() === "voto en blanco";
    const nombreMostrar = esVotoEnBlanco ? "VOTO EN BLANCO" : candidato.nombre.toUpperCase();
    const tarjeta = document.createElement("div");
    tarjeta.className = "tarjeta-resultado";
    
    // Usar imagen personalizada para Voto en blanco si existe
    let contenidoImagen;
    if (esVotoEnBlanco) {
      const imgBlanco = "icons/candidatos/Voto-en-blanco.jpg";
      contenidoImagen = `${crearImgConFallback(imgBlanco, "VOTO EN BLANCO", "foto-candidato resultado-foto", "this.nextElementSibling.style.display='inline-flex';")}<span class="icono-voto-blanco-resultado" aria-label="VOTO EN BLANCO" style="display:none;">☐</span>`;
    } else {
      contenidoImagen = crearImgConFallback(rutaImagen, escaparHtml(nombreMostrar), "foto-candidato resultado-foto");
    }
    
    tarjeta.innerHTML = `
      ${contenidoImagen}
      <div class="resultado-cuerpo">
        <div class="resultado-fila">
          <span class="resultado-nombre">
            <span class="medalla">${medalla}</span>
            ${escaparHtml(nombreMostrar)}
          </span>
          <span class="resultado-puesto">${puesto}</span>
        </div>
        <div class="resultado-metricas">
          <span class="resultado-votos">${candidato.votos || 0} votos</span>
          <span class="resultado-porcentaje" style="color:${color}">${porcentaje}%</span>
        </div>
      </div>
      ${!esVotoEnBlanco ? `
      <div class="admin-acciones-resultado">
        <button type="button" class="icono-accion editar" data-id="${escaparHtml(candidato.id)}" title="Editar candidato">✏️</button>
        <button type="button" class="icono-accion eliminar" data-id="${escaparHtml(candidato.id)}" title="Eliminar candidato">🗑️</button>
      </div>
      ` : ""}
    `;
    contenedor.appendChild(tarjeta);

    // Event listeners para editar/eliminar (solo si no es Voto en blanco)
    if (!esVotoEnBlanco) {
      tarjeta.querySelector(".icono-accion.editar").addEventListener("click", (e) => {
        e.stopPropagation();
        cargarCandidatoParaEditar(candidato.id);
        cambiarPestana("candidatos");
      });
      tarjeta.querySelector(".icono-accion.eliminar").addEventListener("click", (e) => {
        e.stopPropagation();
        borrarCandidato(candidato.id);
      });
    }

    tarjetas.push({ nombre: esVotoEnBlanco ? "VOTO EN BLANCO" : (candidato.nombre || "Sin nombre").toUpperCase(), votos: candidato.votos || 0, color });
  });

  const seccionGrafica = document.getElementById("seccionGrafica");
  if (!seccionGrafica) return;

  if (!tarjetas.length) {
    seccionGrafica.innerHTML = `
      <div class="grafica-vacia">
        <h3>Distribución de votos</h3>
        <p>Aún no hay votos registrados.</p>
      </div>
    `;
    return;
  }

  const totalGrafica = tarjetas.reduce((sum, t) => sum + t.votos, 0) || 1;
  let gradosAcumulados = 0;
  const paradas = tarjetas
    .map((t) => {
      const fraccion = t.votos / totalGrafica;
      const grados = fraccion * 360;
      const desde = gradosAcumulados;
      gradosAcumulados += grados;
      const hasta = gradosAcumulados;
      return `${t.color} ${desde.toFixed(2)}deg ${hasta.toFixed(2)}deg`;
    })
    .join(", ");

  const gradiente = `conic-gradient(${paradas})`;
  const leyenda = tarjetas
    .map((t) => {
      const p = totalVotos ? Math.round((t.votos / totalVotos) * 100) : 0;
      return `
        <div class="grafica-leyenda-item">
          <span class="grafica-leyenda-color" style="background:${t.color}"></span>
          <span class="grafica-leyenda-nombre">${escaparHtml(t.nombre)}</span>
          <span class="grafica-leyenda-dato">${t.votos} votos · ${p}%</span>
        </div>
      `;
    })
    .join("");

  seccionGrafica.innerHTML = `
    <div class="grafica-encabezado">
      <div>
        <h3>Distribución de votos</h3>
        <p>Porcentaje por candidato</p>
      </div>
      <span class="grafica-total-chip">${totalVotos} votos</span>
    </div>
    <div class="grafica-contenido">
      <div class="grafica-circular" style="background:${gradiente}">
        <div class="grafica-circular-hoyo">
          <div class="grafica-circular-centro">
            <div class="grafica-total">${totalVotos}</div>
            <div class="grafica-etiqueta">votos totales</div>
          </div>
        </div>
      </div>
      <div class="grafica-leyenda">${leyenda}</div>
    </div>
  `;
}

async function reiniciarVotaciones() {
  const confirmar = window.confirm(
    "¿Seguro que quieres reiniciar todas las votaciones? Esto borrará el registro de votos."
  );

  if (!confirmar) return;

  const info = document.getElementById("infoSincronizacion");

  try {
    const respuesta = await fetch("/api/votos/reset", {
      method: "POST",
      headers: await encabezadosAdmin(true),
    });
    const datos = await respuesta.json().catch(() => ({}));

    if (!respuesta.ok) {
      throw new Error(datos.motivo || "No se pudo reiniciar las votaciones.");
    }

    await limpiarVotosLocales();
    await cargarResultados();
    mostrarMensaje(datos.motivo || "Las votaciones fueron reiniciadas correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo reiniciar las votaciones.", "error");
  }
}

async function importarEstudiantes(evento) {
  const archivo = evento.target.files?.[0];
  if (!archivo) return;
  const nombre = archivo.name.toLowerCase();
  const esExcel = nombre.endsWith(".xlsx") || nombre.endsWith(".xls") || nombre.endsWith(".csv");
  if (!esExcel) {
    mostrarMensaje("Selecciona un archivo Excel (.xlsx, .xls) o CSV válido.", "error");
    evento.target.value = "";
    return;
  }

  try {
    const formData = new FormData();
    formData.append("archivo", archivo);
    const respuesta = await fetch("/api/auth/estudiantes/importar", {
      method: "POST",
      headers: await encabezadosAdmin(),
      body: formData,
    });
    const resultado = await respuesta.json().catch(() => ({}));
    if (!respuesta.ok) throw new Error(resultado.motivo || resultado.mensaje || "No se pudo importar");
    mostrarMensaje(resultado.mensaje || `Se importaron ${resultado.importados || 0} estudiantes correctamente.`);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo importar el listado de estudiantes", "error");
  } finally {
    evento.target.value = "";
  }
}

async function exportarEstudiantes() {
  try {
    const respuesta = await fetch("/api/auth/estudiantes/exportar", {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) throw new Error("No se pudo descargar el listado de estudiantes");
    const archivo = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = "estudiantes.xlsx";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
    mostrarMensaje("Listado de estudiantes descargado correctamente.");
  } catch (error) {
    mostrarMensaje(error.message || "No se pudo descargar el listado de estudiantes", "error");
  }
}

async function exportarVotos() {
  try {
    const respuesta = await fetch("/api/votos/exportar", {
      headers: await encabezadosAdmin(),
    });
    if (!respuesta.ok) throw new Error("No se pudieron descargar los registros");
    const archivo = await respuesta.blob();
    const enlace = document.createElement("a");
    enlace.href = URL.createObjectURL(archivo);
    enlace.download = "registros-votacion.csv";
    document.body.appendChild(enlace);
    enlace.click();
    document.body.removeChild(enlace);
    URL.revokeObjectURL(enlace.href);
  } catch (error) {
    mostrarMensaje(error.message || "No se pudieron descargar los registros", "error");
  }
}
