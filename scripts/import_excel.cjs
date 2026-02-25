require('dotenv').config();
const XLSX = require('xlsx');
const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.VITE_SUPABASE_URL;
const supabaseServiceKey = process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
  console.error('Error: Faltan las variables de entorno de Supabase.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

function normalizeName(name) {
  if (!name) return '';
  return name.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[,\.]/g, " ").replace(/\s+/g, " ").trim().toLowerCase();
}

const MANUAL_ALIASES = {
  'daza soruco cristian fernando': 'daza suruco cristian fernando',
  'munoz tarifa qddllwinns agddlers': 'munoz tarifa qddllwinna agddlers',
  'lopez martinez jesus': 'lopez martinez jesus'
};

async function main() {
  const file = 'migracion.xlsx';
  if (!fs.existsSync(file)) {
    console.log('Archivo no encontrado');
    return;
  }
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];

  const rawData = XLSX.utils.sheet_to_json(worksheet, { raw: false });
  console.log(`Leídas ${rawData.length} filas del archivo Excel.`);

  const headers = XLSX.utils.sheet_to_json(worksheet, { header: 1 })[0];
  const checklistQuestions = headers.slice(7, 33);

  // 1. Cargar perfiles
  const { data: allProfiles, error: profError } = await supabase.from('profiles').select('id, full_name');
  if (profError) {
    console.error('Error cargando perfiles:', profError);
    process.exit(1);
  }

  const profilesMap = {};
  allProfiles.forEach(p => {
    if (p.full_name) {
      profilesMap[normalizeName(p.full_name)] = p.id;
    }
  });

  console.log(`\nAgrupando observaciones...`);

  const groupedObservations = new Map();
  let omittedRows = 0;

  // 2. Agrupar filas del Excel
  for (let i = 0; i < rawData.length; i++) {
    const row = rawData[i];
    if (!row['NOMBRE DEL OPERADOR']) continue;

    const supervisorNameStr = row['NOMBRE DEL OBSERVADOR'];
    if (!supervisorNameStr) continue;

    let normName = normalizeName(supervisorNameStr);
    if (MANUAL_ALIASES[normName]) normName = MANUAL_ALIASES[normName];

    const supervisorId = profilesMap[normName];
    if (!supervisorId) {
      console.log(`  Omitida fila ${i + 2}: Supervisor '${supervisorNameStr}' no en BD.`);
      omittedRows++;
      continue;
    }

    let parsedDate = null;
    try {
      const fechaVal = row['FECHA'];
      if (typeof fechaVal === 'string' && fechaVal.includes('/')) {
        const parts = fechaVal.split('/');
        let year = parseInt(parts[2]);
        if (year < 100) year += 2000;
        // Obliga a que parts[0] sea dia y parts[1] sea mes
        parsedDate = new Date(year, parseInt(parts[1]) - 1, parseInt(parts[0]));
      } else {
        parsedDate = new Date(fechaVal);
      }

      if (isNaN(parsedDate.getTime())) {
        parsedDate = new Date(); // fallback safe
      }
    } catch (e) {
      parsedDate = new Date();
    }
    const isoDateStr = parsedDate.toISOString().split('T')[0];

    const shiftVal = (row['TURNO'] && row['TURNO'].toUpperCase() === 'NOCTURNO') ? 'Nocturno' : 'Diurno';
    let siteVal = row['SEDE'] || 'Desconocida';
    if (siteVal === 'EL DESCANSO') siteVal = 'El Descanso';
    if (siteVal === 'PRIBBENOW') siteVal = 'Pribbenow';
    const groupVal = row['GRUPO'] ? row['GRUPO'].toString() : null;
    const typeVal = row['TIPO DE OBSERVACION'] || 'General';

    // Llave única para la cabecera
    const groupKey = `${isoDateStr}_${shiftVal}_${supervisorId}_${siteVal}_${groupVal}_${typeVal}`;

    const checklist = {};
    for (const question of checklistQuestions) {
      if (row[question] !== undefined && row[question] !== null && row[question].toString().trim() !== '') {
        let val = row[question].toString().trim();
        // Fallbacks manuales para evitar tildes locas si acaso
        if (val.toUpperCase() === 'SÍ') val = 'Si';
        checklist[question] = val;
      }
      // Si está vacío, simplemente lo ignoramos y no se añade la llave
    }

    const recordData = {
      operator_name: row['NOMBRE DEL OPERADOR'],
      checklist: checklist,
      comments: row['COMENTARIOS'] || ''
    };

    if (!groupedObservations.has(groupKey)) {
      groupedObservations.set(groupKey, {
        headerData: {
          supervisor_id: supervisorId,
          date: isoDateStr,
          shift: shiftVal,
          site: siteVal,
          group_info: groupVal,
          observation_type: typeVal,
          status: 'completed'
        },
        records: []
      });
    }

    groupedObservations.get(groupKey).records.push(recordData);
  }

  console.log(`Las ${rawData.length} filas del Excel se agruparon en ${groupedObservations.size} cabeceras únicas de observación.`);

  // 3. Insertar a la base de datos
  let headerSuccessCount = 0;
  let headerErrorCount = 0;
  let recordsSuccessCount = 0;

  console.log(`\nIniciando subida a Supabase...`);

  for (const [key, group] of groupedObservations.entries()) {
    try {
      // Insert Header
      const { data: obsData, error: obsError } = await supabase
        .from('observations')
        .insert(group.headerData)
        .select('id')
        .single();

      if (obsError) throw obsError;
      headerSuccessCount++;

      // Prepare Records
      const recordsToInsert = group.records.map(record => ({
        ...record,
        observation_id: obsData.id
      }));

      // Insert Records in bulk
      const { error: recError } = await supabase
        .from('observation_records')
        .insert(recordsToInsert);

      if (recError) throw recError;
      recordsSuccessCount += recordsToInsert.length;

    } catch (err) {
      console.error(`- Error insertando grupo [${key}]:`, err.message);
      headerErrorCount++;
    }
  }

  console.log(`\nMigración finalizada.`);
  console.log(`✓ Cabeceras creadas ('observations'): ${headerSuccessCount}`);
  console.log(`✓ Operadores creados ('observation_records'): ${recordsSuccessCount}`);
  console.log(`✗ Grupos con error: ${headerErrorCount}`);
  console.log(`✗ Filas omitidas desde el inicio: ${omittedRows}`);
}

main().catch(console.error);
