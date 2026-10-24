const path = require("path");
const fs = require("fs");
const XLSX = require("xlsx");

const CANDIDATOS_PATH = path.join(__dirname, "data", "candidatos.json");
const ESTUDIANTES_PATH = path.join(__dirname, "data", "estudiantes.json");
const VOTANTES_PATH = path.join(__dirname, "data", "votantes.json");
const VOTOS_PATH = path.join(__dirname, "data", "votos.json");
const EXCEL_PATH = path.join(__dirname, "data", "estudiantes.xlsx");
const ESTADO_PATH = path.join(__dirname, "data", "estado-votaciones.json");

function leerJSON(filePath) {
  try {
    const contenido = fs.readFileSync(filePath, "utf-8");
    return JSON.parse(contenido);
  } catch {
    return [];
  }
}

function escribirJSON(filePath, datos) {
  fs.writeFileSync(filePath, JSON.stringify(datos, null, 2), "utf-8");
}

function normalizarCodigo(valor) {
  if (valor === null || valor === undefined) return "";
  const texto = String(valor).trim();
  if (!texto) return "";
  const sinEspacios = texto.replace(/\s+/g, "");
  const limpio = sinEspacios.toUpperCase();
  if (/^\d+$/.test(limpio)) return String(Number(limpio));
  return limpio;
}

async function crearTablas() {
  // No-op for file-based storage
  console.log("Sistema de archivos listo");
}

async function obtenerCandidatos() {
  const rows = leerJSON(CANDIDATOS_PATH);
  return rows.map((row) => ({
    id: String(row.id),
    nombre: row.nombre,
    lista: row.lista || "",
    cargo: row.cargo,
    propuesta: row.propuesta || "",
    imagen: row.imagen || "",
    inspiracion: row.inspiracion || "",
  }));
}

async function guardarCandidatos(candidatos) {
  const resultados = candidatos.map((c, i) => ({
    id: String(c.id || `c${Date.now()}-${i}`),
    nombre: c.nombre,
    lista: c.lista || "",
    cargo: c.cargo,
    propuesta: c.propuesta || "",
    imagen: c.imagen || "",
    inspiracion: c.inspiracion || "",
  }));
  escribirJSON(CANDIDATOS_PATH, resultados);
  return resultados;
}

async function asegurarVotoEnBlanco() {
  const candidatos = await obtenerCandidatos();
  const existe = candidatos.find(c => c.nombre.toLowerCase() === "voto en blanco");
  if (!existe) {
    const nuevos = [...candidatos, {
      id: `voto-blanco-${Date.now()}`,
      nombre: "Voto en blanco",
      lista: "",
      cargo: "Voto en blanco",
      propuesta: "",
      imagen: "icons/candidatos/Voto-en-blanco.jpg",
      inspiracion: "",
    }];
    await guardarCandidatos(nuevos);
    console.log("Candidato 'Voto en blanco' creado automáticamente");
  }
}

async function obtenerEstudiantes() {
  return leerJSON(ESTUDIANTES_PATH);
}

async function obtenerVotantes() {
  return leerJSON(VOTANTES_PATH);
}

async function obtenerVotos() {
  return leerJSON(VOTOS_PATH).map((row) => ({
    id: String(row.id || row.id_voto),
    candidatoId: row.candidatoId || row.numero_lista || String(row.candidato),
    candidatoNombre: row.candidatoNombre || row.candidato,
    candidatoLista: row.candidatoLista || row.numero_lista || "",
    cargo: row.cargo,
    estudianteId: row.estudianteId || row.codigo_estudiante,
    creadoEn: row.creadoEn || row.fecha_hora,
  }));
}

async function guardarVotos(votos) {
  const existentes = leerJSON(VOTOS_PATH);
  const todos = [...existentes, ...votos.map((v, i) => ({
    id: v.id || `voto-${Date.now()}-${i}`,
    candidatoId: v.candidatoId,
    candidatoNombre: v.candidatoNombre,
    candidatoLista: v.candidatoLista,
    cargo: v.cargo,
    estudianteId: v.estudianteId,
    creadoEn: v.creadoEn || new Date(),
  }))];
  escribirJSON(VOTOS_PATH, todos);
}

async function leerEstudiantes() {
  try {
    const workbook = XLSX.readFile(EXCEL_PATH);
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    return XLSX.utils.sheet_to_json(sheet, { defval: "" });
  } catch (error) {
    try {
      return await obtenerEstudiantes();
    } catch (fallbackError) {
      console.error("No se pudo leer la lista de estudiantes:", error.message);
      return [];
    }
  }
}

function leerEstado() {
  try {
    const contenido = fs.readFileSync(ESTADO_PATH, "utf-8");
    return JSON.parse(contenido);
  } catch {
    return { abierto: true, gradosPermitidos: [], sedesPermitidas: [] };
  }
}

function escribirEstado(estado) {
  fs.writeFileSync(ESTADO_PATH, JSON.stringify(estado, null, 2), "utf-8");
}

function estaAbierto() {
  const estado = leerEstado();
  return estado.abierto === true || estado.abierto === "true";
}

function obtenerGradosPermitidos() {
  const estado = leerEstado();
  return Array.isArray(estado.gradosPermitidos) ? estado.gradosPermitidos : [];
}

function obtenerSedesPermitidas() {
  const estado = leerEstado();
  return Array.isArray(estado.sedesPermitidas) ? estado.sedesPermitidas : [];
}

function gradoPermitido(grado) {
  const permitidos = obtenerGradosPermitidos();
  if (!permitidos.length) return true;
  return permitidos.some((g) => String(g).toUpperCase() === String(grado).toUpperCase());
}

function sedePermitida(sede) {
  const permitidas = obtenerSedesPermitidas();
  if (!permitidas.length) return true;
  return permitidas.some((s) => String(s).toUpperCase() === String(sede).toUpperCase());
}

function cerrarVotaciones() {
  escribirEstado({ abierto: false, gradosPermitidos: [], sedesPermitidas: [] });
}

function abrirVotaciones(grados = [], sedes = []) {
  escribirEstado({ abierto: true, gradosPermitidos: grados, sedesPermitidas: sedes });
}

module.exports = {
  pool: null,
  crearTablas,
  obtenerCandidatos,
  guardarCandidatos,
  obtenerEstudiantes,
  obtenerVotantes,
  obtenerVotos,
  guardarVotos,
  leerEstudiantes,
  normalizarCodigo,
  leerEstado,
  escribirEstado,
  estaAbierto,
  cerrarVotaciones,
  abrirVotaciones,
  obtenerGradosPermitidos,
  obtenerSedesPermitidas,
  gradoPermitido,
  sedePermitida,
  asegurarVotoEnBlanco,
};