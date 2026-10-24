// Muestra si la app está en línea o sin conexión, y avisa a otros scripts

function actualizarBadgeConexion() {
  const badge = document.getElementById("estadoConexion");
  if (!badge) return;
  if (navigator.onLine) {
    badge.textContent = "En línea";
    badge.className = "badge en-linea";
  } else {
    badge.textContent = "Sin conexión (modo offline)";
    badge.className = "badge sin-conexion";
  }
}

window.addEventListener("online", actualizarBadgeConexion);
window.addEventListener("offline", actualizarBadgeConexion);
document.addEventListener("DOMContentLoaded", actualizarBadgeConexion);
