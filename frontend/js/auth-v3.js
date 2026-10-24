document.addEventListener("DOMContentLoaded", () => {
  const form = document.getElementById("formLogin");
  const formAdmin = document.getElementById("formAdmin");
  const mensaje = document.getElementById("mensajeLogin");
  const btnEstudiante = document.getElementById("btnEstudiante");
  const btnAdmin = document.getElementById("btnAdmin");
  const panelEstudiante = document.getElementById("panelEstudiante");
  const panelAdmin = document.getElementById("panelAdmin");

  document.getElementById("btnContinuar")?.addEventListener("click", () => {
    console.log("Botón INGRESAR clickeado");
    document.getElementById("pantallaBienvenida")?.classList.remove("activo");
    document.getElementById("pantallaAcceso")?.classList.add("activo");
    console.log("Pantallas cambiadas");
  });

  function activarRol(rol) {
    const esEstudiante = rol === "estudiante";
    btnEstudiante?.classList.toggle("activo", esEstudiante);
    btnAdmin?.classList.toggle("activo", !esEstudiante);
    panelEstudiante?.classList.toggle("activo", esEstudiante);
    panelAdmin?.classList.toggle("activo", !esEstudiante);
    mensaje.textContent = "";
    mensaje.className = "mensaje";
  }

  btnEstudiante?.addEventListener("click", () => activarRol("estudiante"));
  btnAdmin?.addEventListener("click", () => activarRol("admin"));
  activarRol("estudiante");

  form?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const codigo = document.getElementById("codigo").value.trim();
    if (!codigo) return mostrarError("Ingresa tu código estudiantil");

    try {
      const respuesta = await fetch("/api/auth/validar", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ codigo }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) return mostrarError(datos.motivo || "No puedes votar con este código.");
      await guardarEnStore("sesion", {
        clave: "actual", rol: "estudiante", codigo: datos.codigo, nombre: datos.nombre || `Estudiante ${datos.codigo}`, token: datos.token,
      });
      await eliminarDeStore("votosLocales", datos.codigo);
      window.location.href = "votar.html";
    } catch {
      mostrarError("No se pudo validar tu código en este momento.");
    }
  });

  formAdmin?.addEventListener("submit", async (evento) => {
    evento.preventDefault();
    const password = document.getElementById("passwordAdmin").value.trim();
    if (!password) return mostrarError("Ingresa la contraseña del administrador");
    try {
      const respuesta = await fetch("/api/auth/admin", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }),
      });
      const datos = await respuesta.json().catch(() => ({}));
      if (!respuesta.ok) return mostrarError(datos.motivo || "Contraseña incorrecta");
      await guardarEnStore("sesion", { clave: "actual", rol: "admin", codigo: "admin", nombre: "Administrador", token: datos.token });
      await eliminarDeStore("votosPendientes", "all");
      await eliminarDeStore("votosLocales", "all");
      window.location.href = "resultados.html";
    } catch {
      mostrarError("No se pudo iniciar sesión en este momento.");
    }
  });

  function mostrarError(texto) {
    mensaje.textContent = texto;
    mensaje.className = "mensaje error";
  }
});
