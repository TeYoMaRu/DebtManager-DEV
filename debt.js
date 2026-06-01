/* =========================================================
   Supabase Config
   เปลี่ยน 2 บรรทัดนี้เป็นของโปรเจกต์คุณ
========================================================= */
const SUPABASE_URL = "https://teqpvdsxihbgknicupvj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcXB2ZHN4aWhiZ2tuaWN1cHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDg4MDUsImV4cCI6MjA5NTg4NDgwNX0.cMCBlzvRpHn9crzHcPavFVCsrvgaweBbXvjxF7ezhI8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let debts = [];
let installmentPlans = [];
let currentIncome = 0;
let currentFamilyExpense = 0;
let familyExpenses = [];
let moneyRequests = [];
let debtBorrowMap = {};


/* =========================================================
   Helpers
========================================================= */
function money(num) {
  return Number(num || 0).toLocaleString("th-TH", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  });
}

function getCurrentMonthRange() {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  return {
    start: start.toISOString().slice(0, 10),
    end: end.toISOString().slice(0, 10)
  };
}

function setToday() {
  const el = document.getElementById("transactionDate");
  if (el) el.value = new Date().toISOString().slice(0, 10);
}

/* =========================================================
   Load Debts
========================================================= */
async function loadDebts() {
  const { data, error } = await supabaseClient
    .from("debts")
    .select("*")
    .eq("status", "active")
    .order("created_at", { ascending: false });

  if (error) {
    alert("โหลดข้อมูลหนี้ไม่สำเร็จ: " + error.message);
    return;
  }

  debts = data || [];
  renderDebts();
  renderAllDebtSelectOptions();
  renderSummary();
  await loadDebtBorrowMap();
renderDebtPriorityPlan();
  renderCashflowDashboard();
}

/* =========================================================
   Render Debt Table
========================================================= */
function renderDebts() {
  const tbody = document.getElementById("debtList");

  if (!debts.length) {
    tbody.innerHTML = `<tr><td colspan="6">ยังไม่มีรายการหนี้</td></tr>`;
    return;
  }

  tbody.innerHTML = debts.map(debt => `
    <tr>
      <td>
        <strong>${debt.name}</strong><br>
        <small>${getDebtTypeLabel(debt.debt_type)}</small>
      </td>
      <td class="amount-red">${money(debt.balance)}</td>
      <td>${money(debt.monthly_payment)}</td>
      <td>${debt.statement_day || "-"}</td>
      <td>${debt.due_day || "-"}</td>
      <td>
        <button class="btn-small btn-delete" onclick="deleteDebt('${debt.id}')">
          ลบ
        </button>
      </td>
    </tr>
  `).join("");
}

function getDebtTypeLabel(type) {
  const map = {
    credit_card: "บัตรเครดิต",
    loan: "สินเชื่อ",
    car: "รถยนต์",
    other: "อื่น ๆ"
  };

  return map[type] || type;
}

/* =========================================================
   Render Select Options
========================================================= */
function renderDebtOptions() {
  const select = document.getElementById("transactionDebt");

  if (!debts.length) {
    select.innerHTML = `<option value="">ยังไม่มีรายการหนี้</option>`;
    return;
  }

  select.innerHTML = debts.map(debt => `
    <option value="${debt.id}">
      ${debt.name} | คงเหลือ ${money(debt.balance)}
    </option>
  `).join("");
}

/* =========================================================
   Render Summary
========================================================= */
async function renderSummary() {
  const totalBalance = debts.reduce((sum, d) => sum + Number(d.balance || 0), 0);
  const totalMonthly = debts.reduce((sum, d) => sum + Number(d.monthly_payment || 0), 0);

  document.getElementById("sumBalance").textContent = money(totalBalance);
  document.getElementById("sumMonthly").textContent = money(totalMonthly);

  await renderBorrowThisMonth();
}

async function renderBorrowThisMonth() {
  const { start, end } = getCurrentMonthRange();

  const { data, error } = await supabaseClient
    .from("debt_transactions")
    .select("amount")
    .eq("transaction_type", "borrow")
    .gte("transaction_date", start)
    .lte("transaction_date", end);

  if (error) {
    console.error(error);
    return;
  }

  const totalBorrow = (data || []).reduce((sum, row) => {
    return sum + Number(row.amount || 0);
  }, 0);

  document.getElementById("sumBorrowThisMonth").textContent = money(totalBorrow);
}

/* =========================================================
   Add Debt
========================================================= */
document.getElementById("debtForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    debt_type: document.getElementById("debtType").value,
    name: document.getElementById("debtName").value.trim(),
    balance: Number(document.getElementById("balance").value || 0),
    monthly_payment: Number(document.getElementById("monthlyPayment").value || 0),
    statement_day: Number(document.getElementById("statementDay").value || 0) || null,
    due_day: Number(document.getElementById("dueDay").value || 0) || null,
    interest_rate: Number(document.getElementById("interestRate").value || 0),
    note: document.getElementById("note").value.trim()
  };

  const { error } = await supabaseClient
    .from("debts")
    .insert(payload);

  if (error) {
    alert("บันทึกหนี้ไม่สำเร็จ: " + error.message);
    return;
  }

  e.target.reset();
  await loadDebts();
});

/* =========================================================
   Add Transaction
   payment  = ลดยอดหนี้
   borrow   = เพิ่มยอดหนี้
   interest = เพิ่มยอดหนี้
========================================================= */
document.getElementById("transactionForm").addEventListener("submit", async (e) => {
  e.preventDefault();

  const debtId = document.getElementById("transactionDebt").value;
  const type = document.getElementById("transactionType").value;
  const amount = Number(document.getElementById("transactionAmount").value || 0);

  if (!debtId || amount <= 0) {
    alert("กรุณาเลือกรายการหนี้และใส่จำนวนเงิน");
    return;
  }

  const debt = debts.find(d => d.id === debtId);
  if (!debt) {
    alert("ไม่พบข้อมูลหนี้");
    return;
  }

  let newBalance = Number(debt.balance || 0);

  if (type === "payment") {
    newBalance -= amount;
  } else if (type === "borrow" || type === "interest" || type === "adjustment") {
    newBalance += amount;
  }

  if (newBalance < 0) newBalance = 0;

  const transactionPayload = {
    debt_id: debtId,
    transaction_type: type,
    amount,
    transaction_date: document.getElementById("transactionDate").value,
    note: document.getElementById("transactionNote").value.trim()
  };

  const { error: txError } = await supabaseClient
    .from("debt_transactions")
    .insert(transactionPayload);

  if (txError) {
    alert("บันทึกรายการไม่สำเร็จ: " + txError.message);
    return;
  }

  const { error: updateError } = await supabaseClient
    .from("debts")
    .update({ balance: newBalance })
    .eq("id", debtId);

  if (updateError) {
    alert("อัปเดตยอดหนี้ไม่สำเร็จ: " + updateError.message);
    return;
  }

  e.target.reset();
  setToday();
  await loadDebts();
  await loadDebtBorrowMap();
renderDebtPriorityPlan();
});

/* =========================================================
   Delete Debt
========================================================= */
async function deleteDebt(id) {
  const ok = confirm("ต้องการลบรายการหนี้นี้ใช่ไหม?");
  if (!ok) return;

  const { error } = await supabaseClient
    .from("debts")
    .update({ status: "deleted" })
    .eq("id", id);

  if (error) {
    alert("ลบไม่สำเร็จ: " + error.message);
    return;
  }

  await loadDebts();
}







function renderAllDebtSelectOptions() {
  const selects = [
    document.getElementById("transactionDebt"),
    document.getElementById("installmentDebt"),
    document.getElementById("historyDebtSelect")
  ];

  selects.forEach(select => {
    if (!select) return;

    if (!debts.length) {
      select.innerHTML = `<option value="">ยังไม่มีรายการหนี้</option>`;
      return;
    }

    select.innerHTML = `
      <option value="">เลือกรายการหนี้</option>
      ${debts.map(debt => `
        <option value="${debt.id}">
          ${debt.name} | คงเหลือ ${money(debt.balance)}
        </option>
      `).join("")}
    `;
  });
}




function updateInstallmentPreview() {
  const amount = Number(document.getElementById("installmentAmount")?.value || 0);
  const months = Number(document.getElementById("installmentMonths")?.value || 0);
  const preview = document.getElementById("installmentPreview");

  if (!preview) return;

  if (amount <= 0 || months <= 0) {
    preview.textContent = "เลือกยอดและจำนวนเดือน เพื่อดูค่างวดต่อเดือน";
    return;
  }

  const monthly = amount / months;

  preview.innerHTML = `
    ยอดผ่อน ${money(amount)} บาท /
    ${months} เดือน =
    ต้องจ่ายเดือนละ ${money(monthly)} บาท
  `;
}

document.getElementById("installmentAmount")?.addEventListener("input", updateInstallmentPreview);
document.getElementById("installmentMonths")?.addEventListener("change", updateInstallmentPreview);






document.getElementById("installmentForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const debtId = document.getElementById("installmentDebt").value;
  const amount = Number(document.getElementById("installmentAmount").value || 0);
  const months = Number(document.getElementById("installmentMonths").value || 0);
  const startDate = document.getElementById("installmentStartDate").value;
  const dueDay = Number(document.getElementById("installmentDueDay").value || 0) || null;

  if (!debtId || amount <= 0 || months <= 0 || !startDate) {
    alert("กรุณากรอกข้อมูลแผนผ่อนให้ครบ");
    return;
  }

  const monthlyAmount = amount / months;

  const payload = {
    debt_id: debtId,
    principal_amount: amount,
    installment_months: months,
    monthly_amount: monthlyAmount,
    start_date: startDate,
    due_day: dueDay,
    remaining_months: months,
    status: "active"
  };

  const { error } = await supabaseClient
    .from("debt_installment_plans")
    .insert(payload);

  if (error) {
    alert("สร้างแผนผ่อนไม่สำเร็จ: " + error.message);
    return;
  }

  e.target.reset();
  setInstallmentToday();
  updateInstallmentPreview();
  await loadInstallmentPlans();
});







async function loadInstallmentPlans() {
  const { data, error } = await supabaseClient
    .from("debt_installment_plans")
    .select(`
      *,
      debts (
        name
      )
    `)
    .order("created_at", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  installmentPlans = data || [];
  renderInstallmentPlans();
  loadInstallmentPlans
}

function renderInstallmentPlans() {
  const tbody = document.getElementById("installmentList");
  if (!tbody) return;

  if (!installmentPlans.length) {
    tbody.innerHTML = `<tr><td colspan="6">ยังไม่มีแผนผ่อน</td></tr>`;
    return;
  }

  tbody.innerHTML = installmentPlans.map(plan => `
    <tr>
      <td>${plan.debts?.name || "-"}</td>
      <td>${money(plan.principal_amount)}</td>
      <td>${plan.installment_months} เดือน</td>
      <td class="amount-red">${money(plan.monthly_amount)}</td>
      <td>${plan.remaining_months} งวด</td>
      <td>
        <span class="${plan.status === "active" ? "badge-active" : "badge-closed"}">
          ${plan.status === "active" ? "กำลังผ่อน" : "ปิดแล้ว"}
        </span>
      </td>
    </tr>
  `).join("");
}







document.getElementById("historyDebtSelect")?.addEventListener("change", async (e) => {
  const debtId = e.target.value;
  await loadDebtHistory(debtId);
});

async function loadDebtHistory(debtId) {
  const tbody = document.getElementById("historyList");

  if (!debtId) {
    tbody.innerHTML = `<tr><td colspan="4">เลือกรายการหนี้เพื่อดูประวัติ</td></tr>`;
    return;
  }

  const { data, error } = await supabaseClient
    .from("debt_transactions")
    .select("*")
    .eq("debt_id", debtId)
    .order("transaction_date", { ascending: false });

  if (error) {
    alert("โหลดประวัติไม่สำเร็จ: " + error.message);
    return;
  }

  if (!data.length) {
    tbody.innerHTML = `<tr><td colspan="4">ยังไม่มีประวัติรายการ</td></tr>`;
    return;
  }

  tbody.innerHTML = data.map(row => `
    <tr>
      <td>${row.transaction_date}</td>
      <td>${getTransactionTypeLabel(row.transaction_type)}</td>
      <td class="${row.transaction_type === "payment" ? "amount-green" : "amount-red"}">
        ${row.transaction_type === "payment" ? "-" : "+"}${money(row.amount)}
      </td>
      <td>${row.note || "-"}</td>
    </tr>
  `).join("");
}

function getTransactionTypeLabel(type) {
  const map = {
    payment: "จ่ายหนี้",
    borrow: "กดเพิ่ม",
    interest: "ดอกเบี้ย/ค่าธรรมเนียม",
    adjustment: "ปรับยอด"
  };

  return map[type] || type;
}




function setInstallmentToday() {
  const el = document.getElementById("installmentStartDate");
  if (el) el.value = new Date().toISOString().slice(0, 10);
}




function calculateDebtMonthlyPayment() {
  return debts.reduce((sum, debt) => {
    return sum + Number(debt.monthly_payment || 0);
  }, 0);
}

function calculateApprovedMoneyRequests() {
  return moneyRequests
    .filter(row => row.status === "approved")
    .reduce((sum, row) => {
      return sum + Number(row.amount || 0);
    }, 0);
}

function renderCashflowDashboard() {
  const debtMonthly = calculateDebtMonthlyPayment();
  const installmentMonthly = calculateActiveInstallmentMonthly();
  const approvedRequests = calculateApprovedMoneyRequests();
  const approvedEl = document.getElementById("dashApprovedRequests");
if (approvedEl) approvedEl.textContent = money(approvedRequests);

  const totalOut =
    currentFamilyExpense +
    debtMonthly +
    installmentMonthly +
    approvedRequests;

  const net = currentIncome - totalOut;

  document.getElementById("dashIncome").textContent = money(currentIncome);
  document.getElementById("dashExpense").textContent = money(totalOut);

  const netEl = document.getElementById("dashNet");
  netEl.textContent = money(net);

  if (net < 0) {
    netEl.classList.add("text-negative");
  } else {
    netEl.classList.remove("text-negative");
  }

  renderCashflowAlert(net, debtMonthly, installmentMonthly, approvedRequests);
  renderCashflowTable(debtMonthly, installmentMonthly, approvedRequests);
  renderSurvivalSimulator();
}



function renderCashflowAlert(net, debtMonthly, installmentMonthly, approvedRequests) {
  const alert = document.getElementById("cashflowAlert");
  if (!alert) return;

  if (net < 0) {
    alert.className = "alert-box alert-danger";
    alert.innerHTML = `
      เดือนนี้เงินไม่พอ ขาดประมาณ ${money(Math.abs(net))} บาท<br>
      หนี้ที่ต้องจ่าย ${money(debtMonthly)} บาท /
      แผนผ่อน ${money(installmentMonthly)} บาท /
      คำขอใช้เงินที่อนุมัติแล้ว ${money(approvedRequests)} บาท
    `;
  } else {
    alert.className = "alert-box alert-safe";
    alert.innerHTML = `
      เดือนนี้ยังพอเหลือ ${money(net)} บาท<br>
      รวมคำขอใช้เงินที่อนุมัติแล้ว ${money(approvedRequests)} บาท
    `;
  }
}



function renderCashflowTable(debtMonthly, installmentMonthly, approvedRequests) {
  const tbody = document.getElementById("cashflowTable");
  if (!tbody) return;

  let balance = 0;
  const rows = [];

  rows.push({
    day: 1,
    name: "รายได้เข้า",
    income: currentIncome,
    outcome: 0
  });

  debts.forEach(debt => {
    rows.push({
      day: Number(debt.due_day || 25),
      name: `จ่ายหนี้: ${debt.name}`,
      income: 0,
      outcome: Number(debt.monthly_payment || 0)
    });
  });

  installmentPlans
    .filter(plan => plan.status === "active")
    .forEach(plan => {
      rows.push({
        day: Number(plan.due_day || 25),
        name: `แผนผ่อน: ${plan.debts?.name || "-"}`,
        income: 0,
        outcome: Number(plan.monthly_amount || 0)
      });
    });

  moneyRequests
    .filter(row => row.status === "approved")
    .forEach(row => {
      const day = new Date(row.request_date).getDate();

      rows.push({
        day,
        name: `อนุมัติใช้เงิน: ${row.requester_name} - ${row.item_name}`,
        income: 0,
        outcome: Number(row.amount || 0)
      });
    });

  rows.push({
    day: 30,
    name: "รายจ่ายครอบครัวพื้นฐาน",
    income: 0,
    outcome: currentFamilyExpense
  });

  rows.sort((a, b) => a.day - b.day);

  tbody.innerHTML = rows.map(row => {
    balance += Number(row.income || 0);
    balance -= Number(row.outcome || 0);

    return `
      <tr>
        <td>วันที่ ${row.day}</td>
        <td>${row.name}</td>
        <td class="text-income">
          ${row.income ? "+" + money(row.income) : "-"}
        </td>
        <td class="text-out">
          ${row.outcome ? "-" + money(row.outcome) : "-"}
        </td>
        <td class="${balance < 0 ? "text-negative" : ""}">
          ${money(balance)}
        </td>
      </tr>
    `;
  }).join("");
}



document.getElementById("cashflowForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  currentIncome = Number(document.getElementById("monthlyIncome").value || 0);
  currentFamilyExpense = Number(document.getElementById("monthlyExpense").value || 0);

  renderCashflowDashboard();
});




function getExpenseCategoryLabel(category) {
  const map = {
    food: "อาหาร",
    home: "ของใช้ในบ้าน",
    fuel: "ค่าน้ำมัน / เดินทาง",
    utility: "ค่าน้ำ / ค่าไฟ",
    child: "ลูก / ค่าเรียน",
    medical: "ยา / รักษา",
    other: "อื่น ๆ"
  };

  return map[category] || category;
}

function getNecessityLabel(value) {
  const map = {
    necessary: "จำเป็น",
    normal: "ปกติ",
    not_necessary: "ไม่จำเป็น"
  };

  return map[value] || value;
}

function getRequestStatusLabel(status) {
  const map = {
    pending: "รอพิจารณา",
    approved: "อนุมัติ",
    rejected: "ปฏิเสธ"
  };

  return map[status] || status;
}




document.getElementById("familyExpenseForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    expense_date: document.getElementById("expenseDate").value,
    category: document.getElementById("expenseCategory").value,
    amount: Number(document.getElementById("expenseAmount").value || 0),
    note: document.getElementById("expenseNote").value.trim()
  };

  const { error } = await supabaseClient
    .from("family_expenses")
    .insert(payload);

  if (error) {
    alert("บันทึกรายจ่ายไม่สำเร็จ: " + error.message);
    return;
  }

  e.target.reset();
  setExpenseToday();
  await loadFamilyExpenses();
});



async function loadFamilyExpenses() {
  const { start, end } = getCurrentMonthRange();

  const { data, error } = await supabaseClient
    .from("family_expenses")
    .select("*")
    .gte("expense_date", start)
    .lte("expense_date", end)
    .order("expense_date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  familyExpenses = data || [];
  renderFamilyExpenses();
}

function renderFamilyExpenses() {
  const tbody = document.getElementById("familyExpenseList");
  if (!tbody) return;

  if (!familyExpenses.length) {
    tbody.innerHTML = `<tr><td colspan="4">ยังไม่มีรายจ่าย</td></tr>`;
    return;
  }

  tbody.innerHTML = familyExpenses.map(row => `
    <tr>
      <td>${row.expense_date}</td>
      <td>${getExpenseCategoryLabel(row.category)}</td>
      <td class="text-out">${money(row.amount)}</td>
      <td>${row.note || "-"}</td>
    </tr>
  `).join("");
}



document.getElementById("moneyRequestForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();

  const payload = {
    requester_name: document.getElementById("requesterName").value.trim(),
    item_name: document.getElementById("requestItem").value.trim(),
    amount: Number(document.getElementById("requestAmount").value || 0),
    necessity: document.getElementById("requestNecessity").value,
    note: document.getElementById("requestNote").value.trim(),
    status: "pending"
  };

  const { error } = await supabaseClient
    .from("money_requests")
    .insert(payload);

  if (error) {
    alert("บันทึกรายการขอเงินไม่สำเร็จ: " + error.message);
    return;
  }

  e.target.reset();
  await loadMoneyRequests();
});





async function loadMoneyRequests() {
  const { start, end } = getCurrentMonthRange();

  const { data, error } = await supabaseClient
    .from("money_requests")
    .select("*")
    .gte("request_date", start)
    .lte("request_date", end)
    .order("request_date", { ascending: false });

  if (error) {
    console.error(error);
    return;
  }

  moneyRequests = data || [];
  renderMoneyRequests();
  renderMoneyRequestSummary();
  renderCashflowDashboard();
}



function renderMoneyRequests() {
  const tbody = document.getElementById("moneyRequestList");
  if (!tbody) return;

  if (!moneyRequests.length) {
    tbody.innerHTML = `<tr><td colspan="7">ยังไม่มีรายการขอใช้เงิน</td></tr>`;
    return;
  }

  tbody.innerHTML = moneyRequests.map(row => {
    const statusClass =
      row.status === "approved"
        ? "badge-approved"
        : row.status === "rejected"
          ? "badge-rejected"
          : "badge-pending";

    const needClass =
      row.necessity === "necessary"
        ? "need-high"
        : row.necessity === "not_necessary"
          ? "need-low"
          : "";

    return `
      <tr>
        <td>${row.request_date}</td>
        <td>${row.requester_name}</td>
        <td>
          <strong>${row.item_name}</strong><br>
          <small>${row.note || ""}</small>
        </td>
        <td class="text-out">${money(row.amount)}</td>
        <td class="${needClass}">${getNecessityLabel(row.necessity)}</td>
        <td>
          <span class="${statusClass}">
            ${getRequestStatusLabel(row.status)}
          </span>
        </td>
        <td>
          <div class="action-group">
            <button class="btn-small btn-approve" onclick="updateMoneyRequestStatus('${row.id}', 'approved')">
              อนุมัติ
            </button>
            <button class="btn-small btn-reject" onclick="updateMoneyRequestStatus('${row.id}', 'rejected')">
              ปฏิเสธ
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join("");
}


async function updateMoneyRequestStatus(id, status) {
  const request = moneyRequests.find(row => row.id === id);

  if (!request) {
    alert("ไม่พบรายการนี้");
    return;
  }

  if (status === "approved") {
    const debtMonthly = calculateDebtMonthlyPayment();
    const installmentMonthly = calculateActiveInstallmentMonthly();
    const approvedRequests = calculateApprovedMoneyRequests();

    const nextApprovedTotal = approvedRequests + Number(request.amount || 0);

    const totalOut =
      currentFamilyExpense +
      debtMonthly +
      installmentMonthly +
      nextApprovedTotal;

    const nextNet = currentIncome - totalOut;

    const confirmText = `
อนุมัติรายการนี้ใช่ไหม?

รายการ: ${request.item_name}
จำนวน: ${money(request.amount)} บาท

หลังอนุมัติแล้ว
เงินเดือนนี้จะเหลือ/ขาด: ${money(nextNet)} บาท
    `;

    const ok = confirm(confirmText);
    if (!ok) return;
  }

  const { error } = await supabaseClient
    .from("money_requests")
    .update({ status })
    .eq("id", id);

  if (error) {
    alert("อัปเดตสถานะไม่สำเร็จ: " + error.message);
    return;
  }

  await loadMoneyRequests();
}



function renderMoneyRequestSummary() {
  const pending = moneyRequests
    .filter(row => row.status === "pending")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const approved = moneyRequests
    .filter(row => row.status === "approved")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  const rejected = moneyRequests
    .filter(row => row.status === "rejected")
    .reduce((sum, row) => sum + Number(row.amount || 0), 0);

  document.getElementById("sumRequestPending").textContent = money(pending);
  document.getElementById("sumRequestApproved").textContent = money(approved);
  document.getElementById("sumRequestRejected").textContent = money(rejected);
}



function setExpenseToday() {
  const el = document.getElementById("expenseDate");
  if (el) el.value = new Date().toISOString().slice(0, 10);
}

async function loadDebtBorrowMap() {
  const { start, end } = getCurrentMonthRange();

  const { data, error } = await supabaseClient
    .from("debt_transactions")
    .select("debt_id, amount")
    .eq("transaction_type", "borrow")
    .gte("transaction_date", start)
    .lte("transaction_date", end);

  if (error) {
    console.error(error);
    return;
  }

  debtBorrowMap = {};

  (data || []).forEach(row => {
    if (!debtBorrowMap[row.debt_id]) {
      debtBorrowMap[row.debt_id] = 0;
    }

    debtBorrowMap[row.debt_id] += Number(row.amount || 0);
  });

  renderDebtPriorityPlan();
}


function calculateDebtRiskScore(debt) {
  const balance = Number(debt.balance || 0);
  const monthlyPayment = Number(debt.monthly_payment || 0);
  const borrowedThisMonth = Number(debtBorrowMap[debt.id] || 0);

  let score = 0;

  score += balance / 10000;
  score += monthlyPayment / 1000 * 2;
  score += borrowedThisMonth / 1000 * 3;

  return Math.round(score);
}

function getRiskLevel(score) {
  if (score >= 25) {
    return {
      label: "สูง",
      className: "risk-high"
    };
  }

  if (score >= 12) {
    return {
      label: "กลาง",
      className: "risk-medium"
    };
  }

  return {
    label: "ต่ำ",
    className: "risk-low"
  };
}

function getDebtAdvice(debt) {
  const balance = Number(debt.balance || 0);
  const monthlyPayment = Number(debt.monthly_payment || 0);
  const borrowedThisMonth = Number(debtBorrowMap[debt.id] || 0);

  if (borrowedThisMonth > 0) {
    return "ควรหยุดกดเพิ่มก้อนนี้ก่อน เพราะจ่ายแล้วถูกดึงกลับมาใช้";
  }

  if (monthlyPayment >= 5000) {
    return "ภาระรายเดือนสูง ควรเจรจาหรือวางแผนลดค่างวด";
  }

  if (balance <= 30000) {
    return "ยอดไม่สูงมาก เหมาะกับการปิดให้จบเพื่อลดจำนวนเจ้าหนี้";
  }

  return "จ่ายขั้นต่ำให้ตรงก่อน แล้วค่อยวางแผนโปะเมื่อเงินสดเป็นบวก";
}


function renderDebtPriorityPlan() {
  const tbody = document.getElementById("debtPriorityList");
  if (!tbody) return;

  if (!debts.length) {
    tbody.innerHTML = `<tr><td colspan="7">ยังไม่มีข้อมูลสำหรับวิเคราะห์</td></tr>`;
    return;
  }

  const ranked = debts
    .map(debt => {
      const borrowedThisMonth = Number(debtBorrowMap[debt.id] || 0);
      const score = calculateDebtRiskScore(debt);
      const risk = getRiskLevel(score);

      return {
        ...debt,
        borrowedThisMonth,
        score,
        risk
      };
    })
    .sort((a, b) => b.score - a.score);

  const top = ranked[0];

  document.getElementById("priorityDebtName").textContent = top?.name || "-";
  document.getElementById("priorityDebtReason").textContent =
    getDebtAdvice(top) || "-";
  document.getElementById("priorityDebtAmount").textContent =
    money(top?.balance || 0);

  tbody.innerHTML = ranked.map((debt, index) => `
    <tr>
      <td>${index + 1}</td>
      <td>
        <strong>${debt.name}</strong><br>
        <small>${getDebtTypeLabel(debt.debt_type)}</small>
      </td>
      <td class="amount-red">${money(debt.balance)}</td>
      <td>${money(debt.monthly_payment)}</td>
      <td class="text-out">${money(debt.borrowedThisMonth)}</td>
      <td>
        <span class="${debt.risk.className}">
          ${debt.risk.label} (${debt.score})
        </span>
      </td>
      <td>${getDebtAdvice(debt)}</td>
    </tr>
  `).join("");
}

function getCurrentNetCashflow() {
  const debtMonthly = calculateDebtMonthlyPayment();
  const installmentMonthly = calculateActiveInstallmentMonthly();
  const approvedRequests = calculateApprovedMoneyRequests();

  const totalOut =
    currentFamilyExpense +
    debtMonthly +
    installmentMonthly +
    approvedRequests;

  return currentIncome - totalOut;
}

function getBorrowThisMonthTotal() {
  return Object.values(debtBorrowMap).reduce((sum, amount) => {
    return sum + Number(amount || 0);
  }, 0);
}

function renderSurvivalSimulator() {
  const currentNet = getCurrentNetCashflow();

  const reduceExpense = Number(document.getElementById("simReduceExpense")?.value || 0);
  const increaseIncome = Number(document.getElementById("simIncreaseIncome")?.value || 0);
  const stopBorrow = Number(document.getElementById("simStopBorrow")?.value || 0);

  const newNet =
    currentNet +
    reduceExpense +
    increaseIncome +
    stopBorrow;

  const improve = newNet - currentNet;

  document.getElementById("simCurrentNet").textContent = money(currentNet);
  document.getElementById("simNewNet").textContent = money(newNet);
  document.getElementById("simImprove").textContent = money(improve);

  const advice = document.getElementById("simulatorAdvice");

  if (newNet < 0) {
    advice.className = "plan-note alert-danger";
    advice.innerHTML = `
      หลังปรับแผนแล้ว ยังขาดอีก ${money(Math.abs(newNet))} บาท<br>
      ต้องลดรายจ่ายหรือเพิ่มรายได้เพิ่มอีกอย่างน้อย ${money(Math.abs(newNet))} บาท
    `;
  } else {
    advice.className = "plan-note alert-safe";
    advice.innerHTML = `
      แผนนี้ทำให้เดือนนี้รอด และเหลือประมาณ ${money(newNet)} บาท<br>
      แนะนำให้เก็บส่วนนี้เป็นเงินสำรองก่อน อย่าเพิ่งโปะหนี้เพิ่ม
    `;
  }
}

function fillStopBorrowAmount() {
  const totalBorrow = getBorrowThisMonthTotal();
  const input = document.getElementById("simStopBorrow");

  if (input) {
    input.value = totalBorrow;
  }

  renderSurvivalSimulator();
}








/* =========================================================
   Init
========================================================= */
setToday();
setInstallmentToday();
setExpenseToday();

loadDebts();
loadInstallmentPlans();
loadFamilyExpenses();
loadMoneyRequests();