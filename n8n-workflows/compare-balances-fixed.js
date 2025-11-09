// Получаем ВСЕ items после Merge
const allItems = $input.all();

// Разделяем на данные от RentProg и БД
const rentprogData = [];
const dbData = [];

allItems.forEach(item => {
  // Если есть поле user_id - это от RentProg
  // Если есть поле employee_id - это от БД
  if (item.json.user_id) {
    rentprogData.push(item.json);
  } else if (item.json.employee_id) {
    dbData.push(item.json);
  }
});

console.log(`RentProg users: ${rentprogData.length}`);
console.log(`DB employees: ${dbData.length}`);

// Если нет данных от RentProg - ошибка
if (rentprogData.length === 0) {
  return [{ json: { status: 'error', message: 'No data from RentProg' } }];
}

// Если нет данных от БД - нечего сравнивать
if (dbData.length === 0) {
  return [{ json: { status: 'ok', message: 'No employees in DB to compare' } }];
}

// Создаём Map для быстрого поиска сотрудников по rentprog_id
const dbMap = {};
dbData.forEach(emp => {
  if (emp.rentprog_id) {
    dbMap[emp.rentprog_id] = emp;
  }
});

// Ищем расхождения
const discrepancies = [];

rentprogData.forEach(rpUser => {
  const dbEmployee = dbMap[String(rpUser.user_id)];
  
  if (!dbEmployee) {
    // Сотрудник есть в RentProg, но нет в БД
    console.log(`User ${rpUser.user_name} (ID: ${rpUser.user_id}) not found in DB`);
    return;
  }
  
  // Сравниваем кассы
  const differences = [];
  
  // GEL
  const rpGel = rpUser.cash?.GEL || 0;
  const dbGel = parseFloat(dbEmployee.cash_gel) || 0;
  if (Math.abs(rpGel - dbGel) > 0.01) {
    differences.push({
      currency: 'GEL',
      rentprog: rpGel,
      db: dbGel,
      diff: rpGel - dbGel
    });
  }
  
  // USD
  const rpUsd = rpUser.cash?.USD || 0;
  const dbUsd = parseFloat(dbEmployee.cash_usd) || 0;
  if (Math.abs(rpUsd - dbUsd) > 0.01) {
    differences.push({
      currency: 'USD',
      rentprog: rpUsd,
      db: dbUsd,
      diff: rpUsd - dbUsd
    });
  }
  
  // EUR
  const rpEur = rpUser.cash?.EUR || 0;
  const dbEur = parseFloat(dbEmployee.cash_eur) || 0;
  if (Math.abs(rpEur - dbEur) > 0.01) {
    differences.push({
      currency: 'EUR',
      rentprog: rpEur,
      db: dbEur,
      diff: rpEur - dbEur
    });
  }
  
  // Если есть расхождения - добавляем в список
  if (differences.length > 0) {
    discrepancies.push({
      branch: rpUser.branch,
      employee_id: dbEmployee.employee_id,
      employee_name: dbEmployee.employee_name,
      rentprog_id: rpUser.user_id,
      differences: differences,
      correct_cash: {
        gel: rpGel,
        usd: rpUsd,
        eur: rpEur
      }
    });
  }
});

// Возвращаем результат
if (discrepancies.length === 0) {
  return [{ json: { status: 'ok', message: 'All cash balances match' } }];
}

// Возвращаем список расхождений
return discrepancies.map(d => ({ json: d }));

