const { Worker } = require('worker_threads');
const path = require('path');
let active = 0;
const processSpreadsheet = (filePath, preview = false) => {
  if (active >= 2) return Promise.reject(Object.assign(new Error('Hay analisis de Excel en curso. Intentalo de nuevo.'), { statusCode: 429 }));
  active++;
  return new Promise((resolve, reject) => {
    let worker;
    let settled = false;
    let timer;
    const fail = message => Object.assign(new Error(message), { statusCode: 422 });
    const finish = (error, result) => { if (settled) return; settled = true; clearTimeout(timer); error ? reject(error) : resolve(result); worker?.terminate(); };
    try {
      worker = new Worker(path.join(__dirname, 'spreadsheetWorker.js'), { workerData: { filePath, preview }, resourceLimits: { maxOldGenerationSizeMb: 128, maxYoungGenerationSizeMb: 16 }, env: { NODE_ENV: 'production' } });
      timer = setTimeout(() => finish(fail('El analisis de Excel excedio 10 segundos. Reduce el libro.')), 10000);
      worker.once('message', message => finish(message.error ? fail(message.error) : null, message.result));
      worker.once('error', () => finish(fail('No se pudo analizar el libro dentro de los limites permitidos.')));
      worker.once('exit', () => { active--; if (!settled) finish(fail('El analisis de Excel termino sin resultado.')); });
    } catch (error) { active--; finish(fail('No se pudo iniciar el analisis de Excel.')); }
  });
};
module.exports = { processSpreadsheet };
