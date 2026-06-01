/* =========================================================
   Supabase Config
   เปลี่ยน 2 บรรทัดนี้เป็นของโปรเจกต์คุณ
========================================================= */
const SUPABASE_URL = "https://teqpvdsxihbgknicupvj.supabase.co";
const SUPABASE_ANON_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InRlcXB2ZHN4aWhiZ2tuaWN1cHZqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODAzMDg4MDUsImV4cCI6MjA5NTg4NDgwNX0.cMCBlzvRpHn9crzHcPavFVCsrvgaweBbXvjxF7ezhI8";

const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

let debts = [];

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
  renderDebtOptions();
  renderSummary();
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

/* =========================================================
   Init
========================================================= */
setToday();
loadDebts();