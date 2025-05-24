let budgetData = { months: {} };
let currentMonth = '';
let chartInstance = null;

const groupedExpenses = {
  'Essentials': ['Rent / Mortgage', 'Utils - Electricity', 'Utils - Water', 'Utils - Gas', 'Utils - Misc.', 'Groceries', 'Vehicle Fuel', 'Public Transit', 'Ride-share', 'Mobile Bills', 'Internet Bills', 'Insurance - Health', 'Insurance - Auto', 'Insurance - Home', 'Home Loan EMI', 'Student Loan EMI', 'Personal Loan EMI', 'Vehicle Loan EMI', 'Child Care', 'School Fees', 'Medical Expenses', 'Pet care'],
  'Personal & Lifestyle': ['Dining', 'Media Subscriptions', 'Clothing', 'Personal Care', 'Gifts / Donation'],
  'Future': ['Emergency Fund', 'Retirement Contri', 'Investments']
};

const $ = id => document.getElementById(id);

window.addEventListener('DOMContentLoaded', () => {
localStorage.removeItem("budgetData");
  $('tab-planner').addEventListener('click', () => switchTab('planner'));
  $('tab-dashboard').addEventListener('click', () => switchTab('dashboard'));
  $('plan-month-btn').addEventListener('click', startNewMonth);
  $('add-income-btn').addEventListener('click', () => addField('income'));
  $('add-expense-btn').addEventListener('click', () => addField('expense'));
switchTab('planner');
  $('month-selector').addEventListener('change', (e) => {
    currentMonth = e.target.value;
    renderFields();
    renderSummary();
  });

  $('save-file-btn').addEventListener('click', () => {
    if (!currentMonth || !budgetData.months[currentMonth]) {
      alert('No data to save. Please use Save Session first.');
      return;
    }

    const currentData = budgetData.months[currentMonth];
    if (currentData.income.length === 0 && currentData.expenses.length === 0) {
      alert('No data to save. Please use Save Session first.');
      return;
    }

    const blob = new Blob([JSON.stringify(budgetData, null, 2)], {
      type: 'application/json'
    });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = 'mybudgetdata.json';
    link.click();
  });


  $('save-session-btn').addEventListener('click', () => {
    const month = $('month-selector').value;
    if (!month) return;

    const income = [];
    const expenses = [];

    document.querySelectorAll('#income-list .entry').forEach(entry => {
      const source = entry.querySelector('input[type="text"]').value.trim();
      const amount = parseFloat(entry.querySelector('input[type="number"]').value);
      if (source && !isNaN(amount)) income.push({ source, amount });
    });

    document.querySelectorAll('#expense-list .entry').forEach(entry => {
      const category = entry.querySelector('input[type="text"]').value.trim();
      const amount = parseFloat(entry.querySelector('input[type="number"]').value);
      const adjustable = entry.querySelector('input[type="checkbox"]')?.checked || false;
      if (category && !isNaN(amount)) expenses.push({ category, amount, adjustable });
    });

    const netBalance = income.reduce((sum, i) => sum + i.amount, 0) - expenses.reduce((sum, e) => sum + e.amount, 0);
    budgetData.months[month] = { income, expenses, netBalance };
    currentMonth = month;

    //const msg = $('session-status-msg');
    showMessage('✔ Session saved temporarily. Recommend saving the budget once finalized. (💾 Save My Budget File)', false);
    //msg.textContent = '✔ Session saved temporarily. Recommend saving the budget once finalized. (💾 Save My Budget File)';
    //msg.classList.remove('hidden');
    //setTimeout(() => msg.classList.add('hidden'), 6000);

    $('save-file-btn').disabled = false;
    $('export-pdf-btn').disabled = false;
    renderSummary();
  });

  $('export-pdf-btn').addEventListener('click', exportPDF);
  $('open-file-btn').addEventListener('click', () => $('fileInput').click());
  $('fileInput').addEventListener('change', loadBudgetFromFile);

  startNewMonth();
  //addDefaultExpenses();
});



function startNewMonth() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0'); // ensures 2-digit month
  const currentLabel = `${year}-${month}`; // e.g., "2025-05"
  currentMonth = currentLabel;

  if (!budgetData.months[currentMonth]) {
    budgetData.months[currentMonth] = {
      income: [],
      expenses: Object.values(groupedExpenses).flat().map(category => ({
        category,
        amount: 0,
        adjustable: false
      })),
      netBalance: 0
    };
  }

  const selector = $('month-selector');
  if (![...selector.options].some(opt => opt.value === currentMonth)) {
    const option = document.createElement('option');
    option.value = currentMonth;
    option.textContent = currentMonth;
    selector.appendChild(option);
  }

  selector.value = currentMonth;
  selector.disabled = true;

  renderFields();
  renderSummary();
}





function switchTab(tab) {
  // Define buttons to enable/disable
  const buttons = [
    'open-file-btn',
    'month-selector',
    'plan-month-btn',
    'save-file-btn',
    'export-pdf-btn'
  ];

  ['planner', 'dashboard'].forEach(t => {
    // Reset styles and hide content
    $(`tab-${t}`).classList.remove('active');
    $(`${t}-content`).classList.add('hidden');

    // Enable all tab buttons
    $(`tab-${t}`).disabled = false;
  });

  // Activate selected tab and content
  $(`tab-${tab}`).classList.add('active');
  $(`${tab}-content`).classList.remove('hidden');

  // Disable the active tab's button
  $(`tab-${tab}`).disabled = true;

  // Manage button states based on tab
  buttons.forEach(buttonId => {
    const button = $(buttonId);
    if (button) {
      if (tab === 'planner') {
        button.disabled = false;
        button.classList.remove('opacity-50');
      } else if (tab === 'dashboard') {
        button.disabled = true;
        button.classList.add('opacity-50');
      }
    }
  });

    $('save-file-btn').disabled = true;
    $('export-pdf-btn').disabled = true;

  // Run dashboard-specific logic if needed
  if (tab === 'dashboard') {
    const periodSelect = document.getElementById("periodSelect");
    if (periodSelect) {
      periodSelect.value = "current-month"; // set to "This Month"
      periodSelect.dispatchEvent(new Event("change"));
    }
  }
}






function loadBudgetFromFile(event) {
  const file = event.target.files[0];
  if (!file || !file.name.endsWith('.json')) {
    alert("Please select a valid .json file.");
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const parsed = JSON.parse(e.target.result);
      if (!parsed || typeof parsed !== 'object' || !parsed.months || typeof parsed.months !== 'object') {
        throw new Error("Invalid format: Missing 'months' object.");
      }

      for (const [month, data] of Object.entries(parsed.months)) {
        if (!Array.isArray(data.income) || !Array.isArray(data.expenses) || typeof data.netBalance !== 'number') {
          throw new Error(`Invalid data in "${month}".`);
        }

        data.income.forEach(i => {
          if (typeof i.source !== 'string' || typeof i.amount !== 'number') {
            throw new Error(`Invalid income in "${month}".`);
          }
        });

        data.expenses.forEach(e => {
          if (typeof e.category !== 'string' || typeof e.amount !== 'number' || typeof e.adjustable !== 'boolean') {
            throw new Error(`Invalid expense in "${month}".`);
          }
        });
      }

      budgetData = parsed;
      localStorage.setItem("budgetData", JSON.stringify(budgetData));
      $('open-file-btn').classList.add('hidden');
      const selector = $('month-selector');
      selector.classList.remove('hidden');
      selector.innerHTML = '';

      Object.keys(budgetData.months).forEach(month => {
        const option = document.createElement('option');
        option.value = month;
        option.textContent = month;
        selector.appendChild(option);
      });

      selector.value = Object.keys(budgetData.months)[0];
      currentMonth = selector.value;

      $('save-file-btn').disabled = false;
      $('export-pdf-btn').disabled = false;
      $('month-selector').disabled = false;

      renderFields();
      renderSummary();
    } catch (err) {
      alert("Failed to load file: " + err.message);
    }
  };

  reader.readAsText(file);
}

function addField(type) {
  const container = type === 'income' ? $('income-list') : $('expense-list');
  const wrapper = document.createElement('div');
  wrapper.className = 'entry';
  wrapper.innerHTML = `
    <input type="text" placeholder="${type === 'income' ? 'Source' : 'Category'}" />
    <input type="number" placeholder="Amount" />
    ${type === 'expense' ? '<label><input type="checkbox" /> Adjustable</label>' : ''}
    <button class="delete-btn bg-red-500 text-white p-2 rounded hover:bg-red-600 transition">🗑️</button>
  `;
  container.appendChild(wrapper);
}

document.addEventListener('click', (e) => {
  if (e.target.classList.contains('delete-btn')) {
    e.target.parentElement.remove();
    renderSummary();
  }
});

function addDefaultExpenses() {
  const container = $('expense-list');
  for (const section in groupedExpenses) {
    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'expense-group mb-4';

    const header = document.createElement('h3');
    header.className = 'text-lg font-semibold mt-4 cursor-pointer flex items-center justify-between bg-gray-200 p-2 rounded';
    header.innerHTML = `<span>${section}</span><span class="toggle-icon">▼</span>`;

    const groupContent = document.createElement('div');
    groupContent.className = 'group-content mt-2 hidden';

    groupedExpenses[section].forEach(category => {
      const wrapper = document.createElement('div');
      wrapper.className = 'entry';
      wrapper.innerHTML = `
        <input type="text" value="${category}" readonly />
        <input type="number" placeholder="Amount" />
        <label><input type="checkbox" /> Adjustable</label>
      `;
      groupContent.appendChild(wrapper);
    });

    header.addEventListener('click', () => {
      const isHidden = groupContent.classList.toggle('hidden');
      header.querySelector('.toggle-icon').textContent = isHidden ? '▶' : '▼';
    });

    groupWrapper.appendChild(header);
    groupWrapper.appendChild(groupContent);
    container.appendChild(groupWrapper);
  }
}

function renderFields() {
  $('income-list').innerHTML = '';
  $('expense-list').innerHTML = '';

  const monthData = budgetData.months[currentMonth];
  if (!monthData) return;

  monthData.income.forEach(i => {
    const div = document.createElement('div');
    div.className = 'entry';
    div.innerHTML = `
      <input type="text" value="${i.source}" />
      <input type="number" value="${i.amount}" />
      <button class="delete-btn bg-red-500 text-white p-2 rounded hover:bg-red-600 transition">🗑️</button>
    `;
    $('income-list').appendChild(div);
  });

  const expenseMap = {};
  monthData.expenses.forEach(e => {
    expenseMap[e.category] = e;
  });

  const container = $('expense-list');
  Object.entries(groupedExpenses).forEach(([section, categories]) => {
    const groupWrapper = document.createElement('div');
    groupWrapper.className = 'expense-group mb-4';

    const header = document.createElement('h3');
    header.className = 'text-lg font-semibold mt-4 cursor-pointer flex items-center justify-between bg-gray-200 p-2 rounded';
    header.innerHTML = `<span>${section}</span><span class="toggle-icon">▼</span>`;

    const groupContent = document.createElement('div');
    groupContent.className = 'group-content mt-2';

    categories.forEach(category => {
      const data = expenseMap[category] || { amount: '', adjustable: false };
      const wrapper = document.createElement('div');
      wrapper.className = 'entry';
      wrapper.innerHTML = `
        <input type="text" value="${category}" readonly />
        <input type="number" value="${data.amount}" placeholder="Amount" />
        <label><input type="checkbox" ${data.adjustable ? 'checked' : ''} /> Adjustable</label>
      `;
      groupContent.appendChild(wrapper);
    });

    header.addEventListener('click', () => {
      const isHidden = groupContent.classList.toggle('hidden');
      header.querySelector('.toggle-icon').textContent = isHidden ? '▶' : '▼';
    });

    groupWrapper.appendChild(header);
    groupWrapper.appendChild(groupContent);
    container.appendChild(groupWrapper);
  });
}



  // Helper to show message
  function showMessage(text, isError = false) {
 const msg = document.getElementById('session-status-msg');
    msg.textContent = text;
    msg.classList.remove('hidden');
    msg.style.color = isError ? 'red' : 'green';
    setTimeout(() => msg.classList.add('hidden'), 6000);
  }

function renderSummary() {
  if (!currentMonth || !budgetData.months[currentMonth]) return;
  const { income, expenses, netBalance } = budgetData.months[currentMonth];
  const totalIncome = income.reduce((sum, i) => sum + i.amount, 0);
  const totalExpense = expenses.reduce((sum, e) => sum + e.amount, 0);


  // Case: both are 0 — allowed
  if (totalIncome === 0 && totalExpense === 0) {
    showMessage('✔ No income or expenses entered yet.', false);
    return true;
  }

  // Validation checks
  if (totalIncome <= 0) {
    showMessage('❌ Validation Error: Total income must be greater than 0.', true);
    return false;
  }

  if (totalExpense <= 0) {
    showMessage('❌ Validation Error: Total expenses must be greater than 0.', true);
    return false;
  }

  if (totalExpense > totalIncome) {
    showMessage('❌ Validation Error: Total expenses exceed total income.', true);
    return false;
  }



  $('summary').innerHTML = `
    <p><strong>Total Income:</strong> $${totalIncome.toFixed(2)}</p>
    <p><strong>Total Expenses:</strong> $${totalExpense.toFixed(2)}</p>
    <p><strong>Net Balance:</strong> $${netBalance.toFixed(2)}</p>
  `;

  drawChart(totalIncome, totalExpense);
}

function drawChart(income, expense) {
  const ctx = $('summaryChart').getContext('2d');
  if (chartInstance) chartInstance.destroy();
  chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels: ['Income', 'Expenses'],
      datasets: [{
        data: [income, expense],
        backgroundColor: ['#22c55e', '#ef4444']
      }]
    },
    options: {
      responsive: true,
      plugins: { legend: { position: 'bottom' } }
    }
  });
}

function exportPDF() {
  const { jsPDF } = window.jspdf;
  const doc = new jsPDF();
  if (!currentMonth || !budgetData.months[currentMonth]) return alert("Nothing to export.");
  const { income, expenses, netBalance } = budgetData.months[currentMonth];

  doc.setFontSize(14);
  doc.text(`Budget Report - ${currentMonth}`, 10, 10);

  doc.setFontSize(12);
  doc.text("Income:", 10, 20);
  income.forEach((i, idx) => doc.text(`- ${i.source}: $${i.amount}`, 15, 30 + idx * 6));

  const expStartY = 40 + income.length * 6;
  doc.text("Expenses:", 10, expStartY);
  expenses.forEach((e, idx) =>
    doc.text(`- ${e.category}: $${e.amount}${e.adjustable ? ' (Adj)' : ''}`, 15, expStartY + 10 + idx * 6)
  );

  const finalY = expStartY + 20 + expenses.length * 6;
  doc.text(`Net Balance: $${netBalance.toFixed(2)}`, 10, finalY);
  doc.save(`budget-${currentMonth}.pdf`);
}
