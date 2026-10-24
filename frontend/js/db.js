// Manejo de almacenamiento local (localStorage) para que la app funcione offline
const NOMBRE_DB = "VotacionesDB";
const VERSION_DB = 1;
const URL_API = "/api";

function abrirDB() {
  return Promise.resolve();
}

function _claveValor(valor) {
  return valor.clave || valor.id || valor.localId || valor.estudianteId;
}

async function guardarEnStore(nombreStore, valor) {
  const clave = _claveValor(valor);
  const data = JSON.parse(localStorage.getItem(nombreStore) || "[]");
  if (clave !== undefined && clave !== "") {
    const idx = data.findIndex((item) => String(_claveValor(item)) === String(clave));
    if (idx >= 0) data[idx] = valor;
    else data.push(valor);
  } else {
    data.push(valor);
  }
  localStorage.setItem(nombreStore, JSON.stringify(data));
}

async function obtenerDeStore(nombreStore, clave) {
  const data = JSON.parse(localStorage.getItem(nombreStore) || "[]");
  return data.find((item) => String(_claveValor(item)) === String(clave)) || null;
}

async function obtenerTodoDeStore(nombreStore) {
  return JSON.parse(localStorage.getItem(nombreStore) || "[]");
}

async function eliminarDeStore(nombreStore, clave) {
  if (clave === "all") {
    localStorage.removeItem(nombreStore);
    return;
  }
  const data = JSON.parse(localStorage.getItem(nombreStore) || "[]");
  const filtered = data.filter((item) => String(_claveValor(item)) !== String(clave));
  localStorage.setItem(nombreStore, JSON.stringify(filtered));
}
