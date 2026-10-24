const path = require("path");
const express = require("express");
const cors = require("cors");
const { crearTablas, estaAbierto, cerrarVotaciones, abrirVotaciones, asegurarVotoEnBlanco, obtenerCandidatos, obtenerVotos, obtenerGradosPermitidos, obtenerSedesPermitidas, gradoPermitido, sedePermitida } = require("./db");

const crearCandidatosRouter = require("./routes/candidatos");
const { router: authRouter, requerirRol } = require("./routes/auth");
const { crearRouter: crearVotosRouter } = require("./routes/votos");

const app = express();
const PUERTO = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: "5mb" }));

app.get("/api/estado", (req, res) => {
  try {
    res.json({ 
      abierto: estaAbierto(),
      gradosPermitidos: obtenerGradosPermitidos(),
      sedesPermitidas: obtenerSedesPermitidas()
    });
  } catch (error) {
    console.error("Error en /api/estado:", error);
    res.status(500).json({ abierto: true, gradosPermitidos: [], sedesPermitidas: [] });
  }
});

// Endpoint público para resultados (sin autenticación)
app.get("/api/votos/resultados-publico", async (req, res) => {
  try {
    const candidatos = await obtenerCandidatos();
    const votos = await obtenerVotos();
    const conteo = candidatos.map((c) => {
      const votosCandidato = votos.filter((v) => v.candidatoId === c.id || v.candidatoNombre === c.nombre);
      return { id: String(c.id), nombre: c.nombre, lista: c.lista || "", cargo: c.cargo || "", votos: votosCandidato.length };
    });
    res.json(conteo);
  } catch (error) {
    console.error("Error en /api/votos/resultados-publico:", error);
    res.status(500).json({ mensaje: "Error al obtener resultados", error: error.message });
  }
});

app.post("/api/estado/cerrar", requerirRol("admin"), (req, res) => {
  try {
    cerrarVotaciones();
    res.json({ ok: true, abierto: false, gradosPermitidos: [], sedesPermitidas: [], motivo: "Votaciones cerradas." });
  } catch (error) {
    console.error("Error en /api/estado/cerrar:", error);
    res.status(500).json({ ok: false, motivo: "No se pudo cerrar las votaciones.", error: error.message });
  }
});

app.post("/api/estado/abrir", requerirRol("admin"), (req, res) => {
  try {
    const grados = Array.isArray(req.body.grados) ? req.body.grados : [];
    const sedes = Array.isArray(req.body.sedes) ? req.body.sedes : [];
    abrirVotaciones(grados, sedes);
    let msg = grados.length ? `Votaciones abiertas para grados: ${grados.join(", ")}` : "Votaciones abiertas para todos los grados";
    if (sedes.length) msg += `. Sedes: ${sedes.join(", ")}`;
    else msg += " (todas las sedes)";
    res.json({ ok: true, abierto: true, gradosPermitidos: grados, sedesPermitidas: sedes, motivo: msg });
  } catch (error) {
    console.error("Error en /api/estado/abrir:", error);
    res.status(500).json({ ok: false, motivo: "No se pudo abrir las votaciones.", error: error.message });
  }
});

app.use("/api/auth", authRouter);
app.use("/api/candidatos", crearCandidatosRouter(requerirRol));
app.use("/api/votos", crearVotosRouter(requerirRol));

app.use(express.static(path.join(__dirname, "..", "frontend"), {
  setHeaders: (res) => {
    res.setHeader("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.setHeader("Pragma", "no-cache");
    res.setHeader("Expires", "0");
  }
}));

function inicializar() {
  Promise.all([
    crearTablas(),
    asegurarVotoEnBlanco()
  ])
    .then(() => {
      app.listen(PUERTO, () => {
        console.log(`Servidor de votaciones escuchando en http://localhost:${PUERTO}`);
      });
    })
    .catch((err) => {
      console.error("Error al inicializar:", err);
      process.exit(1);
    });
}

inicializar();