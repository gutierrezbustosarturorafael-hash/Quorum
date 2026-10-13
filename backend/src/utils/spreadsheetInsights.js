const getXlsx = () => require('xlsx');

const normalize = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .trim()
  .toLowerCase();

const cellAt = (sheet, row, column) => sheet[getXlsx().utils.encode_cell({ r: row, c: column })];

const displayValue = cell => {
  if (!cell) return '';
  if (cell.w !== undefined) return String(cell.w).trim();
  if (cell.v !== undefined) return String(getXlsx().utils.format_cell(cell)).trim();
  return '';
};

const parsePercent = cell => {
  const display = displayValue(cell);
  const displayedPercent = display.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
  if (displayedPercent) return Number(displayedPercent[1].replace(',', '.'));
  if (!cell || typeof cell.v !== 'number') return null;
  if (String(cell.z || '').includes('%') || Math.abs(cell.v) <= 1) return cell.v * 100;
  return null;
};

const getStatus = progress => {
  if (progress === null) return 'Sin datos';
  if (progress >= 92) return 'Eficiente';
  if (progress >= 74) return 'Promedio';
  return 'Deficiente';
};

const extractNumber = value => {
  const match = String(value || '').replace(/,/g, '').match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
};

const extractPeriod = sheet => {
  const range = getXlsx().utils.decode_range(sheet['!ref'] || 'A1:A1');
  for (let row = range.s.r; row <= Math.min(range.e.r, 5); row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      if (normalize(displayValue(cellAt(sheet, row, column))).includes('periodo')) {
        for (let nextColumn = column + 1; nextColumn <= Math.min(range.e.c, column + 6); nextColumn += 1) {
          const value = displayValue(cellAt(sheet, row, nextColumn));
          if (value) return value;
        }
      }
    }
  }
  return '';
};

const parseTargetAndAchieved = value => {
  const text = String(value || '');
  const target = text.match(/meta\s*:\s*([\d,.]+)/i);
  const achieved = text.match(/logrado\s*:\s*([\d,.]+)/i);
  return {
    target: target ? extractNumber(target[1]) : null,
    achieved: achieved ? extractNumber(achieved[1]) : null
  };
};

const metric = (name, progress, extra = {}) => ({
  name: String(name || '').replace(/\s+/g, ' ').trim(),
  progress: progress === null ? null : Math.round(progress * 10) / 10,
  status: getStatus(progress),
  ...extra
});

const extractIndicatorSheet = sheet => {
  const range = getXlsx().utils.decode_range(sheet['!ref'] || 'A1:A1');
  let headerIndex = -1;
  let nameColumn = -1;
  let resultColumn = -1;
  for (let row = range.s.r; row <= range.e.r && headerIndex < 0; row += 1) {
    const header = [];
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      header.push(normalize(displayValue(cellAt(sheet, row, column))));
    }
    nameColumn = header.indexOf('indicador');
    if (nameColumn >= 0) {
      headerIndex = row;
      resultColumn = header.indexOf('resultado');
    }
  }
  if (resultColumn < 0) return [];

  const metrics = [];
  for (let row = headerIndex + 1; row <= range.e.r; row += 1) {
    const name = displayValue(cellAt(sheet, row, nameColumn));
    const progressText = displayValue(cellAt(sheet, row, resultColumn));
    const match = progressText.match(/(-?\d+(?:[.,]\d+)?)\s*%/);
    if (!name || !match) continue;
    const progress = Number(match[1].replace(',', '.'));
    if (Number.isFinite(progress)) metrics.push(metric(name, progress, { status: null }));
  }
  return metrics;
};

const extractUnitName = workbook => {
  for (const sheetName of workbook.SheetNames) {
    const sheet = workbook.Sheets[sheetName];
    const range = getXlsx().utils.decode_range(sheet['!ref'] || 'A1:A1');
    const lastRow = Math.min(range.e.r, range.s.r + 4);
    for (let row = range.s.r; row <= lastRow; row += 1) {
      for (let column = range.s.c; column <= range.e.c; column += 1) {
        const title = displayValue(cellAt(sheet, row, column)).replace(/\s+/g, ' ').trim();
        const match = title.match(/clientes concluidos\s+["“]?(.+?)["”]?$/i);
        if (match) return match[1].replace(/["”]+$/, '').trim();
        if (/^fiscal$/i.test(title)) return title;
      }
    }
  }
  return '';
};

const extractAdvanceSheet = sheet => {
  const metrics = [];
  const overallLabel = 'resultado general';
  const range = getXlsx().utils.decode_range(sheet['!ref'] || 'A1:A1');
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const label = displayValue(cellAt(sheet, row, column));
      if (normalize(label) !== overallLabel) continue;
      const progress = parsePercent(cellAt(sheet, row, column + 5))
        ?? parsePercent(cellAt(sheet, row, column + 1));
      const targetAndAchieved = parseTargetAndAchieved(displayValue(cellAt(sheet, row, column + 10)));
      const achievedCell = displayValue(cellAt(sheet, row + 2, column + 10));
      const achieved = targetAndAchieved.achieved ?? extractNumber(achievedCell);
      metrics.push(metric('Resultado general', progress, {
        target: targetAndAchieved.target,
        achieved
      }));
      break;
    }
  }

  const metricColumns = [range.s.c, range.s.c + 5, range.s.c + 10];
  for (let row = range.s.r; row < range.e.r; row += 1) {
    for (const column of metricColumns) {
      const name = displayValue(cellAt(sheet, row, column));
      if (!name || normalize(name).startsWith('indicadores por')) continue;
      const progress = parsePercent(cellAt(sheet, row + 1, column));
      const progressText = normalize(displayValue(cellAt(sheet, row + 1, column)));
      if (progress === null && progressText !== 's/d') continue;
      const targetAndAchieved = parseTargetAndAchieved(displayValue(cellAt(sheet, row + 4, column)));
      metrics.push(metric(name, progress, targetAndAchieved));
    }
  }
  return metrics;
};

const findResult = sheet => {
  const range = getXlsx().utils.decode_range(sheet['!ref'] || 'A1:A1');
  let result = null;
  const values = {};
  for (let row = range.s.r; row <= range.e.r; row += 1) {
    for (let column = range.s.c; column <= range.e.c; column += 1) {
      const label = normalize(displayValue(cellAt(sheet, row, column)));
      if (!label) continue;
      if (label === 'resultado') {
        for (let nextColumn = column + 1; nextColumn <= Math.min(range.e.c, column + 4); nextColumn += 1) {
          const progress = parsePercent(cellAt(sheet, row, nextColumn));
          if (progress !== null) {
            result = progress;
            break;
          }
        }
      }
      if (['meta', 'logrado', 'n° de clientes', 'nº de clientes', 'numero de clientes'].includes(label)) {
        for (let nextColumn = column + 1; nextColumn <= Math.min(range.e.c, column + 4); nextColumn += 1) {
          const value = extractNumber(displayValue(cellAt(sheet, row, nextColumn)));
          if (value !== null) {
            values[label] = value;
            break;
          }
        }
      }
    }
  }
  return { progress: result, ...values };
};

const extractSpreadsheetInsights = workbook => {
  const indicatorSheet = workbook.Sheets.INDICADOR;
  const advanceSheetName = workbook.SheetNames.find(name => normalize(name) === 'avance');
  const resultsSheetName = workbook.SheetNames.find(name => normalize(name) === 'resultados');
  let metrics = [];
  let sourceSheet = '';
  let period = '';
  let result = null;

  if (indicatorSheet) {
    metrics = extractIndicatorSheet(indicatorSheet);
    if (metrics.length) sourceSheet = 'INDICADOR';
  }

  if (advanceSheetName) {
    const advanceSheet = workbook.Sheets[advanceSheetName];
    const advanceMetrics = extractAdvanceSheet(advanceSheet);
    if (advanceMetrics.length) {
      metrics = [...metrics, ...advanceMetrics];
      sourceSheet = advanceSheetName;
      period = extractPeriod(advanceSheet);
    }
  }

  if (resultsSheetName) {
    result = findResult(workbook.Sheets[resultsSheetName]);
    if (result.progress !== null) {
      if (!metrics.length) {
        metrics = [metric('Resultado de la unidad', result.progress, {
          target: result.meta ?? null,
          achieved: result.logrado ?? null,
          clients: result['n° de clientes'] ?? result['nº de clientes'] ?? result['numero de clientes'] ?? null
        })];
        sourceSheet = resultsSheetName;
      }
    }
  }

  const uniqueMetrics = [...new Map(metrics.map(item => [normalize(item.name), item])).values()];
  const overallMetric = uniqueMetrics.find(item => normalize(item.name) === 'resultado general')
    || uniqueMetrics.find(item => normalize(item.name) === 'resultado de la unidad');
  const summary = {
    unitName: extractUnitName(workbook),
    clients: result?.['n° de clientes'] ?? result?.['nº de clientes'] ?? result?.['numero de clientes'] ?? null,
    target: overallMetric?.target ?? result?.meta ?? null,
    achieved: overallMetric?.achieved ?? result?.logrado ?? null,
    progress: overallMetric?.progress ?? result?.progress ?? null,
    status: overallMetric?.status ?? getStatus(result?.progress ?? null)
  };
  return {
    sourceSheet,
    period,
    summary,
    metrics: uniqueMetrics,
    note: 'Los resultados se leen de los valores guardados en el archivo. Guarda el Excel después de actualizarlo para reflejar los cálculos más recientes.'
  };
};

const readSpreadsheetInsights = filePath => {
  const workbook = getXlsx().readFile(filePath, { cellDates: true, cellFormula: true, cellText: true });
  return extractSpreadsheetInsights(workbook);
};

module.exports = { extractSpreadsheetInsights, readSpreadsheetInsights };
