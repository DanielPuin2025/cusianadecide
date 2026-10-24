const express = require("express");
const { obtenerVotos, guardarVotos, obtenerCandidatos, leerEstudiantes, normalizarCodigo, estaAbierto, gradoPermitido, sedePermitida, obtenerGradosPermitidos, obtenerSedesPermitidas } = require("../db");

function crearRouter(requerirRol) {
  const router = express.Router();

  async function yaVoto(estudianteId, cargo) {
    const votos = await obtenerVotos();
    return votos.some((v) => v.estudianteId === estudianteId && v.cargo === cargo);
  }

async function registrarVoto(estudianteId, candidatoId, nombreEstudiante) {
    if (!estaAbierto()) {
      return { ok: false, motivo: "Las votaciones están cerradas." };
    }
    // Obtener el grado y sede del estudiante
    const estudiantes = await leerEstudiantes();
    const estudiante = estudiantes.find((item) => normalizarCodigo(item.CODIGO || item.codigo || item.Codigo || item.codigo_estudiante) === normalizarCodigo(estudianteId));
    const grado = estudiante?.GRADO || estudiante?.grado || estudiante?.Grado || "";
    const sede = estudiante?.SEDE || estudiante?.sede || estudiante?.Sede || "";
    if (!gradoPermitido(grado)) {
      const permitidos = obtenerGradosPermitidos();
      return { ok: false, motivo: `Tu grado (${grado || "sin grado"}) no está habilitado para votar. Grados permitidos: ${permitidos.join(", ") || "ninguno"}.` };
    }
    if (!sedePermitida(sede)) {
      const permitidas = obtenerSedesPermitidas();
      return { ok: false, motivo: `Tu sede (${sede || "sin sede"}) no está habilitada para votar. Sedes permitidas: ${permitidas.join(", ") || "ninguna"}.` };
    }
    const candidatos = await obtenerCandidatos();
    const candidato = candidatos.find((c) => c.id === String(candidatoId));
    if (!candidato) {
      return { ok: false, motivo: "Candidato no existe" };
    }
    const cargo = candidato.cargo;
    const existe = await yaVoto(estudianteId, cargo);
    if (existe) {
      return { ok: false, motivo: "El estudiante ya votó para este cargo" };
    }
    await guardarVotos([{
      estudianteId,
      nombreEstudiante: nombreEstudiante || "",
      candidatoNombre: candidato.nombre,
      candidatoLista: candidato.lista,
      cargo,
      creadoEn: new Date(),
    }]);
    console.log(`Voto guardado -> estudiante: ${estudianteId}, candidato: ${candidato.nombre}, cargo: ${cargo}`);
    return { ok: true };
  }

  router.get("/", requerirRol("admin"), async (req, res) => {
    try {
      const votos = await obtenerVotos();
      res.json(votos);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al obtener votos", error: error.message });
    }
  });

  router.get("/exportar", requerirRol("admin"), async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      const candidatosPorId = new Map(candidatos.map((c) => [c.id, c]));
      const estudiantes = await leerEstudiantes();
      const estudiantesPorCodigo = new Map(
        estudiantes.map((item) => [normalizarCodigo(item.CODIGO || item.codigo || item.Codigo || item.codigo_estudiante), item])
      );
      const escaparCSV = (valor) => `"${String(valor ?? "").replace(/"/g, '""').replace(/\r?\n/g, ' ')}"`;
      const separador = ";";
      const formatearFecha = (fecha) => {
        if (!fecha) return "";
        const f = new Date(fecha);
        if (isNaN(f)) return String(fecha);
        const pad = (n) => String(n).padStart(2, "0");
        return `${pad(f.getDate())}/${pad(f.getMonth() + 1)}/${f.getFullYear()} ${pad(f.getHours())}:${pad(f.getMinutes())}:${pad(f.getSeconds())}`;
      };
      const votos = await obtenerVotos();
      const filas = votos.map((voto) => {
        const candidato = candidatosPorId.get(voto.candidatoId) || {};
        const estudiante = estudiantesPorCodigo.get(voto.estudianteId) || {};
        return [
          voto.id,
          formatearFecha(voto.creadoEn),
          voto.estudianteId,
          estudiante.NOMBRE || estudiante.nombre || "",
          candidato.nombre || voto.candidatoNombre || "Candidato eliminado",
          candidato.lista || voto.candidatoLista || "",
          voto.cargo || candidato.cargo || "",
        ].map(escaparCSV).join(separador);
      });
      const contenido = [
        `ID voto${separador}Fecha y hora${separador}Codigo estudiante${separador}Nombre estudiante${separador}Candidato${separador}Numero o lista${separador}Cargo`,
        ...filas,
      ].join("\n");
      const fecha = new Date().toISOString().slice(0, 10);
      res.setHeader("Content-Type", "text/csv; charset=utf-8-sig");
      res.setHeader("Content-Disposition", `attachment; filename=registros-votacion-${fecha}.csv`);
      res.send(`\uFEFF${contenido}`);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al exportar votos", error: error.message });
    }
  });

  router.post("/", requerirRol("estudiante"), async (req, res) => {
    try {
      if (!estaAbierto()) {
        return res.status(403).json({ ok: false, motivo: "Las votaciones están cerradas." });
      }
      const { candidatoId } = req.body;
      if (!candidatoId) {
        return res.status(400).json({ ok: false, motivo: "Datos incompletos" });
      }
      const resultado = await registrarVoto(req.usuario.codigo, candidatoId, req.usuario.nombre);
      if (!resultado.ok) {
        return res.status(409).json(resultado);
      }
      res.status(201).json({ ok: true });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al registrar voto", error: error.message });
    }
  });

  router.post("/sync", requerirRol("estudiante"), async (req, res) => {
    try {
      if (!estaAbierto()) {
        return res.status(403).json({ ok: false, motivo: "Las votaciones están cerradas." });
      }
      const votosOffline = Array.isArray(req.body.votos) ? req.body.votos : [];
      const resultados = [];
      for (const v of votosOffline) {
        const resultado = await registrarVoto(req.usuario.codigo, v.candidatoId, req.usuario.nombre);
        resultados.push({ localId: v.localId, ...resultado });
      }
      const tieneErrores = resultados.some((r) => !r.ok);
      res.status(tieneErrores ? 207 : 200).json({ resultados });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al sincronizar votos", error: error.message });
    }
  });

  router.post("/reset", requerirRol("admin"), async (req, res) => {
    try {
      require("fs").writeFileSync(
        require("path").join(__dirname, "..", "data", "votos.json"),
        "[]",
        "utf-8"
      );
      res.json({ ok: true, motivo: "Votaciones reiniciadas correctamente" });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al reiniciar votaciones", error: error.message });
    }
  });

  router.get("/resultados", requerirRol("admin"), async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      const votos = await obtenerVotos();
      const conteo = candidatos.map((c) => {
        const votosCandidato = votos.filter((v) => v.candidatoId === c.id || v.candidatoNombre === c.nombre);
        return { ...c, votos: votosCandidato.length };
      });
      res.json(conteo);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al obtener resultados", error: error.message });
    }
  });

  return router;
}

module.exports = { crearRouter };