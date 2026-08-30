const STORAGE_KEY = "my_money_flow_v1";

const state = loadState();

function defaultState() {
  return {
    balanceAdjustment: 0,
    debts: [],
    payments: [],
    incomes: [],
    rotations: [],
    expenses: []
  };
}

function loadState() {
  try {
    return { ...defaultState(), ...(JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}) };
  } catch {
    return defaultState();
  }
}
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}
function uid(prefix="id") {
  return prefix + "_" + Date.now() + "_" + Math.random().toString(36).slice(2,7);
}
function money(n) {
  const v = Number(n || 0);
  return new Intl.NumberFormat("th-TH",{style:"currency",currency:"THB",maximumFractionDigits:0}).format(v);
}
function isoDate(d = new Date()) {
  const z = new Date(d.getTime()-d.getTimezoneOffset()*60000);
  return z.toISOString().slice(0,10);
}
function parseDate(s){ return new Date(s+"T00:00:00"); }
function monthKey(s){ return s?.slice(0,7) || ""; }
function thaiDate(s){
  if(!s) return "-";
  return parseDate(s).toLocaleDateString("th-TH",{day:"numeric",month:"short",year:"2-digit"});
}
function todayKey(){ return isoDate(new Date()); }

const pageTitles = {
  dashboard:"ภาพรวม", calendar:"รายการต้องจ่าย", debts:"หนี้ทั้งหมด",
  income:"เงินเข้า", rotation:"เงินหมุน", forecast:"แผนล่วงหน้า"
};

document.querySelectorAll(".nav-item").forEach(btn=>{
  btn.addEventListener("click",()=>{
    document.querySelectorAll(".nav-item").forEach(b=>b.classList.remove("active"));
    btn.classList.add("active");
    document.querySelectorAll(".page").forEach(p=>p.classList.remove("active"));
    document.getElementById(btn.dataset.page).classList.add("active");
    document.getElementById("pageTitle").textContent = pageTitles[btn.dataset.page];
    window.scrollTo({top:0,behavior:"smooth"});
    renderAll();
  });
});

document.getElementById("todayText").textContent = new Date().toLocaleDateString("th-TH",{
  weekday:"long",day:"numeric",month:"long",year:"numeric"
});

const addModal = document.getElementById("addModal");
const dataForm = document.getElementById("dataForm");
let currentType = "debt";

function openModal(type="debt"){
  currentType = type;
  setActiveType();
  buildForm();
  addModal.classList.remove("hidden");
}
function closeModal(){ addModal.classList.add("hidden"); }
document.getElementById("openAddBtn").onclick=()=>openModal();
document.getElementById("fabAdd").onclick=()=>openModal();
document.getElementById("closeModalBtn").onclick=closeModal;
document.getElementById("cancelBtn").onclick=closeModal;
addModal.addEventListener("click",e=>{ if(e.target===addModal) closeModal(); });
document.querySelectorAll(".add-type").forEach(btn=>{
  btn.onclick=()=>{ currentType=btn.dataset.type; setActiveType(); buildForm(); };
});
function setActiveType(){
  document.querySelectorAll(".add-type").forEach(b=>b.classList.toggle("active",b.dataset.type===currentType));
}

const field = (name,label,type="text",extra="") => `
  <div class="field">
    <label for="${name}">${label}</label>
    <input id="${name}" name="${name}" type="${type}" ${extra}>
  </div>`;
const selectField = (name,label,options) => `
  <div class="field">
    <label for="${name}">${label}</label>
    <select id="${name}" name="${name}">${options.map(o=>`<option value="${o[0]}">${o[1]}</option>`).join("")}</select>
  </div>`;

function buildForm(){
  const today=todayKey();
  const y=new Date().getFullYear(), m=String(new Date().getMonth()+1).padStart(2,"0");
  const nextMonth = new Date(); nextMonth.setMonth(nextMonth.getMonth()+1);

  if(currentType==="debt"){
    dataForm.innerHTML = `
      ${field("name","ชื่อหนี้ / ชื่อบัตร","text",'required placeholder="เช่น KTC / บัตร A / สินเชื่อ"')}
      ${selectField("debtCalcType","ประเภทหนี้",[["credit_card","บัตรเครดิต"],["installment","ผ่อนคงที่"],["loan","สินเชื่อ / เงินกู้"],["statement","ยอดเรียกเก็บตามใบแจ้งหนี้"]])}
      <div id="debtTypeFields" class="field full debt-type-fields"></div>
      ${selectField("payer","ผู้จ่ายเจ้าหนี้",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}
    `;
    const debtTypeSelect = document.getElementById("debtCalcType");
    debtTypeSelect.addEventListener("change",()=>buildDebtTypeFields(debtTypeSelect.value));
    buildDebtTypeFields(debtTypeSelect.value);
  } else if(currentType==="shared"){
    dataForm.innerHTML = `
      ${field("name","ชื่อหนี้ร่วม","text",'required placeholder="เช่น หนี้ A"')}
      ${field("totalAmount","ยอดที่ต้องจ่ายรอบนี้","number",'min="0" step="0.01" required')}
      ${field("myShare","ส่วนของฉัน","number",'min="0" step="0.01" required')}
      ${field("partnerShare","ส่วนของแฟน / คนอื่น","number",'min="0" step="0.01" required')}
      ${field("transferDate","วันที่อีกฝ่ายควรโอน","date",`value="${today}" required`)}
      ${field("dueDate","วันที่ครบกำหนดเจ้าหนี้","date",`value="${today}" required`)}
      ${selectField("payer","ผู้จ่ายเจ้าหนี้",[["me","ฉัน"],["partner","แฟน"],["other","คนอื่น"]])}
      ${field("partnerName","ชื่อผู้ร่วมจ่าย","text",'value="แฟน"')}
    `;
  } else if(currentType==="income"){
    dataForm.innerHTML = `
      ${field("name","ชื่อเงินเข้า","text",'required placeholder="เช่น เงินเดือน"')}
      ${field("amount","จำนวนเงิน","number",'min="0" step="0.01" required')}
      ${field("date","วันที่เงินเข้า","date",`value="${today}" required`)}
      ${selectField("kind","ประเภท",[["income","รายได้จริง"],["pass_through","เงินผ่านมือ / เงินสำหรับจ่ายหนี้"]])}
      ${field("note","หมายเหตุ","text",'placeholder="เช่น เงินที่แฟนโอนมาสำหรับหนี้ A"')}
    `;
  } else if(currentType==="expense"){
    dataForm.innerHTML = `
      ${field("name","รายการค่าใช้จ่าย","text",'required placeholder="เช่น ค่าไฟ"')}
      ${field("amount","จำนวนเงิน","number",'min="0" step="0.01" required')}
      ${field("dueDate","วันครบกำหนด","date",`value="${today}" required`)}
      ${selectField("recurring","เกิดซ้ำ",[["no","ครั้งเดียว"],["monthly","ทุกเดือน"]])}
      ${field("months","สร้างล่วงหน้ากี่เดือน","number",'min="1" value="1"')}
    `;
  } else if(currentType==="rotation"){
    dataForm.innerHTML = `
      ${field("name","ชื่อเงินหมุน / แหล่งยืม","text",'required placeholder="เช่น ยืมเพื่อน"')}
      ${field("received","รับมา","number",'min="0" step="0.01" required')}
      ${field("receiveDate","วันที่รับเงิน","date",`value="${today}" required`)}
      ${field("repayTotal","ยอดที่ต้องคืนทั้งหมด","number",'min="0" step="0.01" required')}
      ${field("repayDate","วันเริ่มคืน","date",`value="${isoDate(nextMonth)}" required`)}
      ${field("installments","จำนวนงวดที่คืน","number",'min="1" value="1" required')}
    `;
  } else if(currentType==="balance"){
    dataForm.innerHTML = `
      <div class="field full">
        <label for="balance">ยอดเงินจริงปัจจุบัน</label>
        <input id="balance" name="balance" type="number" step="0.01" value="${getCurrentBalance()}" required>
        <small>ใส่ค่าติดลบได้ เช่น -8500</small>
      </div>
    `;
  }
}

function buildDebtTypeFields(kind){
  const box=document.getElementById("debtTypeFields");
  if(!box) return;
  const today=todayKey();
  const y=new Date().getFullYear(), m=String(new Date().getMonth()+1).padStart(2,"0");
  if(kind==="credit_card"){
    box.innerHTML=`<div class="subform-grid">
      ${field("openingBalance","ยอดหนี้คงเหลือเดิม","number",'min="0" step="0.01" required placeholder="ยอดหนี้ทั้งหมดก่อนจ่ายรอบนี้"')}
      ${field("statementAmount","ยอดเรียกเก็บรอบนี้","number",'min="0" step="0.01" required')}
      ${field("minimumPayment","ยอดขั้นต่ำ","number",'min="0" step="0.01" value="0"')}
      ${field("plannedPayment","ยอดที่ตั้งใจจ่ายรอบนี้","number",'min="0" step="0.01" required')}
      ${field("dueDate","วันครบกำหนดรอบนี้","date",`value="${today}" required`)}
      ${field("statementDate","วันตัดรอบ (ถ้าทราบ)","date",'')}
      <div class="field full"><small>บัตรเครดิตแต่ละใบคิดดอกเบี้ย/ยอดใหม่ต่างกัน แอปจะไม่เดาเอง เมื่อกดจ่ายแล้วสามารถใส่ “ยอดที่ตัดหนี้จริง” ได้</small></div>
    </div>`;
  }else if(kind==="installment"){
    box.innerHTML=`<div class="subform-grid">
      ${field("openingBalance","ยอดหนี้คงเหลือ","number",'min="0" step="0.01" required')}
      ${field("monthlyAmount","ยอดผ่อนต่องวด","number",'min="0" step="0.01" required')}
      ${field("dueDay","วันครบกำหนดทุกเดือน","number",'min="1" max="31" required')}
      ${field("months","จำนวนงวดที่เหลือ","number",'min="1" value="1" required')}
      ${field("firstMonth","เริ่มงวดเดือน","month",`value="${y}-${m}" required`)}
      ${selectField("autoSchedule","สร้างตารางผ่อน",[["yes","สร้างอัตโนมัติ"],["no","ยังไม่สร้าง"]])}
    </div>`;
  }else if(kind==="loan"){
    box.innerHTML=`<div class="subform-grid">
      ${field("openingBalance","เงินต้น / ยอดคงเหลือ","number",'min="0" step="0.01" required')}
      ${field("monthlyAmount","ยอดที่ต้องจ่ายต่องวด","number",'min="0" step="0.01" required')}
      ${field("interestRate","ดอกเบี้ยต่อปี % (ถ้าทราบ)","number",'min="0" step="0.01" value="0"')}
      ${field("dueDay","วันครบกำหนดทุกเดือน","number",'min="1" max="31" required')}
      ${field("months","จำนวนงวดที่เหลือ","number",'min="1" value="1" required')}
      ${field("firstMonth","เริ่มงวดเดือน","month",`value="${y}-${m}" required`)}
      <div class="field full"><small>ยอดชำระอาจมีทั้งเงินต้นและดอกเบี้ย เวลาติ๊กจ่ายแล้ว แอปจะถามยอดที่ตัดจากหนี้จริง</small></div>
    </div>`;
  }else{
    box.innerHTML=`<div class="subform-grid">
      ${field("openingBalance","ยอดหนี้คงเหลือเดิม","number",'min="0" step="0.01" required')}
      ${field("statementAmount","ยอดที่ต้องจ่ายรอบนี้","number",'min="0" step="0.01" required')}
      ${field("dueDate","วันครบกำหนด","date",`value="${today}" required`)}
      ${field("minimumPayment","ยอดขั้นต่ำ (ถ้ามี)","number",'min="0" step="0.01" value="0"')}
      <div class="field full"><small>เหมาะกับเจ้าหนี้ที่ยอดแต่ละเดือนไม่เท่ากัน ให้กรอกตามใบแจ้งหนี้จริง</small></div>
    </div>`;
  }
}

function debtTypeLabel(kind){
  return ({credit_card:"บัตรเครดิต",installment:"ผ่อนคงที่",loan:"สินเชื่อ / เงินกู้",statement:"ตามใบแจ้งหนี้"})[kind]||"หนี้";
}

function formData(){
  return Object.fromEntries(new FormData(dataForm).entries());
}
function makeDate(yearMonth, day){
  const [y,m]=yearMonth.split("-").map(Number);
  const last=new Date(y,m,0).getDate();
  return `${y}-${String(m).padStart(2,"0")}-${String(Math.min(Number(day),last)).padStart(2,"0")}`;
}
function addMonthsToYM(ym, add){
  const [y,m]=ym.split("-").map(Number);
  const d=new Date(y,m-1+add,1);
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
}
function addMonthsToDate(ds, add){
  const d=parseDate(ds);
  d.setMonth(d.getMonth()+add);
  return isoDate(d);
}

function saveCurrent(closeAfter=true){
  const d=formData();
  if(!dataForm.reportValidity()) return;

  if(currentType==="debt"){
    const debtId=uid("debt");
    const calcType=d.debtCalcType||"installment";
    const opening=Number(d.openingBalance||0);
    const baseDebt={
      id:debtId,name:d.name,totalDebt:opening,remaining:opening,payer:d.payer,
      type:"debt",calcType,minimumPayment:Number(d.minimumPayment||0),
      interestRate:Number(d.interestRate||0),createdAt:todayKey()
    };

    if(calcType==="credit_card"){
      const planned=Number(d.plannedPayment||d.statementAmount||0);
      Object.assign(baseDebt,{monthlyAmount:planned,statementAmount:Number(d.statementAmount||0),plannedPayment:planned,dueDate:d.dueDate,statementDate:d.statementDate||""});
      state.debts.push(baseDebt);
      state.payments.push({
        id:uid("pay"),debtId,name:d.name,amount:planned,myShare:planned,partnerShare:0,partnerReceived:0,
        dueDate:d.dueDate,paid:false,type:"debt",payer:d.payer,debtCalcType:calcType,
        statementAmount:Number(d.statementAmount||0),minimumPayment:Number(d.minimumPayment||0),debtReduction:null
      });
    }else if(calcType==="statement"){
      const amount=Number(d.statementAmount||0);
      Object.assign(baseDebt,{monthlyAmount:amount,statementAmount:amount,dueDate:d.dueDate});
      state.debts.push(baseDebt);
      state.payments.push({
        id:uid("pay"),debtId,name:d.name,amount,myShare:amount,partnerShare:0,partnerReceived:0,
        dueDate:d.dueDate,paid:false,type:"debt",payer:d.payer,debtCalcType:calcType,
        minimumPayment:Number(d.minimumPayment||0),debtReduction:null
      });
    }else{
      const monthly=Number(d.monthlyAmount||0), months=Number(d.months||1);
      Object.assign(baseDebt,{monthlyAmount:monthly,dueDay:Number(d.dueDay),months});
      state.debts.push(baseDebt);
      const auto = calcType==="installment" ? d.autoSchedule==="yes" : true;
      if(auto){
        for(let i=0;i<months;i++){
          const ym=addMonthsToYM(d.firstMonth,i);
          const amount=monthly;
          state.payments.push({
            id:uid("pay"),debtId,name:d.name,amount,myShare:amount,partnerShare:0,partnerReceived:0,
            dueDate:makeDate(ym,d.dueDay),paid:false,type:"debt",payer:d.payer,debtCalcType:calcType,
            debtReduction:calcType==="installment"?amount:null
          });
        }
      }
    }
  }
  if(currentType==="shared"){
    const debtId=uid("debt");
    const total=Number(d.totalAmount);
    state.debts.push({
      id:debtId,name:d.name,totalDebt:total,remaining:total,monthlyAmount:total,
      dueDay:parseDate(d.dueDate).getDate(),months:1,payer:d.payer,type:"shared",
      myShare:Number(d.myShare),partnerShare:Number(d.partnerShare),partnerName:d.partnerName
    });
    state.payments.push({
      id:uid("pay"),debtId,name:d.name,amount:total,myShare:Number(d.myShare),
      partnerShare:Number(d.partnerShare),partnerReceived:0,partnerName:d.partnerName,
      transferDate:d.transferDate,dueDate:d.dueDate,paid:false,type:"shared",payer:d.payer
    });
  }
  if(currentType==="income"){
    state.incomes.push({id:uid("inc"),name:d.name,amount:Number(d.amount),date:d.date,kind:d.kind,note:d.note||"",received:true});
  }
  if(currentType==="expense"){
    const count=d.recurring==="monthly"?Number(d.months||1):1;
    for(let i=0;i<count;i++){
      state.payments.push({
        id:uid("pay"),name:d.name,amount:Number(d.amount),myShare:Number(d.amount),partnerShare:0,
        partnerReceived:0,dueDate:addMonthsToDate(d.dueDate,i),paid:false,type:"expense",payer:"me"
      });
    }
  }
  if(currentType==="rotation"){
    const rotationId=uid("rot"), recv=Number(d.received), repay=Number(d.repayTotal), inst=Number(d.installments);
    state.rotations.push({id:rotationId,name:d.name,received:recv,receiveDate:d.receiveDate,repayTotal:repay,remaining:repay,repayDate:d.repayDate,installments:inst});
    state.incomes.push({id:uid("inc"),name:`เงินหมุน: ${d.name}`,amount:recv,date:d.receiveDate,kind:"rotation",note:"เงินยืม/เงินหมุน",received:true,rotationId});
    const each=repay/inst;
    for(let i=0;i<inst;i++){
      const amt=i===inst-1?repay-each*(inst-1):each;
      state.payments.push({id:uid("pay"),rotationId,name:`คืนเงินหมุน: ${d.name}`,amount:amt,myShare:amt,partnerShare:0,partnerReceived:0,dueDate:addMonthsToDate(d.repayDate,i),paid:false,type:"rotation",payer:"me"});
    }
  }
  if(currentType==="balance"){
    const target=Number(d.balance);
    const withoutAdj=getCurrentBalance()-Number(state.balanceAdjustment||0);
    state.balanceAdjustment=target-withoutAdj;
  }

  saveState(); renderAll(); toast("บันทึกข้อมูลแล้ว");
  if(closeAfter) closeModal(); else buildForm();
}
document.getElementById("saveBtn").onclick=()=>saveCurrent(true);
document.getElementById("saveAndContinueBtn").onclick=()=>saveCurrent(false);

function getCurrentBalance(){
  const income = state.incomes.filter(x=>x.received).reduce((s,x)=>s+Number(x.amount||0),0);
  const paid = state.payments.filter(x=>x.paid && x.payer==="me").reduce((s,x)=>s+Number(x.amount||0),0);
  return Number(state.balanceAdjustment||0)+income-paid;
}

function effectiveMyBurden(p){
  if(p.type==="shared"){
    if(p.payer==="me") return Number(p.myShare||0);
    return 0;
  }
  return p.payer==="me" ? Number(p.amount||0) : 0;
}
function expectedPartner(p){
  return p.type==="shared" && p.payer==="me"
    ? Math.max(0,Number(p.partnerShare||0)-Number(p.partnerReceived||0))
    : 0;
}
function renderDashboard(){
  const now=new Date(), ym=`${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,"0")}`;
  const monthPays=state.payments.filter(p=>monthKey(p.dueDate)===ym);
  const due=monthPays.reduce((s,p)=>s+Number(p.amount||0),0);
  const unpaid=monthPays.filter(p=>!p.paid).reduce((s,p)=>s+Number(p.amount||0),0);
  const expected=monthPays.filter(p=>!p.paid).reduce((s,p)=>s+expectedPartner(p),0);
  const myBurden=monthPays.reduce((s,p)=>s+effectiveMyBurden(p),0);
  const paid=monthPays.filter(p=>p.paid).reduce((s,p)=>s+Number(p.amount||0),0);
  const current=getCurrentBalance();

  const futureIncome=state.incomes.filter(x=>x.received && monthKey(x.date)===ym && x.date>todayKey()).reduce((s,x)=>s+Number(x.amount||0),0);
  const futureMyPays=monthPays.filter(p=>!p.paid && p.dueDate>=todayKey() && p.payer==="me").reduce((s,p)=>s+Number(p.amount||0),0);
  const futureExpected=monthPays.filter(p=>!p.paid && p.dueDate>=todayKey()).reduce((s,p)=>s+expectedPartner(p),0);
  const end=current+futureIncome+futureExpected-futureMyPays;

  byId("currentBalance").textContent=money(current);
  byId("monthDue").textContent=money(due);
  byId("monthUnpaid").textContent=money(unpaid);
  byId("expectedShared").textContent=money(expected);
  byId("myBurden").textContent=money(myBurden);
  byId("throughHands").textContent=money(due);
  byId("paidThisMonth").textContent=money(paid);
  byId("monthEndBalance").textContent=money(end);
  byId("monthEndBalance").className=end<0?"amount-danger":"amount-success";

  const timeline = [];
  state.incomes.filter(x=>x.received && x.date>=todayKey() && monthKey(x.date)===ym)
    .forEach(x=>timeline.push({date:x.date,delta:Number(x.amount),label:x.name,type:"in"}));
  monthPays.filter(p=>!p.paid && p.dueDate>=todayKey() && p.payer==="me")
    .forEach(p=>{
      if(expectedPartner(p)>0) timeline.push({date:p.transferDate||p.dueDate,delta:expectedPartner(p),label:`รอรับ ${p.partnerName||"ผู้ร่วมจ่าย"} - ${p.name}`,type:"in"});
      timeline.push({date:p.dueDate,delta:-Number(p.amount),label:p.name,type:"out"});
    });
  timeline.sort((a,b)=>a.date.localeCompare(b.date)||b.delta-a.delta);
  let running=current, min=running, minDate=todayKey();
  timeline.forEach(t=>{ running+=t.delta; if(running<min){min=running;minDate=t.date;} });

  const situation=byId("monthSituation");
  if(min<0){
    situation.className="situation-box danger";
    situation.innerHTML=`<strong>🔴 มีโอกาสเงินไม่พอ</strong><br>
      จุดต่ำสุดประมาณ <strong>${money(min)}</strong> ในวันที่ <strong>${thaiDate(minDate)}</strong><br>
      ควรเตรียมเงินเพิ่มอย่างน้อย <strong>${money(Math.abs(min))}</strong> เพื่อไม่ให้ยอดติดลบ`;
  }else{
    situation.className="situation-box good";
    situation.innerHTML=`<strong>🟢 จากข้อมูลที่บันทึกไว้ เดือนนี้ยังผ่านได้</strong><br>
      ยอดต่ำสุดที่คาดการณ์ประมาณ <strong>${money(min)}</strong><br>
      คาดว่าสิ้นเดือนจะเหลือประมาณ <strong>${money(end)}</strong>`;
  }

  const upcoming=state.payments.filter(p=>!p.paid).sort((a,b)=>a.dueDate.localeCompare(b.dueDate)).slice(0,6);
  byId("upcomingList").innerHTML=upcoming.length?upcoming.map(p=>`
    <div class="compact-item">
      <div><strong>${p.name}</strong><br><small>${thaiDate(p.dueDate)} ${p.type==="shared"?"• หนี้ร่วม":""}</small></div>
      <strong class="${p.dueDate<todayKey()?"amount-danger":""}">${money(p.amount)}</strong>
    </div>`).join(""):`<div class="empty">ยังไม่มีรายการที่ต้องจ่าย</div>`;
}

function renderMonthOptions(){
  const select=byId("calendarMonth");
  if(select.options.length) return;
  const base=new Date(); base.setDate(1);
  for(let i=-2;i<10;i++){
    const d=new Date(base); d.setMonth(base.getMonth()+i);
    const key=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const op=document.createElement("option");
    op.value=key; op.textContent=d.toLocaleDateString("th-TH",{month:"long",year:"numeric"});
    if(i===0) op.selected=true;
    select.appendChild(op);
  }
}
byId("calendarMonth").addEventListener("change",renderPayments);
byId("calendarStatus").addEventListener("change",renderPayments);

function renderPayments(){
  renderMonthOptions();
  const ym=byId("calendarMonth").value, status=byId("calendarStatus").value;
  let list=state.payments.filter(p=>monthKey(p.dueDate)===ym);
  if(status==="paid") list=list.filter(p=>p.paid);
  if(status==="unpaid") list=list.filter(p=>!p.paid);
  list.sort((a,b)=>a.dueDate.localeCompare(b.dueDate));

  byId("paymentList").innerHTML=list.length?list.map(p=>`
    <div class="payment-row ${p.paid?"paid":""} ${p.dueDate<todayKey()&&!p.paid?"overdue":""}">
      <button class="check-btn ${p.paid?"done":""}" onclick="togglePaid('${p.id}')">${p.paid?"✓":""}</button>
      <div>
        <strong>${p.name}</strong><br>
        <small>${thaiDate(p.dueDate)} ${p.type==="shared"?`• ${p.partnerName||"ผู้ร่วมจ่าย"} ${money(p.partnerShare)}`:""}</small>
      </div>
      <div class="hide-mobile"><span class="tag ${p.type==="shared"?"shared":""}">${labelType(p.type)}</span></div>
      <div class="hide-mobile">${p.paid?"จ่ายแล้ว":"ยังไม่จ่าย"}</div>
      <div style="text-align:right">
        <strong>${money(p.amount)}</strong><br>
        ${p.type==="shared"&&!p.paid?`<button class="action-link" onclick="receiveShared('${p.id}')">รับเงินร่วม</button>`:""}
      </div>
    </div>`).join(""):`<div class="empty">ไม่มีรายการในเดือนนี้</div>`;
}
function labelType(t){ return ({debt:"หนี้",shared:"หนี้ร่วม",expense:"ค่าใช้จ่าย",rotation:"เงินหมุน"})[t]||t; }

window.togglePaid=function(id){
  const p=state.payments.find(x=>x.id===id); if(!p)return;
  const willPay=!p.paid;
  let reduction=Number(p.debtReduction ?? p.amount ?? 0);

  if(willPay && p.debtId){
    const d=state.debts.find(x=>x.id===p.debtId);
    if(d && ["credit_card","loan","statement"].includes(d.calcType)){
      const answer=prompt(`จ่าย ${p.name} ${money(p.amount)} แล้ว\n\nยอดที่ตัดจากหนี้จริงเท่าไร?\n(ดูจากใบแจ้งหนี้/แอปเจ้าหนี้ หากยังไม่แน่ใจใส่ยอดที่จ่ายก่อนได้)`, String(reduction));
      if(answer===null) return;
      const n=Number(answer);
      if(!Number.isFinite(n) || n<0){ alert("กรุณาใส่ยอดตัดหนี้เป็นตัวเลข 0 ขึ้นไป"); return; }
      reduction=n;
      p.debtReduction=n;
    }
  }

  p.paid=willPay;
  if(p.debtId){
    const d=state.debts.find(x=>x.id===p.debtId);
    if(d){
      d.remaining=Math.max(0,Number(d.remaining)+(p.paid?-reduction:reduction));
    }
  }
  if(p.rotationId){
    const r=state.rotations.find(x=>x.id===p.rotationId);
    if(r) r.remaining=Math.max(0,Number(r.remaining)+(p.paid?-Number(p.amount):Number(p.amount)));
  }
  saveState();renderAll();toast(p.paid?"บันทึกว่าจ่ายแล้ว":"ยกเลิกสถานะจ่ายแล้ว");
}
window.receiveShared=function(id){
  const p=state.payments.find(x=>x.id===id); if(!p)return;
  const remaining=Math.max(0,Number(p.partnerShare||0)-Number(p.partnerReceived||0));
  if(!remaining){toast("ได้รับเงินส่วนนี้ครบแล้ว");return;}
  p.partnerReceived=Number(p.partnerShare||0);
  state.incomes.push({
    id:uid("inc"),name:`รับจาก ${p.partnerName||"ผู้ร่วมจ่าย"} - ${p.name}`,
    amount:remaining,date:todayKey(),kind:"pass_through",note:`สำหรับจ่าย ${p.name}`,received:true,paymentId:p.id
  });
  saveState();renderAll();toast(`รับเงินร่วม ${money(remaining)} แล้ว`);
}

function renderDebts(){
  byId("debtCards").innerHTML=state.debts.length?state.debts.map(d=>{
    const paid=Math.max(0,Number(d.totalDebt)-Number(d.remaining));
    const pct=d.totalDebt?Math.min(100,(paid/d.totalDebt)*100):0;
    const kind=d.type==="shared"?"หนี้ร่วม":debtTypeLabel(d.calcType);
    const dueText=d.dueDate?thaiDate(d.dueDate):(d.dueDay?`ทุกวันที่ ${d.dueDay}`:"-");
    const cycleAmount=Number(d.plannedPayment||d.statementAmount||d.monthlyAmount||0);
    return `<div class="debt-card">
      <div class="debt-top"><div><h4>${d.name}</h4><p>${kind}</p></div><span class="tag ${d.type==="shared"?"shared":""}">${kind}</span></div>
      <div class="big">${money(d.remaining)}</div>
      <div class="progress"><span style="width:${pct}%"></span></div>
      <div class="debt-meta">
        <div><small>ยอดหนี้ตั้งต้น</small><strong>${money(d.totalDebt)}</strong></div>
        <div><small>ยอดรอบนี้ / ต่องวด</small><strong>${money(cycleAmount)}</strong></div>
        <div><small>ขั้นต่ำ</small><strong>${d.minimumPayment?money(d.minimumPayment):"-"}</strong></div>
        <div><small>ครบกำหนด</small><strong>${dueText}</strong></div>
      </div>
      <div class="debt-card-actions">
        <button class="action-link" onclick="adjustDebtBalance('${d.id}')">ปรับยอดคงเหลือ</button>
        ${d.calcType==="credit_card"||d.calcType==="statement"?`<button class="action-link" onclick="addDebtCycle('${d.id}')">เพิ่มยอดรอบใหม่</button>`:""}
      </div>
    </div>`;
  }).join(""):`<div class="empty">ยังไม่มีข้อมูลหนี้</div>`;
}
window.adjustDebtBalance=function(id){
  const d=state.debts.find(x=>x.id===id); if(!d)return;
  const answer=prompt(`ปรับยอดหนี้คงเหลือของ ${d.name}`,String(d.remaining||0));
  if(answer===null)return;
  const n=Number(answer); if(!Number.isFinite(n)||n<0){alert("กรุณาใส่ยอด 0 ขึ้นไป");return;}
  d.remaining=n;
  if(n>Number(d.totalDebt||0)) d.totalDebt=n;
  saveState();renderAll();toast("ปรับยอดหนี้แล้ว");
}
window.addDebtCycle=function(id){
  const d=state.debts.find(x=>x.id===id); if(!d)return;
  const due=prompt(`วันครบกำหนดรอบใหม่ของ ${d.name} (YYYY-MM-DD)`, d.dueDate||todayKey());
  if(!due)return;
  const billed=prompt("ยอดเรียกเก็บตามใบแจ้งหนี้รอบนี้",String(d.statementAmount||d.monthlyAmount||0));
  if(billed===null)return;
  const bill=Number(billed); if(!Number.isFinite(bill)||bill<0){alert("ยอดไม่ถูกต้อง");return;}
  let pay=bill;
  if(d.calcType==="credit_card"){
    const planned=prompt("ยอดที่ตั้งใจจ่ายรอบนี้",String(d.plannedPayment||bill));
    if(planned===null)return;
    pay=Number(planned); if(!Number.isFinite(pay)||pay<0){alert("ยอดไม่ถูกต้อง");return;}
  }
  state.payments.push({id:uid("pay"),debtId:d.id,name:d.name,amount:pay,myShare:pay,partnerShare:0,partnerReceived:0,dueDate:due,paid:false,type:"debt",payer:d.payer,debtCalcType:d.calcType,statementAmount:bill,minimumPayment:Number(d.minimumPayment||0),debtReduction:null});
  d.statementAmount=bill; d.plannedPayment=pay; d.monthlyAmount=pay; d.dueDate=due;
  saveState();renderAll();toast("เพิ่มยอดรอบใหม่แล้ว");
}
function payerLabel(p){return p==="me"?"ฉัน":p==="partner"?"แฟน":"คนอื่น";}

function renderIncome(){
  const list=[...state.incomes].sort((a,b)=>b.date.localeCompare(a.date));
  byId("incomeList").innerHTML=list.length?`<table>
    <thead><tr><th>วันที่</th><th>รายการ</th><th>ประเภท</th><th>จำนวน</th><th>หมายเหตุ</th></tr></thead>
    <tbody>${list.map(x=>`<tr><td>${thaiDate(x.date)}</td><td>${x.name}</td><td>${x.kind==="income"?"รายได้จริง":x.kind==="rotation"?"เงินหมุน":"เงินผ่านมือ"}</td><td class="amount-success">${money(x.amount)}</td><td>${x.note||"-"}</td></tr>`).join("")}</tbody>
  </table>`:`<div class="empty">ยังไม่มีข้อมูลเงินเข้า</div>`;
}

function renderRotations(){
  byId("rotationList").innerHTML=state.rotations.length?state.rotations.map(r=>`
    <div class="debt-card">
      <h4>${r.name}</h4><p>รับ ${thaiDate(r.receiveDate)}</p>
      <div class="big">${money(r.remaining)}</div>
      <div class="debt-meta">
        <div><small>รับมา</small><strong>${money(r.received)}</strong></div>
        <div><small>ต้องคืน</small><strong>${money(r.repayTotal)}</strong></div>
        <div><small>เริ่มคืน</small><strong>${thaiDate(r.repayDate)}</strong></div>
        <div><small>จำนวนงวด</small><strong>${r.installments}</strong></div>
      </div>
    </div>`).join(""):`<div class="empty">ยังไม่มีเงินหมุน / เงินยืม</div>`;
}

function renderForecast(){
  const rows=[]; const base=new Date(); base.setDate(1);
  let carry=getCurrentBalance();
  for(let i=0;i<6;i++){
    const d=new Date(base); d.setMonth(base.getMonth()+i);
    const ym=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}`;
    const inc=state.incomes.filter(x=>monthKey(x.date)===ym).reduce((s,x)=>s+Number(x.amount||0),0);
    const pays=state.payments.filter(p=>monthKey(p.dueDate)===ym && p.payer==="me").reduce((s,p)=>s+Number(p.amount||0),0);
    const shared=state.payments.filter(p=>monthKey(p.dueDate)===ym).reduce((s,p)=>s+expectedPartner(p),0);
    const projected=carry+inc+shared-pays;
    rows.push({label:d.toLocaleDateString("th-TH",{month:"long",year:"numeric"}),inc:inc+shared,pays,projected});
    carry=projected;
  }
  byId("forecastTable").innerHTML=`<table>
    <thead><tr><th>เดือน</th><th>เงินเข้า/รอรับ</th><th>ต้องจ่าย</th><th>คาดการณ์คงเหลือ</th></tr></thead>
    <tbody>${rows.map(r=>`<tr><td>${r.label}</td><td>${money(r.inc)}</td><td>${money(r.pays)}</td><td class="${r.projected<0?"amount-danger":"amount-success"}"><strong>${money(r.projected)}</strong></td></tr>`).join("")}</tbody>
  </table>`;
}

function renderAll(){
  renderDashboard();renderPayments();renderDebts();renderIncome();renderRotations();renderForecast();
}
function byId(id){return document.getElementById(id)}
function toast(msg){
  const t=byId("toast");t.textContent=msg;t.classList.add("show");
  setTimeout(()=>t.classList.remove("show"),2200);
}

byId("exportBtn").onclick=()=>{
  const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});
  const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`money-flow-backup-${todayKey()}.json`;a.click();
  URL.revokeObjectURL(a.href);
};
byId("importInput").addEventListener("change",async e=>{
  const f=e.target.files[0];if(!f)return;
  try{
    const data=JSON.parse(await f.text());
    Object.assign(state,defaultState(),data);saveState();renderAll();toast("นำเข้าข้อมูลแล้ว");
  }catch{alert("ไฟล์ข้อมูลไม่ถูกต้อง");}
  e.target.value="";
});
byId("resetBtn").onclick=()=>{
  if(!confirm("ต้องการล้างข้อมูลทั้งหมดจริงหรือไม่?"))return;
  Object.keys(state).forEach(k=>delete state[k]);Object.assign(state,defaultState());saveState();renderAll();toast("ล้างข้อมูลแล้ว");
};

renderMonthOptions();
buildForm();
renderAll();
