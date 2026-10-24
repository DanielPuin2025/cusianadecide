const express = require("express");
const fs = require("fs");
const path = require("path");
const XLSX = require("xlsx");
const multer = require("multer");
const { obtenerCandidatos, guardarCandidatos } = require("../db");

const upload = multer({ storage: multer.memoryStorage() });

function crearRouter(requerirRol) {
  const router = express.Router();

  router.get("/", async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      // Ordenar: "Voto en blanco" siempre al final
      const ordenados = [...candidatos].sort((a, b) => {
        const aEsBlanco = a.nombre.toLowerCase() === "voto en blanco";
        const bEsBlanco = b.nombre.toLowerCase() === "voto en blanco";
        if (aEsBlanco && !bEsBlanco) return 1;
        if (!aEsBlanco && bEsBlanco) return -1;
        return 0;
      });
      res.json(ordenados);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al obtener candidatos", error: error.message });
    }
  });

  router.post("/sync", requerirRol("admin"), async (req, res) => {
    try {
      const fs = require("fs");
      const rutaJSON = path.join(__dirname, "..", "data", "candidatos.json");
      const candidatos = JSON.parse(fs.readFileSync(rutaJSON, "utf-8"));
      const guardados = await guardarCandidatos(candidatos);
      res.json({ ok: true, total: guardados.length, candidatos: guardados });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al sincronizar candidatos", error: error.message });
    }
  });

  router.get("/exportar", requerirRol("admin"), async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      // Filtrar por ID si se proporciona (query param: id=xxx)
      let candidatosAExportar = candidatos;
      if (req.query.id) {
        const id = req.query.id.trim();
        const candidato = candidatos.find(c => c.id === id);
        if (!candidato) {
          return res.status(404).json({ mensaje: "Candidato no encontrado" });
        }
        candidatosAExportar = [candidato];
      }
      const datos = candidatosAExportar.map((c) => ({
        ID: c.id,
        NOMBRE: c.nombre,
        LISTA: c.lista,
        CARGO: c.cargo,
        PROPUESTA: c.propuesta,
        IMAGEN: c.imagen || "",
        INSPIRACION: c.inspiracion || "",
      }));
      const libro = XLSX.utils.json_to_sheet(datos);
      libro["!cols"] = [
        { wch: 10 },
        { wch: 35 },
        { wch: 20 },
        { wch: 25 },
        { wch: 40 },
        { wch: 30 },
        { wch: 30 },
      ];
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, libro, "Candidatos");
      const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
      res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      res.setHeader("Content-Disposition", 'attachment; filename="candidato.xlsx"');
      res.setHeader("Content-Length", buffer.length);
      res.status(200).send(buffer);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al exportar candidato", error: error.message });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      const candidato = candidatos.find((c) => c.id === req.params.id);
      if (!candidato) {
        return res.status(404).json({ mensaje: "Candidato no encontrado" });
      }
      res.json(candidato);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al obtener candidato", error: error.message });
    }
  });

  router.post("/", requerirRol("admin"), async (req, res) => {
    try {
      const candidato = req.body;
      const esVotoEnBlanco = (candidato.nombre || "").trim().toLowerCase() === "voto en blanco";
      
      if (esVotoEnBlanco) {
        // Para "Voto en blanco" solo se requiere el nombre
        const candidatos = await obtenerCandidatos();
        // Verificar si ya existe uno
        const existe = candidatos.find(c => c.nombre.toLowerCase() === "voto en blanco");
        if (existe) {
          return res.status(400).json({ ok: false, motivo: "Ya existe un candidato 'Voto en blanco'." });
        }
        candidatos.push({
          id: `voto-blanco-${Date.now()}`,
          nombre: "Voto en blanco",
          lista: "",
          cargo: "Voto en blanco",
          propuesta: "",
          imagen: "",
          inspiracion: "",
        });
        const guardados = await guardarCandidatos(candidatos);
        const nuevo = guardados[guardados.length - 1];
        return res.status(201).json(nuevo);
      }
      
      const camposRequeridos = ["nombre", "lista", "cargo", "propuesta"];
      if (camposRequeridos.some((campo) => !String(candidato[campo] || "").trim())) {
        return res.status(400).json({ ok: false, motivo: "Completa nombre, número de lista, cargo y propuesta." });
      }
      // Verificar que no exista un candidato con el mismo nombre
      const candidatosExistentes = await obtenerCandidatos();
      const nombreNormalizado = candidato.nombre.trim().toLowerCase();
      const existeNombre = candidatosExistentes.find(c => c.nombre.trim().toLowerCase() === nombreNormalizado);
      if (existeNombre) {
        return res.status(400).json({ ok: false, motivo: `Ya existe un candidato con el nombre "${candidato.nombre}".` });
      }
      // Verificar que no exista un candidato con el mismo número de lista
      const listaNormalizada = String(candidato.lista).trim();
      const existeLista = candidatosExistentes.find(c => String(c.lista).trim() === listaNormalizada);
      if (existeLista) {
        return res.status(400).json({ ok: false, motivo: `Ya existe un candidato con el número de lista "${candidato.lista}".` });
      }
      const candidatos = await obtenerCandidatos();
      candidatos.push({
        id: candidato.id || `c${Date.now()}`,
        nombre: candidato.nombre || "",
        lista: listaNormalizada,
        cargo: candidato.cargo || "",
        propuesta: candidato.propuesta || "",
        imagen: candidato.imagen || "",
        inspiracion: candidato.inspiracion || "",
      });
      const guardados = await guardarCandidatos(candidatos);
      const nuevo = guardados[guardados.length - 1];
      res.status(201).json(nuevo);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al crear candidato", error: error.message });
    }
  });

  router.post("/importar", requerirRol("admin"), upload.single("archivo"), async (req, res) => {
    try {
      let candidatos = [];
      if (req.body.datos) {
        const datos = typeof req.body.datos === "string" ? JSON.parse(req.body.datos) : req.body.datos;
        candidatos = Array.isArray(datos) ? datos : [datos];
      } else if (req.file) {
        const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        candidatos = XLSX.utils.sheet_to_json(sheet, { defval: "" });
      } else {
        return res.status(400).json({ mensaje: "No se recibió archivo ni datos JSON" });
      }

      const existentes = await obtenerCandidatos();
      const idsExistentes = new Set(existentes.map((c) => c.id));
      const listasExistentes = new Set(existentes.map((c) => String(c.lista).trim()).filter(Boolean));
      const nuevos = [];
      for (const candidato of candidatos) {
        const id = candidato.id || `c${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
        if (idsExistentes.has(id)) continue;
        const CamposRequeridos = ["nombre", "lista", "cargo", "propuesta"];
        if (CamposRequeridos.some((campo) => !String(candidato[campo] || "").trim())) continue;
        const listaNormalizada = String(candidato.lista).trim();
        if (listasExistentes.has(listaNormalizada)) continue;
        idsExistentes.add(id);
        listasExistentes.add(listaNormalizada);
        nuevos.push({
          id,
          nombre: candidato.nombre || "",
          lista: listaNormalizada,
          cargo: candidato.cargo || "",
          propuesta: candidato.propuesta || "",
          imagen: candidato.imagen || "",
          inspiracion: candidato.inspiracion || "",
        });
      }
      const actualizados = [...existentes, ...nuevos];
      const guardados = await guardarCandidatos(actualizados);
      res.json({ ok: true, importados: nuevos.length, total: guardados.length });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al importar candidatos", error: error.message });
    }
  });

  router.put("/:id", requerirRol("admin"), async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      const index = candidatos.findIndex((c) => c.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ mensaje: "Candidato no encontrado" });
      }
      
      // Verificar si es "Voto en blanco"
      const esVotoEnBlanco = candidatos[index].nombre.toLowerCase() === "voto en blanco";
      const actualizacion = req.body || {};
      
      if (esVotoEnBlanco) {
        // Para "Voto en blanco" solo permitir cambiar el nombre (y mantenerlo como "Voto en blanco")
        if (actualizacion.nombre && actualizacion.nombre.trim().toLowerCase() !== "voto en blanco") {
          return res.status(400).json({ ok: false, motivo: "El nombre 'Voto en blanco' no se puede cambiar." });
        }
        // Solo actualizar nombre e imagen, mantener lista/cargo/propuesta fijos
        candidatos[index] = { 
          ...candidatos[index], 
          nombre: "Voto en blanco",
          lista: "",
          cargo: "Voto en blanco",
          propuesta: "",
          imagen: actualizacion.imagen || candidatos[index].imagen || "",
          inspiracion: actualizacion.inspiracion || candidatos[index].inspiracion || "",
          id: candidatos[index].id 
        };
      } else {
        const camposRequeridos = ["nombre", "lista", "cargo", "propuesta"];
        if (camposRequeridos.some((campo) => !String(actualizacion[campo] || "").trim())) {
          return res.status(400).json({ ok: false, motivo: "Completa nombre, número de lista, cargo y propuesta." });
        }
        // Verificar que no intente cambiar a "Voto en blanco"
        if (actualizacion.nombre && actualizacion.nombre.trim().toLowerCase() === "voto en blanco") {
          return res.status(400).json({ ok: false, motivo: "Ya existe un candidato 'Voto en blanco'." });
        }
        // Verificar que no exista otro candidato con el mismo nombre (excluyendo al actual)
        const nombreNuevo = actualizacion.nombre.trim().toLowerCase();
        const existeOtro = candidatos.find((c, i) => i !== index && c.nombre.trim().toLowerCase() === nombreNuevo);
        if (existeOtro) {
          return res.status(400).json({ ok: false, motivo: `Ya existe un candidato con el nombre "${actualizacion.nombre}".` });
        }
        // Verificar que no exista otro candidato con el mismo número de lista (excluyendo al actual)
        const listaNueva = String(actualizacion.lista).trim();
        const existeLista = candidatos.find((c, i) => i !== index && String(c.lista).trim() === listaNueva);
        if (existeLista) {
          return res.status(400).json({ ok: false, motivo: `Ya existe un candidato con el número de lista "${actualizacion.lista}".` });
        }
        candidatos[index] = { ...candidatos[index], ...actualizacion, id: candidatos[index].id, lista: listaNueva };
      }
      const guardados = await guardarCandidatos(candidatos);
      res.json(guardados[index]);
    } catch (error) {
      res.status(500).json({ mensaje: "Error al actualizar candidato", error: error.message });
    }
  });

  router.delete("/:id", requerirRol("admin"), async (req, res) => {
    try {
      const candidatos = await obtenerCandidatos();
      const index = candidatos.findIndex((c) => c.id === req.params.id);
      if (index === -1) {
        return res.status(404).json({ mensaje: "Candidato no encontrado" });
      }
      
      // Verificar si es "Voto en blanco"
      if (candidatos[index].nombre.toLowerCase() === "voto en blanco") {
        return res.status(400).json({ ok: false, motivo: "No se puede eliminar el candidato 'Voto en blanco'." });
      }
      
      const filtrados = candidatos.filter((c) => c.id !== req.params.id);
      await guardarCandidatos(filtrados);
      res.json({ ok: true });
    } catch (error) {
      res.status(500).json({ mensaje: "Error al eliminar candidato", error: error.message });
    }
  });

  return router;
}

module.exports = crearRouter;
