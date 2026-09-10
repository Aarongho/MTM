/* ============================================================
   Data layer — Maju Terus Maju
   Pakai Firebase Firestore kalau firebase-config.js sudah diisi.
   Kalau belum, otomatis fallback ke localStorage (per-perangkat).
   API-nya sama (async), jadi halaman tidak perlu tahu bedanya.
   ============================================================ */
(function () {
  const cfg = window.FIREBASE_CONFIG || {};
  const configured = cfg.apiKey && cfg.apiKey !== "ISI_DISINI";

  const DB = {
    mode: configured ? "cloud" : "local",
    ready: false,
  };

  /* ---------- MODE CLOUD (Firestore) ---------- */
  function initCloud() {
    firebase.initializeApp(cfg);
    const fs = firebase.firestore();

    DB.addSale = (obj) =>
      fs.collection("sales").add({
        ...obj,
        createdAt: Date.now(),
      });

    DB.getSalesByDate = async (date) => {
      const snap = await fs.collection("sales").where("tanggal", "==", date).get();
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return rows;
    };

    DB.getAllSales = async () => {
      const snap = await fs.collection("sales").get();
      const rows = [];
      snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (a.createdAt || 0) - (b.createdAt || 0));
      return rows;
    };

    DB.deleteSale = (id) => fs.collection("sales").doc(id).delete();
    DB.deleteIklan = (date) => fs.collection("iklan").doc(date).delete();
    DB.deleteBulanan = (month) => fs.collection("bulanan").doc(month).delete();

    DB.addStokMasuk = (e) => fs.collection("stokmasuk").add({ ...e, createdAt: Date.now() });
    DB.getStokMasuk = async () => {
      const snap = await fs.collection("stokmasuk").get();
      const rows = []; snap.forEach((d) => rows.push({ id: d.id, ...d.data() }));
      rows.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      return rows;
    };
    DB.deleteStokMasuk = (id) => fs.collection("stokmasuk").doc(id).delete();

    DB.getAllIklan = async () => {
      const snap = await fs.collection("iklan").get();
      const m = {}; snap.forEach((d) => { m[d.id] = d.data().nilai; });
      return m;
    };
    DB.getAllBulanan = async () => {
      const snap = await fs.collection("bulanan").get();
      const m = {}; snap.forEach((d) => { m[d.id] = d.data(); });
      return m;
    };
    DB.getIklan = async (date) => {
      const d = await fs.collection("iklan").doc(date).get();
      return d.exists ? d.data().nilai : null;
    };
    DB.setIklan = async (date, nilai) => {
      const ref = fs.collection("iklan").doc(date);
      const d = await ref.get();
      if (d.exists) throw new Error("terkunci");
      await ref.set({ nilai, createdAt: Date.now() });
    };

    DB.getBulanan = async (month) => {
      const d = await fs.collection("bulanan").doc(month).get();
      return d.exists ? d.data() : null;
    };
    DB.setBulanan = async (month, obj) => {
      const ref = fs.collection("bulanan").doc(month);
      const d = await ref.get();
      const cur = d.exists ? d.data() : {};
      // hanya boleh set field yang belum ada (sekali set per bulan)
      const next = { ...cur };
      for (const k of ["wrapping", "plastik", "lakban"]) {
        if (obj[k] != null && cur[k] == null) next[k] = obj[k];
      }
      await ref.set(next, { merge: true });
    };

    DB.ready = true;
  }

  /* ---------- MODE LOCAL (localStorage) ---------- */
  function initLocal() {
    const K = "mtm_data_v1";
    const load = () =>
      JSON.parse(localStorage.getItem(K) || '{"sales":[],"iklan":{},"bulanan":{}}');
    const save = (d) => localStorage.setItem(K, JSON.stringify(d));

    DB.addSale = async (obj) => {
      const d = load();
      d.sales.push({ id: "l" + Date.now() + Math.random().toString(36).slice(2, 6), ...obj, createdAt: Date.now() });
      save(d);
    };
    DB.getSalesByDate = async (date) => {
      const d = load();
      return d.sales.filter((s) => s.tanggal === date).sort((a, b) => a.createdAt - b.createdAt);
    };
    DB.getAllSales = async () => {
      const d = load();
      return d.sales.slice().sort((a, b) => a.createdAt - b.createdAt);
    };
    DB.deleteSale = async (id) => { const d = load(); d.sales = d.sales.filter((s) => s.id !== id); save(d); };
    DB.deleteIklan = async (date) => { const d = load(); delete d.iklan[date]; save(d); };
    DB.deleteBulanan = async (month) => { const d = load(); delete d.bulanan[month]; save(d); };

    DB.addStokMasuk = async (e) => { const d = load(); d.stokmasuk = d.stokmasuk || []; d.stokmasuk.push({ id: "l" + Date.now() + Math.random().toString(36).slice(2, 6), ...e, createdAt: Date.now() }); save(d); };
    DB.getStokMasuk = async () => { const d = load(); return (d.stokmasuk || []).slice().sort((a, b) => b.createdAt - a.createdAt); };
    DB.deleteStokMasuk = async (id) => { const d = load(); d.stokmasuk = (d.stokmasuk || []).filter((x) => x.id !== id); save(d); };

    DB.getAllIklan = async () => { const d = load(); return d.iklan || {}; };
    DB.getAllBulanan = async () => { const d = load(); return d.bulanan || {}; };
    DB.getIklan = async (date) => {
      const d = load();
      return date in d.iklan ? d.iklan[date] : null;
    };
    DB.setIklan = async (date, nilai) => {
      const d = load();
      if (date in d.iklan) throw new Error("terkunci");
      d.iklan[date] = nilai;
      save(d);
    };
    DB.getBulanan = async (month) => {
      const d = load();
      return d.bulanan[month] || null;
    };
    DB.setBulanan = async (month, obj) => {
      const d = load();
      const cur = d.bulanan[month] || {};
      for (const k of ["wrapping", "plastik", "lakban"]) {
        if (obj[k] != null && cur[k] == null) cur[k] = obj[k];
      }
      d.bulanan[month] = cur;
      save(d);
    };
    DB.ready = true;
  }

  try {
    if (configured) initCloud();
    else initLocal();
  } catch (e) {
    console.error("Gagal init cloud, fallback ke local:", e);
    DB.mode = "local";
    initLocal();
  }

  window.DB = DB;
})();
