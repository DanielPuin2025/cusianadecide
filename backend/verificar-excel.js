const XLSX = require("xlsx");
const path = require("path");

const excelPath = path.join(__dirname, "data", "estudiantes.xlsx");

try {
  const workbook = XLSX.readFile(excelPath);
  console.log("Hojas:", workbook.SheetNames);
  
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const datos = XLSX.utils.sheet_to_json(sheet, { defval: "" });
  
  console.log("Total estudiantes en Excel:", datos.length);
  console.log("Primeros 5 registros:", JSON.stringify(datos.slice(0, 5), null, 2));
  
  if (datos.length === 0) {
    console.log("EL EXCEL ESTA VACIO - Por eso no encuentra ningun codigo");
  }
} catch (error) {
  console.error("Error leyendo Excel:", error.message);
}
