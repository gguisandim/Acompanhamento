import fs from "node:fs/promises";
import path from "node:path";
import { FileBlob, SpreadsheetFile } from "@oai/artifact-tool";

const inputs = process.argv.slice(2);
if (!inputs.length) throw new Error("Informe ao menos um arquivo XLSX.");

for (const inputPath of inputs) {
  const workbook = await SpreadsheetFile.importXlsx(await FileBlob.load(inputPath));
  const summary = await workbook.inspect({
    kind: "workbook,sheet,table,definedName,drawing",
    maxChars: 12000,
    tableMaxRows: 10,
    tableMaxCols: 16,
    tableMaxCellChars: 100,
  });
  console.log(`FILE ${inputPath}`);
  console.log(summary.ndjson);

  const sheets = await workbook.inspect({ kind: "sheet", include: "id,name", maxChars: 4000 });
  console.log("SHEETS");
  console.log(sheets.ndjson);

  const safeBase = path.basename(inputPath, path.extname(inputPath)).replace(/[^a-z0-9_-]+/gi, "-");
  const outputDir = path.resolve(".tmp", "spreadsheet-audit", safeBase);
  await fs.mkdir(outputDir, { recursive: true });

  for (const sheet of workbook.worksheets.items) {
    const region = await workbook.inspect({
      kind: "region",
      sheetId: sheet.name,
      range: "A1:AN48",
      maxChars: 10000,
      tableMaxRows: 48,
      tableMaxCols: 40,
      tableMaxCellChars: 100,
    });
    console.log(`REGION ${sheet.name}`);
    console.log(region.ndjson);

    const formulas = await workbook.inspect({
      kind: "formula",
      sheetId: sheet.name,
      range: "A1:AN48",
      maxChars: 8000,
      options: { maxResults: 120 },
    });
    console.log(`FORMULAS ${sheet.name}`);
    console.log(formulas.ndjson);

    const preview = await workbook.render({ sheetName: sheet.name, range: "A1:AN48", scale: 1, format: "png" });
    const fileName = sheet.name.replace(/[^a-z0-9_-]+/gi, "-") + ".png";
    await fs.writeFile(path.join(outputDir, fileName), new Uint8Array(await preview.arrayBuffer()));
  }
}
