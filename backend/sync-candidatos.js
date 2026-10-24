const fs = require("fs");
const path = require("path");
const { guardarCandidatos, crearTablas } = require("./db");

const CANDIDATOS_PATH = path.join(__dirname, "data", "candidatos.json");

async function sync() {
  const contenido = fs.readFileSync(CANDIDATOS_PATH, "utf-8");
  const candidatos = JSON.parse(contenido);

  await crearTablas();
  const result = await guardarCandidatos(candidatos);

  console.log(`Sincronizados ${result.length} candidatos a la base de datos:`);
  result.forEach((c) => console.log(`  - ${c.nombre} (${c.id})`));
  process.exit(0);
}

sync().catch((err) => {
  console.error("Error sincronizando candidatos:", err.message);
  process.exit(1);
});
