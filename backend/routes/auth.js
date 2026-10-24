const express = require("express");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const XLSX = require("xlsx");
const multer = require("multer");
const { leerEstudiantes, normalizarCodigo, estaAbierto, obtenerVotos, obtenerGradosPermitidos, gradoPermitido, obtenerSedesPermitidas, sedePermitida } = require("../db");

const router = express.Router();

const EXCEL_PATH = path.join(__dirname, "..", "data", "estudiantes.xlsx");
const JSON_PATH = path.join(__dirname, "..", "data", "estudiantes.json");
const sesiones = new Map();
const ADMIN_CODE = "202616";

const upload = multer({ storage: multer.memoryStorage() });

// Rate limiting
const rateLimits = new Map();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minuto
const RATE_LIMIT_MAX = 10; // máximo 10 intentos por minuto

// Sesiones con expiración (30 minutos)
const SESION_EXPIRACION = 30 * 60 * 1000;

function verificarRateLimit(ip) {
  const ahora = Date.now();
  const registro = rateLimits.get(ip);
  
  if (!registro) {
    rateLimits.set(ip, { intentos: 1, inicio: ahora });
    return true;
  }
  
  if (ahora - registro.inicio > RATE_LIMIT_WINDOW) {
    rateLimits.set(ip, { intentos: 1, inicio: ahora });
    return true;
  }
  
  if (registro.intentos >= RATE_LIMIT_MAX) {
    return false;
  }
  
  registro.intentos++;
  return true;
}

function limpiarSesionesExpiradas() {
  const ahora = Date.now();
  for (const [token, sesion] of sesiones.entries()) {
    if (ahora - sesion.creadoEn > SESION_EXPIRACION) {
      sesiones.delete(token);
    }
  }
}

// Limpiar sesiones expiradas cada 5 minutos
setInterval(limpiarSesionesExpiradas, 5 * 60 * 1000);

function normalizarTexto(valor) {
  return String(valor ?? "")
    .trim()
    .toUpperCase();
}

async function leerEstudiantesAuth() {
  console.log("Leyendo estudiantes...");
  const datos = await leerEstudiantes();
  console.log("Estudiantes cargados:", datos.length);
  return datos;
}

async function validarCodigo(codigo) {
  if (!codigo) {
    return { ok: false, motivo: "Código requerido" };
  }

  const estudiantes = await leerEstudiantesAuth();
  const codigosDisponibles = estudiantes.map((item) => normalizarCodigo(item.CODIGO || item.codigo || item.Codigo || item.codigo_estudiante)).filter(Boolean);
  console.log("Códigos disponibles (primeros 10):", codigosDisponibles.slice(0, 10));
  
  const estudiante = estudiantes.find((item) => {
    const codigoExcel = normalizarCodigo(item.CODIGO || item.codigo || item.Codigo || item.codigo_estudiante);
    const codigoNormalizado = normalizarCodigo(codigo);
    const coincide = codigoExcel === codigoNormalizado;
    if (coincide) {
      console.log("Código coincidente encontrado:", codigoExcel);
    }
    return coincide;
  });

  if (!estudiante) {
    console.log("Código no encontrado:", codigo);
    return {
      ok: false,
      motivo: "Tu código no está registrado en la lista de estudiantes.",
    };
  }

  // Verificar si ya votó (consultar archivos JSON)
  const codigoNormalizado = normalizarCodigo(codigo);
  const votosPrevios = await obtenerVotos();
  const yaVoto = votosPrevios.some((v) => v.estudianteId === codigoNormalizado);
  if (yaVoto) {
    return {
      ok: false,
      motivo: "Este código ya ha utilizado su voto. No puede volver a votar.",
    };
  }

  return {
    ok: true,
    codigo: normalizarCodigo(codigo),
    nombre: estudiante.NOMBRE || estudiante.nombre || estudiante.Nombre || "Estudiante",
    grado: estudiante.GRADO || estudiante.grado || estudiante.Grado || "",
    sede: estudiante.SEDE || estudiante.sede || estudiante.Sede || "",
  };
}

function crearSesion(datos) {
  const token = crypto.randomBytes(32).toString("hex");
  sesiones.set(token, { ...datos, creadoEn: Date.now() });
  return token;
}

function requerirRol(rol) {
  return (req, res, next) => {
    const token = req.get("Authorization")?.replace(/^Bearer\s+/i, "");
    const sesion = token && sesiones.get(token);
    if (!sesion || sesion.rol !== rol) {
      return res.status(401).json({ ok: false, motivo: "No autorizado" });
    }
    // Verificar expiración de sesión
    if (Date.now() - sesion.creadoEn > SESION_EXPIRACION) {
      sesiones.delete(token);
      return res.status(401).json({ ok: false, motivo: "Sesión expirada. Vuelve a iniciar sesión." });
    }
    req.usuario = sesion;
    next();
  };
}

// Middleware de rate limiting
function rateLimiter(req, res, next) {
  const ip = req.ip || req.connection.remoteAddress || "unknown";
  if (!verificarRateLimit(ip)) {
    return res.status(429).json({ ok: false, motivo: "Demasiados intentos. Espera un minuto." });
  }
  next();
}

router.post("/validar", rateLimiter, async (req, res) => {
  try {
    const codigo = normalizarTexto(req.body.codigo);
    console.log("Intento de ingreso recibido");

    if (codigo === ADMIN_CODE) {
      const token = crearSesion({ rol: "admin", codigo: "admin", nombre: "Administrador" });
      return res.json({ ok: true, rol: "admin", token, nombre: "Administrador", codigo: "admin" });
    }

    if (!estaAbierto()) {
      return res.status(403).json({ ok: false, motivo: "Las votaciones están cerradas en este momento." });
    }

    const resultado = await validarCodigo(codigo);
    console.log("Resultado validación:", resultado);

    if (!resultado.ok) {
      return res.status(403).json(resultado);
    }

    // Verificar si el grado del estudiante está permitido para votar
    if (!gradoPermitido(resultado.grado)) {
      const permitidos = obtenerGradosPermitidos();
      return res.status(403).json({ 
        ok: false, 
        motivo: `Tu grado (${resultado.grado || "sin grado"}) no está habilitado para votar en este momento. Grados permitidos: ${permitidos.join(", ") || "ninguno"}.` 
      });
    }

    // Verificar si la sede del estudiante está permitida para votar
    if (!sedePermitida(resultado.sede)) {
      const permitidas = obtenerSedesPermitidas();
      return res.status(403).json({ 
        ok: false, 
        motivo: `Tu sede (${resultado.sede || "sin sede"}) no está habilitada para votar en este momento. Sedes permitidas: ${permitidas.join(", ") || "ninguna"}.` 
      });
    }

    const token = crearSesion({
      rol: "estudiante",
      codigo: resultado.codigo,
      nombre: resultado.nombre,
    });
    console.log("Token creado para:", resultado.codigo);
    return res.json({ ...resultado, token });
  } catch (error) {
    console.error("Error en validación:", error);
    res.status(500).json({ ok: false, motivo: "Error al validar código", error: error.message });
  }
});

router.post("/logout", (req, res) => {
  const token = req.get("Authorization")?.replace(/^Bearer\s+/i, "");
  if (token) sesiones.delete(token);
  res.json({ ok: true });
});

router.get("/estudiantes/exportar", requerirRol("admin"), async (req, res) => {
  try {
    const estudiantes = await leerEstudiantes();
    console.log("Estudiantes cargados:", estudiantes.length);
    const datos = estudiantes.map((item) => ({
      CODIGO: item.CODIGO || item.codigo || item.Codigo || item.codigo_estudiante || "",
      NOMBRE: item.NOMBRE || item.nombre || item.Nombre || "",
      DOCUMENTO: item.DOCUMENTO || item.documento || item.Documento || "",
      GRADO: item.GRADO || item.grado || item.Grado || "",
      SEDE: item.SEDE || item.sede || item.Sede || "",
    }));
    console.log("Datos procesados:", datos.length);
    const libro = XLSX.utils.json_to_sheet(datos);
    libro["!cols"] = [
      { wch: 12 },
      { wch: 45 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
    ];
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, libro, "Estudiantes");
    const archivo = path.join(__dirname, "..", "data", "estudiantes-export.xlsx");
    console.log("Guardando en:", archivo);
    XLSX.writeFile(workbook, archivo);
    console.log("Archivo guardado correctamente");
    res.download(archivo, "estudiantes.xlsx");
  } catch (error) {
    console.error("Error exportando estudiantes:", error.message);
    console.error(error.stack);
    res.status(500).json({ ok: false, motivo: "No se pudo exportar el listado de estudiantes." });
  }
});

router.post("/estudiantes/importar", requerirRol("admin"), upload.single("archivo"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ ok: false, motivo: "No se recibió archivo" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const estudiantes = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    if (!estudiantes.length) {
      return res.status(400).json({ ok: false, motivo: "El archivo no contiene datos" });
    }

    // Normalize and validate student data
    const estudiantesNormalizados = estudiantes.map((item) => ({
      CODIGO: item.CODIGO || item.codigo || item.Codigo || item.codigo_estudiante || "",
      NOMBRE: item.NOMBRE || item.nombre || item.Nombre || "",
      DOCUMENTO: item.DOCUMENTO || item.documento || item.Documento || "",
      GRADO: item.GRADO || item.grado || item.Grado || "",
      SEDE: item.SEDE || item.sede || item.Sede || "",
    })).filter((e) => e.CODIGO && e.NOMBRE);

    if (!estudiantesNormalizados.length) {
      return res.status(400).json({ ok: false, motivo: "No se encontraron estudiantes válidos (requiere CODIGO y NOMBRE)" });
    }

    // Write to Excel file (overwrites existing)
    const libro = XLSX.utils.json_to_sheet(estudiantesNormalizados);
    libro["!cols"] = [
      { wch: 12 },
      { wch: 45 },
      { wch: 18 },
      { wch: 10 },
      { wch: 14 },
    ];
    const workbookOut = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbookOut, libro, "Estudiantes");
    XLSX.writeFile(workbookOut, EXCEL_PATH);

    // Also update JSON backup
    const JSON_PATH = path.join(__dirname, "..", "data", "estudiantes.json");
    fs.writeFileSync(JSON_PATH, JSON.stringify(estudiantesNormalizados, null, 2), "utf-8");

    console.log(`Importados ${estudiantesNormalizados.length} estudiantes`);
    res.json({ ok: true, importados: estudiantesNormalizados.length, mensaje: `Se importaron ${estudiantesNormalizados.length} estudiantes correctamente.` });
  } catch (error) {
    console.error("Error importando estudiantes:", error.message);
    console.error(error.stack);
    res.status(500).json({ ok: false, motivo: "No se pudo importar el listado de estudiantes.", error: error.message });
  }
});

// Agregar un nuevo estudiante
router.post("/estudiantes/agregar", requerirRol("admin"), async (req, res) => {
  try {
    const nombre = String(req.body?.nombre || "").trim();
    const grado = String(req.body?.grado || "").trim();
    const sede = String(req.body?.sede || "").trim();
    if (!nombre || !grado || !sede) {
      return res.status(400).json({ ok: false, motivo: "Faltan datos requeridos (nombre, grado, sede)." });
    }

    let workbook;
    try { workbook = XLSX.readFile(EXCEL_PATH); } catch { workbook = XLSX.utils.book_new(); }
    const sheetName = workbook.SheetNames[0] || "Estudiantes";
    const sheet = workbook.Sheets[sheetName] || XLSX.utils.json_to_sheet([]);
    const estudiantes = XLSX.utils.sheet_to_json(sheet, { defval: "" });

    const gNorm = grado.trim().toUpperCase();
    const sedeNorm = sede.trim().toUpperCase();

    // Buscar primer cuadro vacio (NOMBRE vacio) del mismo grado/grupo
    let idx = -1;
    for (let i = 0; i < estudiantes.length; i++) {
      const g = String(estudiantes[i].GRADO || estudiantes[i].grado || "").trim().toUpperCase();
      if (g !== gNorm) continue;
      const n = String(estudiantes[i].NOMBRE || estudiantes[i].nombre || "").trim();
      if (!n) { idx = i; break; }
    }

    let nuevoCodigo;
    if (idx >= 0) {
      // Ocupar cuadro existente, mantener su CODIGO
      nuevoCodigo = String(estudiantes[idx].CODIGO || estudiantes[idx].codigo || estudiantes[idx].Codigo || "").trim();
      estudiantes[idx].NOMBRE = nombre.toUpperCase();
      estudiantes[idx].SEDE = sedeNorm;
    } else {
      // Todos los cuadros del grado ocupados -> nueva fila al final de esa seccion
      let ultimoNumero = 0;
      for (const e of estudiantes) {
        const c = String(e.CODIGO || e.codigo || e.Codigo || "").trim();
        const m = c.match(/(\d+)$/);
        if (m) { const n = parseInt(m[1],10); if (!isNaN(n) && n > ultimoNumero) ultimoNumero = n; }
      }
      nuevoCodigo = String(ultimoNumero + 1).padStart(5, "0");

      const nueva = {
        CODIGO: nuevoCodigo,
        NOMBRE: nombre.toUpperCase(),
        DOCUMENTO: "",
        GRADO: gNorm,
        SEDE: sedeNorm,
      };

      let insercion = estudiantes.length;
      for (let i = 0; i < estudiantes.length; i++) {
        const g = String(estudiantes[i].GRADO || estudiantes[i].grado || "").trim().toUpperCase();
        if (g && g > gNorm) { insercion = i; break; }
      }
      estudiantes.splice(insercion, 0, nueva);
    }

    // Persistir Excel
    const libro = XLSX.utils.json_to_sheet(estudiantes);
    libro["!cols"] = [{ wch: 12 }, { wch: 45 }, { wch: 18 }, { wch: 12 }, { wch: 14 }];
    if (!workbook.SheetNames.length) XLSX.utils.book_append_sheet(workbook, libro, sheetName);
    else workbook.Sheets[sheetName] = libro;
    XLSX.writeFile(workbook, EXCEL_PATH);

    // Persistir JSON backup
    const jsonNorm = estudiantes.map((it) => ({
      CODIGO: it.CODIGO || it.codigo || it.Codigo || "",
      NOMBRE: it.NOMBRE || it.nombre || it.Nombre || "",
      DOCUMENTO: it.DOCUMENTO || it.documento || it.Documento || "",
      GRADO: it.GRADO || it.grado || it.Grado || "",
      SEDE: it.SEDE || it.sede || it.Sede || "",
    }));
    fs.writeFileSync(path.join(__dirname, "..", "data", "estudiantes.json"), JSON.stringify(jsonNorm, null, 2), "utf-8");

    const numero = parseInt(String(nuevoCodigo).replace(/\D/g, ""), 10) || 0;
    res.json({ ok: true, codigo: nuevoCodigo, numero, mensaje: "Estudiante agregado correctamente." });
  } catch (error) {
    console.error("Error agregando estudiante:", error);
    res.status(500).json({ ok: false, motivo: "No se pudo agregar el estudiante.", error: error.message });
  }
});

module.exports = { router, requerirRol, normalizarCodigo };
