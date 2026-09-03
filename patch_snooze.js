const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const target1 = `window.togglePaid=function(id){`;
const replacement1 = `window.snoozePayment=function(id){
  const p=state.payments.find(x=>x.id===id);
  if(!p)return;
  const d=parseDate(p.dueDate);
  d.setDate(d.getDate()+1);
  p.dueDate=isoDate(d);
  saveState();
  if(byId("dashboard").classList.contains("active")) renderDashboard();
  if(byId("calendar").classList.contains("active")) {
    if(typeof renderCalendarList !== 'undefined') renderCalendarList();
  }
};
` + target1;
code = code.replace(target1, replacement1);

// the renderDashboard template change
const oldHTML = '</div><strong class="${p.dueDate<todayKey()?"amount-danger":""}" style="white-space:nowrap;">${money(p.amount)}</strong></div>`;';

const newHTML = '</div><div style="display:flex;align-items:center;gap:8px;"><strong class="${p.dueDate<todayKey()?"amount-danger":""}" style="white-space:nowrap;">${money(p.amount)}</strong><button class="icon-btn" style="width:24px;height:24px;min-height:24px;color:var(--text-light);" onclick="window.snoozePayment(\'${p.id}\')" title="เลื่อนไป 1 วัน"><i class="ph ph-clock-clockwise"></i></button></div></div>`;';

code = code.replace(oldHTML, newHTML);

fs.writeFileSync('app.js', code);
console.log("Patched");
