// Tema oscuro basado en preferencia del sistema
(function() {
  const STORAGE_KEY = "cusiana_theme";
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
  const current = localStorage.getItem(STORAGE_KEY) || (prefersDark ? "dark" : "light");

  if (current === "dark") {
    document.documentElement.setAttribute("data-theme", "dark");
  }
})();

// Utilidades para animaciones de carga
function crearSkeleton(ancho, alto, clases = "") {
  const div = document.createElement("div");
  div.className = `skeleton ${clases}`.trim();
  div.style.width = ancho;
  div.style.height = alto;
  return div;
}

function mostrarCarga(contenedor, cantidad = 3) {
  if (!contenedor) return;
  contenedor.innerHTML = "";
  for (let i = 0; i < cantidad; i++) {
    const item = document.createElement("div");
    item.className = "skeleton-card";
    item.innerHTML = `
      <div class="skeleton skeleton-avatar"></div>
      <div class="skeleton skeleton-text" style="width: 60%"></div>
      <div class="skeleton skeleton-text" style="width: 80%"></div>
      <div class="skeleton skeleton-button"></div>
    `;
    contenedor.appendChild(item);
  }
}

// Animación de conteo
function animarConteo(elemento, valorFinal, duracion = 1000) {
  if (!elemento) return;
  const inicio = performance.now();
  const valorInicio = 0;
  
  function actualizar(ahora) {
    const progreso = Math.min((ahora - inicio) / duracion, 1);
    const easeOut = 1 - Math.pow(1 - progreso, 3);
    elemento.textContent = Math.round(valorInicio + (valorFinal - valorInicio) * easeOut);
    if (progreso < 1) requestAnimationFrame(actualizar);
  }
  requestAnimationFrame(actualizar);
}

// Notificaciones toast
function mostrarToast(mensaje, tipo = "exito", duracion = 3000) {
  const existente = document.querySelector(".toast-container");
  if (!existente) {
    const container = document.createElement("div");
    container.className = "toast-container";
    document.body.appendChild(container);
  }
  
  const toast = document.createElement("div");
  toast.className = `toast toast-${tipo}`;
  toast.innerHTML = `
    <span class="toast-icon">${tipo === "exito" ? "✅" : tipo === "error" ? "❌" : "⚠️"}</span>
    <span class="toast-mensaje">${mensaje}</span>
  `;
  
  const container = document.querySelector(".toast-container");
  container.appendChild(toast);
  
  requestAnimationFrame(() => toast.classList.add("toast-show"));
  
  setTimeout(() => {
    toast.classList.remove("toast-show");
    setTimeout(() => toast.remove(), 300);
  }, duracion);
}

// Confirmación personalizada
function confirmar(mensaje, textoOk = "Confirmar", textoCancelar = "Cancelar") {
  return new Promise((resolve) => {
    const overlay = document.createElement("div");
    overlay.className = "confirm-overlay";
    overlay.innerHTML = `
      <div class="confirm-modal">
        <p class="confirm-mensaje">${mensaje}</p>
        <div class="confirm-botones">
          <button class="boton secundario" id="confirmCancel">${textoCancelar}</button>
          <button class="boton" id="confirmOk">${textoOk}</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);
    
    requestAnimationFrame(() => overlay.classList.add("confirm-show"));
    
    document.getElementById("confirmOk").addEventListener("click", () => {
      overlay.remove();
      resolve(true);
    });
    
    document.getElementById("confirmCancel").addEventListener("click", () => {
      overlay.remove();
      resolve(false);
    });
  });
}

// Cerrar sesión automáticamente después de inactividad
let inactividadTimer;
const INACTIVIDAD_LIMITE = 30 * 60 * 1000; // 30 minutos

function resetInactividad() {
  clearTimeout(inactividadTimer);
  inactividadTimer = setTimeout(() => {
    sessionStorage.removeItem("sesion_activa");
    if (window.location.pathname.includes("resultados")) {
      mostrarToast("Sesión expirada por inactividad", "warning");
      setTimeout(() => {
        window.location.href = "index.html";
      }, 2000);
    }
  }, INACTIVIDAD_LIMITE);
}

document.addEventListener("mousemove", resetInactividad);
document.addEventListener("keypress", resetInactividad);
document.addEventListener("click", resetInactividad);
