const { parentPort, workerData } = require('worker_threads');
const fs = require('fs');
const XLSX = require('@e965/xlsx');
const { extractSpreadsheetInsights } = require('../utils/spreadsheetInsights');
try {
  const data = fs.readFileSync(workerData.filePath);
  if (data.length > 15 * 1024 * 1024) throw new Error('El archivo supera 15 MB.');
  // Bound the advertised uncompressed size of ZIP-based workbooks before parsing.
  if (data.readUInt16LE(0) === 0x4b50) {
    let expanded = 0, entries = 0;
    for (let offset = 0; offset + 46 <= data.length; offset++) {
      if (data.readUInt32LE(offset) !== 0x02014b50) continue;
      const bytes = data.readUInt32LE(offset + 24);
      if (bytes === 0xffffffff) throw new Error('No se admiten archivos ZIP64.');
      expanded += bytes;
      if (++entries > 2000 || expanded > 64 * 1024 * 1024) throw new Error('El libro expandido supera el limite permitido.');
      offset += 45 + data.readUInt16LE(offset + 28) + data.readUInt16LE(offset + 30) + data.readUInt16LE(offset + 32);
    }
  }
  const workbook = XLSX.read(data, { type: 'buffer', cellDates: true, sheetRows: 1000, cellFormula: false, cellText: true });
  if (workbook.SheetNames.length > 30) throw new Error('El libro supera el limite de 30 hojas.');
  const insights = extractSpreadsheetInsights(workbook);
  let remainingRows = 1000;
  const sheets = workerData.preview ? workbook.SheetNames.map(name => {
    const sheet = workbook.Sheets[name];
    const range = XLSX.utils.decode_range(sheet['!ref'] || 'A1:A1');
    const count = Math.min(500, remainingRows);
    remainingRows -= count;
    const rows = count ? XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '', blankrows: false, range: { s: range.s, e: { r: Math.min(range.e.r, range.s.r + count - 1), c: Math.min(range.e.c, range.s.c + 49) } } }) : [];
    return { name, rows: rows.map(row => row.slice(0, 50).map(value => String(value ?? '').slice(0, 2000))), truncated: Boolean(sheet['!fullref']) || range.e.r - range.s.r + 1 > count || range.e.c - range.s.c + 1 > 50 };
  }) : undefined;
  const result = workerData.preview ? { sheets, insights } : insights;
  if (Buffer.byteLength(JSON.stringify(result)) > 4 * 1024 * 1024) throw new Error('La vista previa supera el limite de resultados.');
  parentPort.postMessage({ result });
} catch (error) { parentPort.postMessage({ error: error.message }); }
