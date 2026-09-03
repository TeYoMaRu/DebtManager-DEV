const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

// 1. Add deleteIncome and deleteRotation functions
const functionsToAdd = `
window.deleteIncome=function(id){
  const inc=state.incomes.find(x=>x.id===id); if(!inc)return;
  if(!confirm(\`ลบรายรับ "\${inc.name}" ใช่ไหม?\`))return;
  state.incomes=state.incomes.filter(x=>x.id!==id);
  saveState();renderAll();toast("ลบรายรับแล้ว");
};

window.deleteRotation=function(id){
  const r=state.rotations.find(x=>x.id===id); if(!r)return;
  if(!confirm(\`ลบรายการเงินหมุน "\${r.name}" และรายการที่เกี่ยวข้องทั้งหมดใช่ไหม?\`))return;
  state.rotations=state.rotations.filter(x=>x.id!==id);
  state.incomes=state.incomes.filter(x=>x.rotationId!==id);
  state.payments=state.payments.filter(x=>x.rotationId!==id);
  saveState();renderAll();toast("ลบเงินหมุนแล้ว");
};
`;

code = code.replace(/window\.deletePayment=function\(id\)\{([\s\S]*?)toast\("ลบรายการจ่ายแล้ว"\);\n\};/, match => match + '\n' + functionsToAdd);

// 2. Modify renderIncome
const oldRenderIncome = `  byId("incomeList").innerHTML=list.length?\`<table><thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวน</th><th>หมายเหตุ</th></tr></thead><tbody>\${list.map(x=>\`<tr><td>\${thaiDate(x.date)}</td><td>\${x.name}</td><td>\${x.kind==="income"?"รายได้จริง":x.kind==="rotation"?"เงินหมุน":"เงินผ่านมือ"}</td><td class="amount-success">\${money(x.amount)}</td><td>\${x.note||"-"}</td></tr>\`).join("")}</tbody></table>\`:\`<div class="empty">ยังไม่มีข้อมูลเงินเข้า</div>\`;`;
const newRenderIncome = `  byId("incomeList").innerHTML=list.length?\`<div style="overflow-x:auto;"><table><thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวน</th><th>หมายเหตุ</th><th>จัดการ</th></tr></thead><tbody>\${list.map(x=>\`<tr><td style="white-space:nowrap;">\${thaiDate(x.date)}</td><td style="min-width:120px;">\${x.name}</td><td style="white-space:nowrap;">\${x.kind==="income"?"รายได้จริง":x.kind==="rotation"?"เงินหมุน":"เงินผ่านมือ"}</td><td class="amount-success" style="white-space:nowrap;">\${money(x.amount)}</td><td>\${x.note||"-"}</td><td style="white-space:nowrap;"><button class="mini-delete-btn" onclick="deleteIncome('\${x.id}')"><i class="ph ph-trash"></i></button></td></tr>\`).join("")}</tbody></table></div>\`:\`<div class="empty">ยังไม่มีข้อมูลเงินเข้า</div>\`;`;

code = code.replace(oldRenderIncome, newRenderIncome);

// 3. Modify renderRotations
const oldRenderRotations = `  byId("rotationList").innerHTML=state.rotations.length?state.rotations.map(r=>\`<div class="debt-card"><h4>\${r.name}</h4><p>รับ \${thaiDate(r.receiveDate)}</p><div class="big">\${money(r.remaining)}</div><div class="debt-meta"><div><small>รับมา</small><strong>\${money(r.received)}</strong></div><div><small>ต้องคืน</small><strong>\${money(r.repayTotal)}</strong></div><div><small>เริ่มคืน</small><strong>\${thaiDate(r.repayDate)}</strong></div><div><small>จำนวนงวด</small><strong>\${r.installments}</strong></div></div></div>\`).join(""):\`<div class="empty">ยังไม่มีเงินหมุน / เงินยืม</div>\`;`;
const newRenderRotations = `  byId("rotationList").innerHTML=state.rotations.length?state.rotations.map(r=>\`<div class="debt-card"><h4>\${r.name}</h4><p>รับ \${thaiDate(r.receiveDate)}</p><div class="big">\${money(r.remaining)}</div><div class="debt-meta"><div><small>รับมา</small><strong>\${money(r.received)}</strong></div><div><small>ต้องคืน</small><strong>\${money(r.repayTotal)}</strong></div><div><small>เริ่มคืน</small><strong>\${thaiDate(r.repayDate)}</strong></div><div><small>จำนวนงวด</small><strong>\${r.installments}</strong></div></div><div class="card-actions" style="margin-top:12px;border-top:1px solid var(--line-light);padding-top:12px;"><button class="delete-btn" onclick="deleteRotation('\${r.id}')"><i class="ph ph-trash"></i> ลบรายการนี้</button></div></div>\`).join(""):\`<div class="empty">ยังไม่มีเงินหมุน / เงินยืม</div>\`;`;

code = code.replace(oldRenderRotations, newRenderRotations);

fs.writeFileSync('app.js', code);
console.log("Patched missing functions");
