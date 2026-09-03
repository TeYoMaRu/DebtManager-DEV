const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Update smartDebtFields for seasycash
const oldSeasycashFields = `
  if(type==="seasycash"){
    return \`
      \${field("name","ชื่อสินเชื่อ","text",'required value="SEasyCash"')}
      \${field("borrowedAmount","เงินต้นที่กู้รอบนี้","number",'min="0" step="0.01" required')}
      \${field("totalInterest","ดอกเบี้ยที่ต้องจ่ายรวม","number",'min="0" step="0.01" value="0" required')}
      \${field("totalFee","ค่าธรรมเนียม / ค่าใช้จ่ายอื่น","number",'min="0" step="0.01" value="0"')}
      \${field("receiveDate","วันที่รับเงิน","date",\`value="\${today}" required\`)}
      \${field("installments","จำนวนงวด","number",'min="1" value="2" required')}
      \${field("firstDueDate","วันครบกำหนดงวดแรก","date",\`value="\${today}" required\`)}
      \${selectField("receivedNow","เงินก้อนนี้เข้ามาใช้แล้วหรือยัง",[["yes","รับแล้ว — เพิ่มเข้าเงินเข้า/เงินหมุน"],["no","ยังไม่ได้รับ"]])}
      \${selectField("payer","ผู้จ่ายเจ้าหนี้",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}
      <div class="field full">
        <label>ยอดชำระแต่ละงวด</label>
        <div id="smartLoanInstallments" class="smart-installment-editor"></div>
        <small>แก้ยอดแต่ละงวดได้เอง เพราะยอดจริงแต่ละเดือนไม่จำเป็นต้องเท่ากัน</small>
      </div>\`;
  }
`.trim();

const newSeasycashFields = `
  if(type==="seasycash"){
    return \`
      \${field("name","ชื่อสินเชื่อ","text",'required value="SEasyCash"')}
      \${field("borrowedAmount","ยอดเงินที่กด / ได้รับจริง","number",'min="0" step="0.01" required placeholder="เช่น 10000"')}
      \${field("receiveDate","วันที่รับเงิน","date",\`value="\${today}" required\`)}
      \${field("installments","เลือกผ่อนกี่เดือน","number",'min="1" value="2" required')}
      \${field("firstDueDate","วันครบกำหนดงวดแรก","date",\`value="\${today}" required\`)}
      \${selectField("receivedNow","เงินก้อนนี้เข้ามาใช้แล้วหรือยัง",[["yes","รับแล้ว — เพิ่มเข้าเงินเข้า/เงินหมุน"],["no","ยังไม่ได้รับ"]])}
      \${selectField("payer","ผู้จ่ายเจ้าหนี้",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}
      <div class="field full debt-form-note">
        กรอกยอดแต่ละงวดตามตารางที่สินเชื่อแจ้งได้เลย ระบบจะรวมยอดชำระและคำนวณดอกเบี้ยให้เอง งวดสุดท้ายไม่จำเป็นต้องเท่างวดอื่น
      </div>
      <div class="field full">
        <label>ตารางผ่อนชำระแต่ละงวด</label>
        <div id="smartLoanInstallments" class="smart-installment-editor"></div>
      </div>
      <div class="loan-auto-summary field full" style="background:var(--bg-color);padding:10px;border-radius:8px;font-size:0.9rem;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>เงินที่ได้รับ</span><strong id="loanBorrowedSummary">฿0</strong></div>
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;"><span>ยอดชำระรวม</span><strong id="loanRepaymentSummary">฿0</strong></div>
        <div style="display:flex;justify-content:space-between;color:var(--danger);"><span>ดอกเบี้ย/ต้นทุนรวมโดยประมาณ</span><strong id="loanCostSummary">฿0</strong></div>
      </div>\`;
  }
`.trim();

if(code.includes('if(type==="seasycash"){')) {
  // Use regex to replace the entire block of if(type==="seasycash") { ... } inside smartDebtFields
  code = code.replace(/if\(type==="seasycash"\)\{\s*return\s*`[\s\S]*?`;\s*\}/, newSeasycashFields);
} else {
  console.log("Could not find seasycash fields block");
}

// 2. Add updateSmartLoanSummary
const summaryFunction = `
window.updateSmartLoanSummary = function(){
  const borrowed=num(byId("borrowedAmount")?.value);
  const total=[...document.querySelectorAll('#smartLoanInstallments [data-smart="amount"]')].reduce((s,x)=>s+num(x.value),0);
  const cost=Math.max(0,total-borrowed);
  if(byId("loanBorrowedSummary"))byId("loanBorrowedSummary").textContent=money(borrowed);
  if(byId("loanRepaymentSummary"))byId("loanRepaymentSummary").textContent=money(total);
  if(byId("loanCostSummary"))byId("loanCostSummary").textContent=money(cost);
};
`;
if(!code.includes('updateSmartLoanSummary')) {
  code = code.replace(/function renderSmartLoanInstallments/, summaryFunction + '\nfunction renderSmartLoanInstallments');
}

// 3. Update renderSmartLoanInstallments
const oldRenderInstallments = /function renderSmartLoanInstallments\(preserve=true\)\{[\s\S]*?\}\.join\(""\);\s*\}/;
const newRenderInstallments = `
function renderSmartLoanInstallments(preserve=true){
  const box=byId("smartLoanInstallments");
  if(!box)return;
  const count=Math.max(1,parseInt(byId("installments")?.value||"1",10));
  const first=byId("firstDueDate")?.value||todayKey();
  const old=[];
  if(preserve){
    box.querySelectorAll(".smart-installment-row").forEach(row=>{
      old.push({
        amount:row.querySelector('[data-smart="amount"]')?.value||"",
        due:row.querySelector('[data-smart="due"]')?.value||""
      });
    });
  }
  box.innerHTML=Array.from({length:count},(_,i)=>{
    const amount=old[i]?.amount || "";
    const due=old[i]?.due || makeMonthlyDate(first,i);
    return \`<div class="smart-installment-row">
      <strong>งวด \${i+1}/\${count}</strong>
      <label>ยอดชำระ<input data-smart="amount" type="number" min="0" step="0.01" value="\${amount}" required></label>
      <label>วันครบกำหนด<input data-smart="due" type="date" value="\${due}" required></label>
    </div>\`;
  }).join("");
  box.querySelectorAll('[data-smart="amount"]').forEach(el=>el.addEventListener('input', window.updateSmartLoanSummary));
  if(typeof window.updateSmartLoanSummary === 'function') window.updateSmartLoanSummary();
}
`.trim();
code = code.replace(oldRenderInstallments, newRenderInstallments);

// 4. Update renderSmartDebtForm
const oldRenderForm = /function renderSmartDebtForm\(type\)\{[\s\S]*?\}\s*\}/;
const newRenderForm = `
function renderSmartDebtForm(type){
  const dynamic=byId("smartDebtDynamic");
  if(!dynamic)return;
  dynamic.innerHTML=smartDebtFields(type,todayKey());
  if(type==="seasycash"){
    renderSmartLoanInstallments(false);
    ["installments","firstDueDate"].forEach(id=>byId(id)?.addEventListener("change",()=>renderSmartLoanInstallments(true)));
    byId("borrowedAmount")?.addEventListener("input", window.updateSmartLoanSummary);
    if(typeof window.updateSmartLoanSummary === 'function') window.updateSmartLoanSummary();
  }
}
`.trim();
code = code.replace(oldRenderForm, newRenderForm);

// 5. Update saveCurrent seasycash block
const saveRegex = /if\(t==="seasycash"\)\{\s*const borrowed=num\(d\.borrowedAmount\);[\s\S]*?syncLoanRoundPayments\(debt\);\s*\}/;
const newSave = `
    if(t==="seasycash"){
      const borrowed=num(d.borrowedAmount);
      const rows=[...document.querySelectorAll("#smartLoanInstallments .smart-installment-row")];
      const round={
        id:uid("round"),startDate:d.receiveDate,borrowedAmount:borrowed,totalFee:0,
        installmentCount:rows.length,moneyReceived:d.receivedNow==="yes",incomeId:null,
        installments:rows.map((row,i)=>({
          id:uid("inst"),no:i+1,
          amount:num(row.querySelector('[data-smart="amount"]').value),
          dueDate:row.querySelector('[data-smart="due"]').value,paid:false
        }))
      };
      round.totalRepayment=round.installments.reduce((s,x)=>s+num(x.amount),0);
      round.totalInterest=Math.max(0,round.totalRepayment-borrowed);
      const debt={
        id:debtId,name:d.name,type:"debt",debtKind:"loan",loanRoundMode:true,
        totalDebt:round.totalRepayment,remaining:round.totalRepayment,
        monthlyAmount:round.installments[0]?.amount||0,currentBill:round.installments[0]?.amount||0,
        payer:d.payer,createdAt:todayKey(),loanRounds:[round]
      };
      state.debts.push(debt);
      if(d.receivedNow==="yes"){
        const incomeId=uid("inc");
        state.incomes.push({
          id:incomeId,name:\`\${d.name} • รอบกู้ \${thaiDate(d.receiveDate)}\`,amount:borrowed,
          date:d.receiveDate,kind:"rotation",
          note:\`เงินกู้/เงินหมุน • ยอดชำระรวม \${money(round.totalRepayment)} • ต้นทุนรวมประมาณ \${money(round.totalInterest)}\`,
          debtId,loanRoundId:round.id,received:true
        });
        round.incomeId=incomeId;
      }
      syncLoanRoundPayments(debt);
    }
`.trim();
code = code.replace(saveRegex, newSave);

fs.writeFileSync('app.js', code);
console.log("Patched seasycash");
