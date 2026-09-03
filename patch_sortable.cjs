const fs = require('fs');
let code = fs.readFileSync('app.js', 'utf8');

const oldLines = `  const upcoming=state.payments.filter(p=>!p.paid && p.dueDate<=nextMonth30th).sort((a,b)=>a.dueDate.localeCompare(b.dueDate));
  const todayDateObj = parseDate(todayKey());
  byId("upcomingList").innerHTML=upcoming.length?upcoming.map(p=>{
    const diffDays = Math.ceil((parseDate(p.dueDate) - todayDateObj) / (1000 * 60 * 60 * 24));
    let badge = diffDays <= 0 ? \`<span class="badge-pulse" style="display:inline-block; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; background:var(--danger-soft); color:var(--danger);">ด่วนมาก</span>\` : diffDays <= 7 ? \`<span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; background:#fffbeb; color:#d97706;">ปานกลาง</span>\` : \`<span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; background:var(--success-soft); color:var(--success);">ทั่วไป</span>\`;
    return \`<div class="compact-item"><div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;">\${p.dueDate<=todayKey()?'<i class="ph-fill ph-warning-circle" style="color:var(--danger)" title="ด่วน"></i>':'<i class="ph-fill ph-clock" style="color:var(--primary)" title="รอจ่าย"></i>'}<strong style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px;">\${p.name}</strong> <small style="padding:2px 6px; border-radius:4px; font-weight:600; \${p.dueDate<=todayKey()?"color:var(--danger);background:var(--danger-soft)":"color:var(--primary);background:var(--primary-soft)"}">\${thaiDate(p.dueDate)} \${p.type==="shared"?"• หนี้ร่วม":""}</small>\${badge}</div><div style="display:flex;align-items:center;gap:8px;"><strong class="\${p.dueDate<todayKey()?"amount-danger":""}" style="white-space:nowrap;">\${money(p.amount)}</strong><button class="icon-btn" style="width:24px;height:24px;min-height:24px;color:var(--text-light);border-radius:4px;" onclick="window.snoozePayment('\${p.id}')" title="เลื่อนไปพรุ่งนี้"><i class="ph ph-clock-clockwise"></i></button></div></div>\`;
  }).join(""):\`<div class="empty">ยังไม่มีรายการที่ต้องจ่าย</div>\`;`;

const newLines = `  const upcoming=state.payments.filter(p=>!p.paid && p.dueDate<=nextMonth30th).sort((a,b)=>(a.order||0)-(b.order||0) || a.dueDate.localeCompare(b.dueDate));
  const todayDateObj = parseDate(todayKey());
  byId("upcomingList").innerHTML=upcoming.length?upcoming.map(p=>{
    const diffDays = Math.ceil((parseDate(p.dueDate) - todayDateObj) / (1000 * 60 * 60 * 24));
    let badge = diffDays <= 0 ? \`<span class="badge-pulse" style="display:inline-block; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; background:var(--danger-soft); color:var(--danger);">ด่วนมาก</span>\` : diffDays <= 7 ? \`<span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; background:#fffbeb; color:#d97706;">ปานกลาง</span>\` : \`<span style="font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:bold; background:var(--success-soft); color:var(--success);">ทั่วไป</span>\`;
    return \`<div class="compact-item" data-id="\${p.id}"><div style="display:flex; gap:6px; align-items:center; flex-wrap:wrap;"><i class="ph ph-dots-six-vertical drag-handle" style="cursor:grab;color:var(--text-light);font-size:1.1rem;margin-right:2px;" title="ลากเพื่อจัดลำดับ"></i>\${p.dueDate<=todayKey()?'<i class="ph-fill ph-warning-circle" style="color:var(--danger)" title="ด่วน"></i>':'<i class="ph-fill ph-clock" style="color:var(--primary)" title="รอจ่าย"></i>'}<strong style="background:#dcfce7; color:#166534; padding:2px 6px; border-radius:4px;">\${p.name}</strong> <small style="padding:2px 6px; border-radius:4px; font-weight:600; \${p.dueDate<=todayKey()?"color:var(--danger);background:var(--danger-soft)":"color:var(--primary);background:var(--primary-soft)"}">\${thaiDate(p.dueDate)} \${p.type==="shared"?"• หนี้ร่วม":""}</small>\${badge}</div><div style="display:flex;align-items:center;gap:8px;"><strong class="\${p.dueDate<todayKey()?"amount-danger":""}" style="white-space:nowrap;">\${money(p.amount)}</strong><button class="icon-btn" style="width:24px;height:24px;min-height:24px;color:var(--text-light);border-radius:4px;" onclick="window.snoozePayment('\${p.id}')" title="เลื่อนไปพรุ่งนี้"><i class="ph ph-clock-clockwise"></i></button></div></div>\`;
  }).join(""):\`<div class="empty">ยังไม่มีรายการที่ต้องจ่าย</div>\`;
  
  if (window.Sortable) {
    if (window.upcomingSortable) window.upcomingSortable.destroy();
    window.upcomingSortable = window.Sortable.create(byId("upcomingList"), {
      handle: '.drag-handle',
      animation: 150,
      onEnd: function (evt) {
        const itemEls = Array.from(byId("upcomingList").querySelectorAll('.compact-item'));
        itemEls.forEach((el, index) => {
          const pid = el.getAttribute('data-id');
          const payment = state.payments.find(x => x.id === pid);
          if (payment) payment.order = index;
        });
        saveState();
        toast("บันทึกการจัดเรียงแล้ว");
      }
    });
  }`;

if(code.includes(oldLines)) {
  code = code.replace(oldLines, newLines);
  fs.writeFileSync('app.js', code);
  console.log("Patched successfully");
} else {
  console.log("Old lines not found");
}
