document.addEventListener("DOMContentLoaded", function () {
  const periodSelect = document.getElementById("periodSelect");
  const dashboardBtn = document.getElementById("dashboard-button"); // Note: Currently unused

  // Check if periodSelect exists
  if (!periodSelect) {
    console.error("Error: 'periodSelect' element not found in the DOM.");
    return;
  }

  // Attach events
  periodSelect.addEventListener("change", updateDashboard);


// Toggle Help Panel
document.getElementById('help-button').addEventListener('click', () => {
  document.getElementById('help-panel').classList.toggle('hidden');
});



  function getMonthKey(offset = 0) {
    const now = new Date();
    now.setMonth(now.getMonth() + offset);
    return now.toISOString().slice(0, 7);
  }

  function getLastNMonthKeys(n) {
    const keys = [];
    for (let i = 0; i < n; i++) {
      keys.push(getMonthKey(-i));
    }
    return keys;
  }

  function updateDashboard() {
    let budgetData;
    try {
      budgetData = JSON.parse(localStorage.getItem("budgetData")) || {};
    } catch (e) {
      console.error("Error parsing budgetData from localStorage:", e);
      budgetData = {};
    }

    const allMonths = budgetData.months || {};
    const option = periodSelect.value || "current-month";

    let monthsToInclude = [];

    switch (option) {
      case "current-month":
        monthsToInclude = [getMonthKey(0)];
        break;
      case "last-month":
        monthsToInclude = [getMonthKey(-1)];
        break;
      case "last-3-months":
        monthsToInclude = getLastNMonthKeys(3);
        break;
      case "last-6-months":
        monthsToInclude = getLastNMonthKeys(6);
        break;
      case "last-1-year":
        monthsToInclude = getLastNMonthKeys(12);
        break;
      case "lifetime":
        monthsToInclude = Object.keys(allMonths).slice(0, 60); // Limit to 5 years for performance
        break;
    }

    let totalIncome = 0;
    let totalExpenses = 0;
    let totalNetBalance = 0;
    let hasData = false;

    monthsToInclude.forEach((monthKey) => {
      const data = allMonths[monthKey];
      if (!data) return;

      hasData = true;
      const income = data.income.reduce((sum, item) => sum + (item.amount || 0), 0);
      const expenses = data.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);
      const net = data.netBalance ?? (income - expenses);

      totalIncome += income;
      totalExpenses += expenses;
      totalNetBalance += net;
    });

    const savingRate = totalIncome > 0 ? ((totalNetBalance / totalIncome) * 100).toFixed(2) : "0.00";

    // Update UI
    document.getElementById("card-total-income").textContent = totalIncome.toLocaleString();
    document.getElementById("card-total-expense").textContent = totalExpenses.toLocaleString();
    document.getElementById("card-net-saving").textContent = totalNetBalance.toLocaleString();
    document.getElementById("card-saving-rate").textContent = `${savingRate}%`;

    // Call chart and tips functions
    plotIncomeExpenseGraph(monthsToInclude, allMonths);
    plotExpenseBreakdownGraph(monthsToInclude, allMonths);
    generateAndDisplayTips(allMonths, monthsToInclude, savingRate);

    const warning = document.getElementById("dashboard-warning-msg");
    if (!hasData && warning) {
      warning.textContent = "No data available for the selected period.";
      warning.classList.remove("hidden");
    } else if (warning) {
      warning.classList.add("hidden");
    }
  }

  // Trigger initial dashboard update
  updateDashboard();
});

function plotIncomeExpenseGraph(monthsToInclude, allMonths) {
  const labels = [];
  const incomeData = [];
  const expenseData = [];

  monthsToInclude.forEach((monthKey) => {
    const data = allMonths[monthKey];
    if (!data) return;

    labels.push(monthKey);
    const income = data.income.reduce((sum, item) => sum + (item.amount || 0), 0);
    const expenses = data.expenses.reduce((sum, item) => sum + (item.amount || 0), 0);

    incomeData.push(income);
    expenseData.push(expenses);
  });

  const ctx = document.getElementById("incomeExpenseChart")?.getContext("2d");
  if (!ctx) {
    console.error("Error: 'incomeExpenseChart' canvas not found.");
    return;
  }

  // Destroy existing chart if it exists
  if (window.incomeExpenseChart && window.incomeExpenseChart.destroy) {
    window.incomeExpenseChart.destroy();
  }

  const chartWrapper = document.getElementById("chart-wrapper");
  const monthsCount = monthsToInclude.length;

  if (chartWrapper) {
    if (monthsCount > 6) {
      chartWrapper.style.width = `${monthsCount * 70}px`; // Scrollable
    } else {
      chartWrapper.style.width = "100%"; // Fixed width
    }
  }

  // Create new chart
  window.incomeExpenseChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Income",
          data: incomeData,
          backgroundColor: "rgba(75, 192, 192, 0.2)",
          borderColor: "rgba(75, 192, 192, 1)",
          borderWidth: 2,
        },
        {
          label: "Expense",
          data: expenseData,
          backgroundColor: "rgba(255, 99, 132, 0.2)",
          borderColor: "rgba(255, 99, 132, 1)",
          borderWidth: 2,
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

function plotExpenseBreakdownGraph(monthsToInclude, allMonths) {
  const expenseCategories = {};

  monthsToInclude.forEach((monthKey) => {
    const data = allMonths[monthKey];
    if (!data) return;

    data.expenses.forEach((expense) => {
      if (!expenseCategories[expense.category]) {
        expenseCategories[expense.category] = 0;
      }
      expenseCategories[expense.category] += expense.amount || 0;
    });
  });

  const sortedCategories = Object.entries(expenseCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  const labels = sortedCategories.map((item) => item[0]);
  const expenseData = sortedCategories.map((item) => item[1]);

  const backgroundColors = generateDistinctColors(expenseData.length);
  const borderColors = backgroundColors.map((color) => color.replace("0.2", "1"));

  const ctx = document.getElementById("expenseBreakdownChart")?.getContext("2d");
  if (!ctx) {
    console.error("Error: 'expenseBreakdownChart' canvas not found.");
    return;
  }

  if (window.expenseBreakdownChart && window.expenseBreakdownChart.destroy) {
    window.expenseBreakdownChart.destroy();
  }

  window.expenseBreakdownChart = new Chart(ctx, {
    type: "pie",
    data: {
      labels: labels,
      datasets: [
        {
          label: "Expenses Breakdown",
          data: expenseData,
          backgroundColor: backgroundColors,
          borderColor: borderColors,
          borderWidth: 2,
        },
      ],
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: "top",
            labels: {
              font: { size: 10 },
              boxWidth: 12,
              padding: 5,
            },
          },
        },
      },
    },
  });
}

function generateDistinctColors(num) {
  const baseColors = [
    "rgba(255, 99, 132, 0.2)",
    "rgba(54, 162, 235, 0.2)",
    "rgba(255, 206, 86, 0.2)",
    "rgba(75, 192, 192, 0.2)",
    "rgba(153, 102, 255, 0.2)",
    "rgba(255, 159, 64, 0.2)",
    "rgba(100, 100, 100, 0.2)",
    "rgba(255, 205, 86, 0.2)",
    "rgba(0, 255, 255, 0.2)",
    "rgba(128, 0, 128, 0.2)",
  ];

  const colors = [];
  for (let i = 0; i < num; i++) {
    colors.push(baseColors[i % baseColors.length]);
  }
  return colors;
}











function generateAndDisplayTips(allMonths, monthsToInclude, savingRate) {
  // Embedded tips configuration to avoid CORS issue
  const tipsConfig = {
    "Essentials": {
      "Rent / Mortgage": [
        "Great job maintaining your housing stability!",
        "Consistently paying rent builds financial reliability.",
        "Consider negotiating lease terms or exploring refinancing if possible."
      ],
      "Utils - Electricity": [
        "Energy-efficient appliances can reduce your electricity bill.",
        "Unplugging devices when not in use helps conserve energy.",
        "Opening up window could possibly bring in fresh air reducing usage of AC and electricity"
      ],
      "Utils - Water": [
        "Fixing leaks and using low-flow fixtures can reduce water waste.",
        "Running full loads in washers and dishwashers helps save water."
      ],
      "Utils - Gas": [
        "Regular maintenance of heating systems can improve gas efficiency.",
        "Lowering the thermostat slightly can reduce gas consumption."
      ],
      "Utils - Misc.": [
        "Review miscellaneous utility charges for opportunities to bundle or reduce.",
        "Monitoring bills regularly helps avoid unnecessary fees."
      ],
      "Groceries": [
        "Meal planning helps reduce waste and save money.",
        "Throwing leftover food adds to food wastage plus expense. Eat whatever you cook",
        "Buying seasonal and local produce can cut down grocery costs."
      ],
      "Vehicle Fuel": [
        "Maintaining proper tire pressure improves fuel efficiency.",
        "Ride Sharing with a friend will not only save your and them fuel cost but also build strong friendship",
        "Combining errands in one trip reduces overall fuel usage."
      ],
      "Public Transit": [
        "Public transit is a budget-friendly and eco-conscious choice!",
        "Monthly passes often offer savings compared to daily tickets."
      ],
      "Ride-share": [
        "Generally Ride share reduces the fuel expense, what are we doing different here?",
        "Look out for promo codes to reduce expenses."
      ],
      "Mobile Bills": [
        "Review your data usage and choose the best-fit plan.",
        "Bundling mobile and internet services may offer discounts."
      ],
      "Internet Bills": [
        "Check if you're paying for more speed than needed.",
        "Compare providers annually for better deals."
      ],
      "Insurance - Health": [
        "Regular preventive care can reduce long-term medical costs.",
        "Explore if you’re eligible for group or employer discounts."
      ],
      "Insurance - Auto": [
        "Maintaining a clean driving record can lower premiums.",
        "Consider bundling policies for multi-policy discounts."
      ],
      "Insurance - Home": [
        "Review coverage annually to ensure it meets your needs.",
        "Installing security features may reduce premiums."
      ],
      "Home Loan EMI": [
        "Additional Savings will Prepare you to close the Home Loan quicker.",
        "Consider prepaying if possible to reduce interest burden."
      ],
      "Student Loan EMI": [
        "A Side hustle (if you are doing) and saving from it can help you get rid of this load faster.",
        "Look into refinancing options for lower interest rates."
      ],
      "Personal Loan EMI": [
        "Try closing this as quick as possible.",
        "Consolidating loans may simplify payments."
      ],
      "Vehicle Loan EMI": [
        "Early repayment can reduce interest costs.",
        "Stay on top of EMIs to maintain your credit health."
      ],
      "Child Care": [
        "Explore employer-supported childcare benefits if available.",
        "Balancing between daycare and family support can save costs."
      ],
      "School Fees": [
        "Paying in bulk may offer discounts on tuition.",
        "Look out for educational tax deductions."
      ],
      "Medical Expenses": [
        "Health savings accounts (HSA/FSA) can help offset costs.",
        "Preventive care helps reduce long-term medical bills."
      ],
      "Pet care": [
        "Preventive vet care helps avoid large emergency bills.",
        "Buying pet supplies in bulk saves money over time."
      ]
    },
    "Personal & Lifestyle": {
      "Dining": [
        "Cooking at home is a healthy and cost-saving habit.",
        "Plan special dine-outs to enjoy and stay on budget."
      ],
      "Media Subscriptions": [
        "Review subscriptions and cancel unused ones.",
        "Consider rotating subscriptions to save monthly."
      ],
      "Clothing": [
        "Seasonal sales are great for smart clothing purchases.",
        "Donating old clothes can make space and feel good!"
      ],
      "Personal Care": [
        "Self-care is essential — budget accordingly!",
        "DIY grooming and spa days can save money and be fun."
      ],
      "Gifts / Donation": [
        "Budgeting for gifts ensures joyful giving without stress.",
        "Giving to causes you care about brings meaning to spending."
      ]
    },
    "Future": {
      "Emergency Fund": [
        "An emergency fund offers security during unexpected events.",
        "Consistent contributions build strong safety nets over time."
      ],
      "Retirement Contri": [
        "Early retirement contributions grow significantly over time.",
        "Even small regular investments make a big difference later."
      ],
      "Investments": [
        "Investing early helps build long-term wealth.",
        "Review your portfolio periodically to align with goals."
      ]
    },
    "Financial Trends": {
      "stableExpense": "Your expenses are steady, showing good financial consistency.",
      "growingExpense": "Your expenses have been growing recently — consider reviewing adjustable categories for opportunities to save.",
      "reducingExpense": "Great job! Your expenses have been declining — keep up the mindful spending."
    },
    "Income Trends": {
      "stableIncome": "Your income has been stable — a reliable foundation for planning.",
      "increasingIncome": "Your income is growing — a great time to boost savings or investments.",
      "decreasingIncome": "Your income has declined recently — be cautious with new expenses."
    },
    "Savings Health": {
      "excellent": "Your savings rate is strong — you're on track for long-term goals.",
      "moderate": "Your savings rate is steady — small improvements can go a long way.",
      "low": "Your savings are low — aim to prioritize saving a fixed portion monthly."
    }
  };

  const tipsContainer = document.getElementById("tips-container");
  tipsContainer.innerHTML = '<h3 class="font-semibold mb-1">Tips and Suggestions</h3>';

  // 1. Get top 3-5 expense categories and calculate total expenses
  const expenseCategories = {};
  let totalExpenses = 0;
  monthsToInclude.forEach((monthKey) => {
    const data = allMonths[monthKey];
    if (!data) return;
    data.expenses.forEach((expense) => {
      if (!expenseCategories[expense.category]) {
        expenseCategories[expense.category] = 0;
      }
      expenseCategories[expense.category] += expense.amount;
      totalExpenses += expense.amount;
    });
  });

  const sortedCategories = Object.entries(expenseCategories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5); // Get top 5 categories

  // Define adjustable categories
  const adjustableCategories = [
    'Dining', 'Media Subscriptions', 'Clothing', 'Personal Care', 
    'Gifts / Donation', 'Ride-share', 'Mobile Bills', 'Internet Bills'
  ];

  // Add tips for top expense categories with percentage insight
  sortedCategories.forEach(([category, amount]) => {
    const categoryTips = tipsConfig['Essentials'][category] || 
                        tipsConfig['Personal & Lifestyle'][category] || 
                        tipsConfig['Future'][category];
    const percentage = totalExpenses > 0 ? Math.round((amount / totalExpenses) * 100) : 0;
    const tip = categoryTips 
      ? categoryTips[Math.floor(Math.random() * categoryTips.length)] 
      : 'Consider reviewing this expense to optimize your budget.';
    const isAdjustable = adjustableCategories.includes(category) ? ' (Consider reducing this adjustable expense)' : '';
    const tipElement = document.createElement('div');
    tipElement.className = 'bg-white p-4 shadow rounded border-l-4 border-blue-500 text-lg text-gray-700 mb-1';
    tipElement.textContent = `${category} consumes ${percentage}% of your expenses. ${tip}${isAdjustable}`;
    tipsContainer.appendChild(tipElement);
  });

  // 2. Determine financial trend
if (monthsToInclude.length >= 2) {
  let expenseTrend = 'stableExpense';
  if (monthsToInclude.length >= 2) {
    const expensesByMonth = monthsToInclude.map(monthKey => {
      const data = allMonths[monthKey];
      return data ? data.expenses.reduce((sum, item) => sum + item.amount, 0) : 0;
    }).filter(val => val > 0);

    if (expensesByMonth.length >= 2) {
      const recent = expensesByMonth[0];
      const previous = expensesByMonth[1];
      if (recent > previous * 1.1) {
        expenseTrend = 'growingExpense';
      } else if (recent < previous * 0.9) {
        expenseTrend = 'reducingExpense';
      }
    }
  }

  const trendElement = document.createElement('div');
  trendElement.className = 'bg-white p-4 shadow rounded border-l-4 border-blue-500 text-lg text-gray-700 mb-1 font-medium';
  trendElement.textContent = tipsConfig['Financial Trends'][expenseTrend];
  tipsContainer.appendChild(trendElement);
}


  // 3. Determine savings health
if (monthsToInclude.length >= 2) {
  const savingsHealth = savingRate >= 20 ? 'excellent' : 
                       savingRate >= 10 ? 'moderate' : 'low';
  const savingsElement = document.createElement('div');
  savingsElement.className = 'bg-white p-4 shadow rounded border-l-4 border-blue-500 text-lg text-gray-700 mb-1 font-medium';
  savingsElement.textContent = tipsConfig['Savings Health'][savingsHealth];
  tipsContainer.appendChild(savingsElement);
}
}


