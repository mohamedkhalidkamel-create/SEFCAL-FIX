/* ================= الإعدادات ================= */
// لو عندك سيرفر (Cloudflare Worker مثلا) لمنع تكرار اللفة بالـ IP حط رابطه هنا.
// سيبه فاضي = الحماية بالمتصفح فقط (localStorage).
const API_URL = "";

// احتمالات متساوية = عشوائية عادلة. تقدر تغيّر الأوزان لو حبيت.
const PRIZES = [
  { label: "خصم 50%",       color: "#e5484d", weight: 1, final: true },
  { label: "خصم 40%",       color: "#ffb400", weight: 1, final: true },
  { label: "خصم 30%",       color: "#00a6a6", weight: 1, final: true },
  { label: "زيارة مجانية",  color: "#5b5fc7", weight: 1, final: true },
  { label: "حاول تاني",     color: "#6b7a8c", weight: 1, final: false }
];
const KEY = "sefcal_wheel_result_v1";
const WAIT_SECONDS = 6;

/* ================= عناصر الصفحة ================= */
const $ = id => document.getElementById(id);
const canvas = $("wheel"), ctx = canvas.getContext("2d");
const N = PRIZES.length, ARC = 360 / N;
let rotation = 0, spinning = false;

/* ================= رسم العجلة ================= */
function drawWheel() {
  const c = canvas.width / 2;
  PRIZES.forEach((p, i) => {
    const a0 = (i * ARC - 90) * Math.PI / 180, a1 = ((i + 1) * ARC - 90) * Math.PI / 180;
    ctx.beginPath(); ctx.moveTo(c, c); ctx.arc(c, c, c, a0, a1); ctx.closePath();
    ctx.fillStyle = p.color; ctx.fill();
    ctx.strokeStyle = "#fff"; ctx.lineWidth = 4; ctx.stroke();
    ctx.save();
    ctx.translate(c, c); ctx.rotate((a0 + a1) / 2);
    ctx.textAlign = "right"; ctx.fillStyle = "#fff";
    ctx.font = "800 44px Cairo, sans-serif"; ctx.direction = "rtl";
    ctx.fillText(p.label, c - 34, 15);
    ctx.restore();
  });
}
document.fonts.load("800 44px Cairo").finally(drawWheel);

/* ================= عشوائية حقيقية ================= */
function secureRandom() { // رقم بين 0 و 1 من مولّد المتصفح الآمن
  const a = new Uint32Array(1); crypto.getRandomValues(a); return a[0] / 4294967296;
}
function pickIndex() {
  const total = PRIZES.reduce((s, p) => s + p.weight, 0);
  let r = secureRandom() * total;
  for (let i = 0; i < N; i++) { r -= PRIZES[i].weight; if (r < 0) return i; }
  return N - 1;
}

/* ================= الخطوات ================= */
function show(step) { ["step1","step2","step3"].forEach(s => $(s).hidden = s !== step); }
function showPrize(label) { $("prize").textContent = label; show("step3"); }

// لو حد لفّ قبل كده يظهرله جايزته على طول
try { const saved = localStorage.getItem(KEY); if (saved) showPrize(saved); } catch (e) {}

// سيرفر (اختياري): هل الـ IP ده لفّ قبل كده؟
if (API_URL) {
  fetch(API_URL + "/check").then(r => r.json()).then(d => { if (d.used) showPrize(d.prize); }).catch(() => {});
}

/* الخطوة 1: المتابعة (الفتح + انتظار بسيط) */
const opened = { f1: false, f2: false };
["f1", "f2"].forEach(id => $(id).addEventListener("click", () => {
  $(id).classList.add("pending");
  let left = WAIT_SECONDS;
  $("wait").textContent = "استنى " + left + " ثواني بعد ما تتابع الصفحة...";
  const t = setInterval(() => {
    left--;
    if (left > 0) { $("wait").textContent = "استنى " + left + " ثواني بعد ما تتابع الصفحة..."; return; }
    clearInterval(t); opened[id] = true; $(id).classList.add("done"); $("wait").textContent = "";
    if (opened.f1 && opened.f2) show("step2");
  }, 1000);
}, { once: true }));

/* الخطوة 2: اللفة */
$("spin").addEventListener("click", async () => {
  if (spinning) return;
  spinning = true; $("spin").disabled = true; $("msg").textContent = "";

  let idx = pickIndex();
  if (API_URL) { // السيرفر هو اللي يحدد النتيجة ويمنع التكرار
    try {
      const d = await (await fetch(API_URL + "/spin", { method: "POST" })).json();
      if (d.used) { showPrize(d.prize); return; }
      idx = d.index;
    } catch (e) { $("msg").textContent = "في مشكلة في الاتصال، حاول تاني."; spinning = false; $("spin").disabled = false; return; }
  }

  // صوت اللفة (يشتغل مع الضغطة، فمفيش مشكلة تشغيل تلقائي)
  const snd = $("spinSound");
  try { snd.currentTime = 0; const pr = snd.play(); if (pr) pr.catch(() => {}); } catch (e) {}

  // الزاوية اللي تخلي منتصف القطاع تحت المؤشر + انحراف عشوائي داخل القطاع
  const jitter = (secureRandom() - 0.5) * ARC * 0.7;
  const target = 360 - (idx * ARC + ARC / 2) + jitter;
  rotation += 360 * 6 + ((target - rotation) % 360 + 360) % 360;
  canvas.style.transform = "rotate(" + rotation + "deg)";

  setTimeout(() => {
    spinning = false;
    // وقف الصوت بتلاشي بسيط مع نهاية اللفة
    try {
      const snd = $("spinSound"); let v = 1;
      const f = setInterval(() => { v -= 0.1; if (v <= 0) { clearInterval(f); snd.pause(); snd.volume = 1; } else snd.volume = v; }, 60);
    } catch (e) {}
    const p = PRIZES[idx];
    if (p.final) {
      try { localStorage.setItem(KEY, p.label); } catch (e) {}
      showPrize(p.label);
    } else {
      $("msg").textContent = "حظ أوفر المرة دي — لفّ تاني!";
      $("spin").disabled = false; $("spin").textContent = "حاول تاني";
    }
  }, 5700);
});
