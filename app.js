/* ============================================================================
   Dompetku — app.js (Versi Pembelajaran)
   ----------------------------------------------------------------------------
   File ini berisi semua logika aplikasi. Diorganisir per bagian:

     1. KONSTANTA       -> data tetap (kategori, kunci storage)
     2. FUNGSI UTIL     -> format uang, parse, validasi, dll.
     3. STATE & STORAGE -> data global + load/save ke localStorage
     4. RENDER          -> fungsi yang menggambar ulang tampilan
     5. EVENT HANDLER   -> reaksi atas klik, submit, dll.
     6. INISIALISASI    -> kode yang dijalankan saat halaman dimuat

   Konsep yang dipakai:
     - querySelector / querySelectorAll
     - addEventListener (event delegation)
     - localStorage (JSON.stringify / parse)
     - Template literals (`...${...}...`)
     - Array methods: filter, map, reduce, find, sort
     - Intl.NumberFormat untuk format Rupiah
============================================================================ */

/* ===== 1. KONSTANTA ===== */

// Kunci untuk menyimpan data di localStorage browser.
// Selalu gunakan satu kunci unik agar mudah diatur.
const STORAGE_KEY = "dompetku-belajar.v1";

// Daftar kategori. Tiap kategori punya id, label, ikon emoji, dan warna.
// "type" menentukan kategori ini untuk pemasukan ("in") atau pengeluaran ("out").
const CATEGORIES = [
  {
    id: "food",
    label: "Makan & Minum",
    icon: "🍜",
    color: "#F59E0B",
    soft: "#FEF3D6",
    type: "out",
  },
  {
    id: "transport",
    label: "Transportasi",
    icon: "🚗",
    color: "#3E7BFA",
    soft: "#E8EFFE",
    type: "out",
  },
  {
    id: "shopping",
    label: "Belanja",
    icon: "🛍️",
    color: "#EC4899",
    soft: "#FCE7F3",
    type: "out",
  },
  {
    id: "bills",
    label: "Tagihan",
    icon: "📄",
    color: "#8B5CF6",
    soft: "#EDE9FE",
    type: "out",
  },
  {
    id: "entertainment",
    label: "Hiburan",
    icon: "🎬",
    color: "#F43F5E",
    soft: "#FFE4E6",
    type: "out",
  },
  {
    id: "health",
    label: "Kesehatan",
    icon: "💊",
    color: "#10B981",
    soft: "#D1FAE5",
    type: "out",
  },
  {
    id: "other_out",
    label: "Lain-lain",
    icon: "📌",
    color: "#64748B",
    soft: "#E2E8F0",
    type: "out",
  },
  {
    id: "salary",
    label: "Gaji",
    icon: "💼",
    color: "#18B26B",
    soft: "#E5F6ED",
    type: "in",
  },
  {
    id: "freelance",
    label: "Freelance",
    icon: "💻",
    color: "#6C5CE7",
    soft: "#EFEBFF",
    type: "in",
  },
  {
    id: "other_in",
    label: "Pemasukan Lain",
    icon: "✨",
    color: "#0EA5E9",
    soft: "#E0F2FE",
    type: "in",
  },
];

// Helper: cari kategori berdasarkan id.
function getCategory(id) {
  return (
    CATEGORIES.find(function (c) {
      return c.id === id;
    }) || CATEGORIES[6]
  );
}

// Daftar awal akun (akan disesuaikan saat onboarding).
const DEFAULT_ACCOUNTS = [
  { id: "cash", name: "Tunai", color: "#18B26B", balance: 0 },
  { id: "bank", name: "Bank", color: "#3E7BFA", balance: 0 },
  { id: "ewallet", name: "E-Wallet", color: "#6C5CE7", balance: 0 },
];

/* ===== 2. FUNGSI UTIL ===== */

/**
 * Format angka menjadi Rupiah, contoh 10000 -> "Rp 10.000".
 * Menggunakan API bawaan browser: Intl.NumberFormat.
 */
function formatIDR(value) {
  const n = Math.round(Number(value) || 0);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency: "IDR",
    minimumFractionDigits: 0,
  })
    .format(n)
    .replace("Rp", "Rp ");
}

/** Format angka tanpa simbol mata uang, contoh 10000 -> "10.000" */
function formatNumber(value) {
  return new Intl.NumberFormat("id-ID").format(Math.round(Number(value) || 0));
}

/**
 * Ambil hanya digit dari sebuah string lalu kembalikan sebagai number.
 * Berguna untuk membersihkan input "Rp 10.000" -> 10000.
 */
function parseNumber(str) {
  const digits = String(str).replace(/\D/g, "");
  return digits === "" ? "" : Number(digits);
}

/** Generator ID acak sederhana untuk transaksi. */
function uid() {
  return Math.random().toString(36).slice(2, 10);
}

/** Format tanggal pendek, contoh: "12 Mei 2026". */
function formatDate(iso) {
  return new Date(iso).toLocaleDateString("id-ID", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

/** Format tanggal+jam, contoh: "12 Mei 14:30". */
function formatDateTime(iso) {
  return new Date(iso).toLocaleString("id-ID", {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Mendapatkan data pengeluaran per kategori */
function getExpenseByCategory() {
  const now = new Date();

  // ambil pengeluaran bulan ini
  const currentMonthExpenses = [...state.transactions].filter((item) => {
    const dateValue = new Date(item.date);
    const currentMonth = dateValue.getMonth();
    const currentYear = dateValue.getFullYear();
    return (
      currentMonth === now.getMonth() &&
      currentYear === now.getFullYear() &&
      item.type === "expense"
    );
  });

  const totals = currentMonthExpenses.reduce((acc, item) => {
    Object.assign(acc, {
      ...acc,
      [item.category]: item.amount,
    });
    return acc;
  }, {});

  return Object.entries(totals).map((item) => {
    const [catId, value] = item;
    const cat = getCategory(catId);
    return {
      value,
      label: cat.label,
      color: cat.color,
    };
  });
}

/* ===== 3. STATE & STORAGE ===== */

/**
 * Bentuk state default. Selalu pakai bentuk yang sama
 * agar UI tidak error saat ada key yang hilang.
 */
function createDefaultState() {
  return {
    onboarded: false,
    profile: null,
    accounts: DEFAULT_ACCOUNTS, // [{id, name, color, balance}]
    transactions: [], // [{id, type, amount, category, account, date, note}]
    theme: "light",
  };
}

/** Baca data dari localStorage. Jika belum ada / rusak, kembalikan default. */
function loadState() {
  try {
    const defaultState = createDefaultState();
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState;
    return Object.assign(defaultState, JSON.parse(raw));
  } catch (err) {
    console.error("Gagal load state:", err);
    return createDefaultState();
  }
}

/** Tulis state saat ini ke localStorage. */
function saveState() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

// Variable utama yang menampung seluruh state aplikasi.
let state = loadState();

// State sementara untuk onboarding (sebelum di-commit ke state utama).
let onboardingStep = 1;
let onboardingData = {
  fullName: "",
  email: "",
  phone: "",
  birth: "",
  profession: "",
  startBalance: "",
  monthlyBudget: "",
  agreed: false,
};

// Filter aktif di halaman transaksi.
let txFilter = { type: "all", search: "" };

// Tipe transaksi yang sedang aktif di modal tambah.
let addType = "expense";

/* ===== 4. FUNGSI RENDER ===== */
/* Setiap kali state berubah, panggil renderApp() untuk menggambar ulang UI. */

function renderApp() {
  // Tentukan layar mana yang ditampilkan: onboarding atau aplikasi.
  document.getElementById("onboarding").hidden = state.onboarded;
  document.getElementById("app").hidden = !state.onboarded;

  console.log("state.transactions: ", state.transactions);

  if (state.onboarded) {
    renderTopbar();
    renderSidebar();
    renderDashboard();
    renderTransactions();
    renderProfile();
  } else {
    renderOnboardingStep();
  }
}

/* ---------- Onboarding ---------- */
function renderOnboardingStep() {
  // Tampilkan langkah yang sesuai
  document.querySelectorAll(".form-step").forEach(function (el) {
    el.classList.toggle(
      "is-active",
      Number(el.dataset.step) === onboardingStep,
    );
  });
  document.querySelectorAll(".stepper__item").forEach(function (el) {
    const step = Number(el.dataset.step);
    el.classList.toggle("is-active", step === onboardingStep);
    el.classList.toggle("is-done", step < onboardingStep);
  });

  // Tombol
  document.getElementById("btn-back").disabled = onboardingStep === 1;
  document.getElementById("btn-next").hidden = onboardingStep === 3;
  document.getElementById("btn-submit").hidden = onboardingStep !== 3;

  // Jika sampai langkah konfirmasi, tampilkan ringkasan.
  if (onboardingStep === 3) {
    const data = onboardingData;
    document.getElementById("summary").innerHTML = `
      <div><dt>Nama</dt>      <dd>${data.fullName || "—"}</dd></div>
      <div><dt>Email</dt>     <dd>${data.email || "—"}</dd></div>
      <div><dt>No. HP</dt>    <dd>${data.phone || "—"}</dd></div>
      <div><dt>Tgl. Lahir</dt><dd>${data.birth ? formatDate(data.birth) : "—"}</dd></div>
      <div><dt>Profesi</dt>   <dd>${data.profession || "—"}</dd></div>
      <div><dt>Saldo Awal</dt><dd>${data.startBalance !== "" ? formatIDR(data.startBalance) : "—"}</dd></div>
      <div><dt>Budget /bln</dt><dd>${data.monthlyBudget !== "" ? formatIDR(data.monthlyBudget) : "—"}</dd></div>
    `;
  }
}

/* ---------- Sidebar / Topbar ---------- */
function renderSidebar() {
  const p = state.profile || {};
  const name = p.fullName || "Pengguna";
  const initials = name
    .split(" ")
    .map(function (s) {
      return s[0];
    })
    .slice(0, 2)
    .join("")
    .toUpperCase();

  document.getElementById("user-avatar").textContent = initials;
  document.getElementById("user-name").textContent = name;
  document.getElementById("user-email").textContent = p.email || "—";
}

function renderTopbar() {
  const hour = new Date().getHours();
  let g = "Selamat malam";
  if (hour < 11) g = "Selamat pagi";
  else if (hour < 15) g = "Selamat siang";
  else if (hour < 18) g = "Selamat sore";

  document.getElementById("greeting").textContent = g;
  document.getElementById("greet-name").textContent = (
    state.profile?.fullName || "Pengguna"
  ).split(" ")[0];
}

/* ---------- Dashboard ---------- */
function renderDashboard() {
  // Total saldo = jumlah balance semua akun
  const total = state.accounts.reduce(function (sum, a) {
    return sum + a.balance;
  }, 0);
  document.getElementById("total-balance").textContent = formatIDR(total);

  // Hitung pemasukan & pengeluaran bulan ini
  const now = new Date();
  const monthTxs = state.transactions.filter(function (t) {
    const d = new Date(t.date);
    return (
      d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear()
    );
  });
  const income = monthTxs
    .filter(function (t) {
      return t.type === "income";
    })
    .reduce(function (s, t) {
      return s + Number(t.amount);
    }, 0);
  const expense = monthTxs
    .filter(function (t) {
      return t.type === "expense";
    })
    .reduce(function (s, t) {
      return s + Number(t.amount);
    }, 0);
  document.getElementById("month-income").textContent = formatIDR(income);
  document.getElementById("month-expense").textContent = formatIDR(expense);

  // Render budget
  const budget = Number(state.profile?.monthlyBudget) || 0;
  const budgetBody = document.getElementById("budget-body");
  if (budget > 0) {
    const pct = Math.min(100, (expense / budget) * 100);
    const sisa = Math.max(0, budget - expense);
    const cls = pct > 90 ? "is-danger" : pct > 70 ? "is-warn" : "";
    budgetBody.innerHTML = `
      <div class="budget__row">
        <span class="budget__spent">${formatIDR(expense)}</span>
        <span class="budget__limit">/ ${formatIDR(budget)}</span>
      </div>
      <div class="progress"><div class="progress__bar ${cls}" style="width:${pct}%"></div></div>
      <div class="budget__meta">
        <span class="left">${pct.toFixed(0)}% terpakai</span>
        <span class="right">Sisa ${formatIDR(sisa)}</span>
      </div>
    `;
  } else {
    budgetBody.innerHTML = `<div class="empty">Belum ada budget bulanan.</div>`;
  }

  // Render daftar akun
  document.getElementById("account-list").innerHTML = state.accounts
    .map(function (a) {
      return `
      <li>
        <span class="dot" style="background:${a.color}"></span>
        <span class="name">${a.name}</span>
        <span class="amount">${formatIDR(a.balance)}</span>
      </li>
    `;
    })
    .join("");

  // Aktivitas terbaru (5 transaksi paling baru)
  const recent = state.transactions.slice(0, 5);
  document.getElementById("recent-list").innerHTML = recent.length
    ? recent.map(renderTxItem).join("")
    : `<li class="empty">Belum ada transaksi. Tambahkan yang pertama!</li>`;

  console.log("state.transactions.length: ", state.transactions.length);
  console.log("total saldo: ", total);
}

/** Template untuk satu baris transaksi (dipakai di dashboard & halaman transaksi). */
function renderTxItem(tx) {
  const cat = getCategory(tx.category);
  const acc = state.accounts.find(function (a) {
    return a.id === tx.account;
  });
  const isIncome = tx.type === "income";
  return `
    <li class="tx-item">
      <span class="tx-item__icon" style="background:${cat.soft}">${cat.icon}</span>
      <div>
        <div class="tx-item__title">${tx.note || cat.label}</div>
        <div class="tx-item__meta">
          <span>${cat.label}</span>·
          <span>${acc ? acc.name : "—"}</span>·
          <span>${formatDateTime(tx.date)}</span>
        </div>
      </div>
      <span class="tx-item__amount ${isIncome ? "is-in" : ""}">
        ${isIncome ? "+" : "−"} ${formatIDR(tx.amount)}
      </span>
      <button class="tx-item__delete" data-delete="${tx.id}" title="Hapus">🗑</button>
    </li>
  `;
}

/* ---------- Halaman Transaksi ---------- */
function renderTransactions() {
  let list = state.transactions.slice(); // untuk copy seluruh element

  // Filter tipe
  if (txFilter.type !== "all") {
    list = list.filter(function (t) {
      return t.type === txFilter.type;
    });
  }
  // Filter pencarian
  if (txFilter.search) {
    const s = txFilter.search.toLowerCase();
    list = list.filter(function (t) {
      return (t.note || "").toLowerCase().includes(s);
    });
  }

  document.getElementById("tx-list").innerHTML = list.length
    ? list.map(renderTxItem).join("")
    : `<li class="empty">Tidak ada transaksi yang cocok.</li>`;

  console.log("render transaction call");
}

/* ---------- Halaman Profil ---------- */
function renderProfile() {
  const p = state.profile || {};
  document.getElementById("profile-summary").innerHTML = `
    <div><dt>Nama Lengkap</dt><dd>${p.fullName || "—"}</dd></div>
    <div><dt>Email</dt>       <dd>${p.email || "—"}</dd></div>
    <div><dt>No. HP</dt>      <dd>${p.phone || "—"}</dd></div>
    <div><dt>Tgl. Lahir</dt>  <dd>${p.birth ? formatDate(p.birth) : "—"}</dd></div>
    <div><dt>Profesi</dt>     <dd>${p.profession || "—"}</dd></div>
    <div><dt>Budget /bln</dt> <dd>${p.monthlyBudget ? formatIDR(p.monthlyBudget) : "—"}</dd></div>
  `;
}

/* ===== 5. VALIDASI FORM ===== */

/**
 * Tampilkan pesan error di sebelah field tertentu.
 * Jika msg kosong, error dianggap hilang.
 */
function setError(name, msg) {
  const errEl = document.querySelector(`[data-error-for="${name}"]`);
  if (errEl) errEl.textContent = msg || "";
  const field = document.getElementById(name)?.closest(".field");
  if (field) field.classList.toggle("is-invalid", Boolean(msg));
}

/** Hapus semua pesan error di form yang sedang aktif. */
function clearErrors() {
  document.querySelectorAll(".error").forEach(function (e) {
    e.textContent = "";
  });
  document.querySelectorAll(".field.is-invalid").forEach(function (f) {
    f.classList.remove("is-invalid");
  });
}

/** Validasi step onboarding. Return true jika valid. */
function validateOnboardingStep(step) {
  // 3. terakhir validateOnboardingStep
  clearErrors();
  let ok = true;
  const d = onboardingData;

  if (step === 1) {
    if (!d.fullName || d.fullName.trim().length < 3) {
      setError("fullName", "Nama minimal 3 karakter");
      ok = false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(d.email)) {
      setError("email", "Format email tidak valid");
      ok = false;
    }
    const phone = d.phone.replace(/[\s-]/g, "");
    if (!/^08\d{8,12}$/.test(phone)) {
      // \d{8,12} artinya di ikuti minimal 8 atau maksimal 12 digit
      setError("phone", "Nomor HP harus diawali 08 (10–14 digit)");
      ok = false;
    }
    if (!d.birth) {
      setError("birth", "Tanggal lahir wajib diisi");
      ok = false;
    } else {
      const age =
        (Date.now() - new Date(d.birth).getTime()) /
        (1000 * 60 * 60 * 24 * 365.25);
      if (age < 17) {
        setError("birth", "Minimal berusia 17 tahun");
        ok = false;
      } else if (age > 100) {
        setError("birth", "Tanggal lahir tidak valid");
        ok = false;
      }
    }
    if (!d.profession) {
      setError("profession", "Pilih profesi");
      ok = false;
    }
  }

  if (step === 2) {
    if (d.startBalance === "" || Number(d.startBalance) < 0) {
      setError("startBalance", "Saldo awal tidak valid");
      ok = false;
    }
    if (d.monthlyBudget !== "" && Number(d.monthlyBudget) < 0) {
      setError("monthlyBudget", "Budget tidak valid");
      ok = false;
    }
  }

  if (step === 3) {
    if (!d.agreed) {
      setError("agreed", "Harap setujui syarat & ketentuan");
      ok = false;
    }
  }

  return ok;
}

/* ===== 6. EVENT HANDLER ===== */

/**
 * Setup semua event listener untuk onboarding.
 * Pakai event delegation di form agar fleksibel.
 */
function setupOnboarding() {
  // 1. bahas dulu setupOnboarding
  const form = document.getElementById("form-onboarding");

  // Update onboardingData setiap kali user mengetik.
  form.addEventListener("input", function (e) {
    // Event Delegation
    const t = e.target;
    if (!t.name && t.id !== "agreed") return;

    if (t.id === "agreed") {
      onboardingData.agreed = t.checked;
    } else if (t.id === "startBalance" || t.id === "monthlyBudget") {
      // Untuk field uang: bersihkan ke angka, lalu tampilkan kembali dengan format
      const n = parseNumber(t.value);
      onboardingData[t.id] = n;
      t.value = n === "" ? "" : formatNumber(n);
      // Update hint preview "Rp xxx"
      const hint = document.getElementById(t.id + "-hint");
      if (hint && n !== "") hint.textContent = formatIDR(n);
    } else if (t.id === "phone") {
      // Untuk HP, izinkan angka + spasi/dash saja
      t.value = t.value.replace(/[^\d\s-]/g, "");
      onboardingData.phone = t.value;
    } else {
      onboardingData[t.name || t.id] = t.value;
    }
  });

  // Tombol Lanjut
  document.getElementById("btn-next").addEventListener("click", function () {
    if (validateOnboardingStep(onboardingStep)) {
      onboardingStep++;
      renderOnboardingStep();
    }
  });

  // Tombol Kembali
  document.getElementById("btn-back").addEventListener("click", function () {
    if (onboardingStep > 1) {
      onboardingStep--;
      renderOnboardingStep();
    }
  });

  // Submit final
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    if (!validateOnboardingStep(3)) return;

    // Commit ke state utama
    state.onboarded = true;
    state.profile = Object.assign({}, onboardingData);
    state.accounts = state.accounts.map(function (a) {
      if (a.id === "cash")
        return Object.assign({}, a, {
          balance: Number(onboardingData.startBalance) || 0,
        });
      return a;
    });
    saveState();
    renderApp();
  });
}

/** Navigasi antar view di aplikasi utama (Dashboard / Transaksi / Profil). */
function setupNavigation() {
  document.querySelectorAll("[data-route]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      const route = btn.dataset.route;

      // Toggle nav active state
      document.querySelectorAll(".nav__item").forEach(function (n) {
        n.classList.toggle("is-active", n.dataset.route === route);
      });
      // Toggle view active state
      document.querySelectorAll(".view").forEach(function (v) {
        v.classList.toggle("is-active", v.dataset.view === route);
      });
      // Tutup sidebar di mobile
      document.querySelector(".sidebar").classList.remove("is-open");
    });
  });

  // Tombol menu mobile
  document.getElementById("btn-menu").addEventListener("click", function () {
    document.querySelector(".sidebar").classList.toggle("is-open");
  });

  // Reset aplikasi (untuk demo)
  document.getElementById("btn-reset").addEventListener("click", function () {
    if (confirm("Reset semua data dan mulai ulang?")) {
      localStorage.removeItem(STORAGE_KEY);
      state = createDefaultState();
      onboardingStep = 1;
      onboardingData = {
        fullName: "",
        email: "",
        phone: "",
        birth: "",
        profession: "",
        startBalance: "",
        monthlyBudget: "",
        agreed: false,
      };
      document.getElementById("form-onboarding").reset();
      renderApp();
    }
  });
}

/** Filter di halaman transaksi. */
function setupTransactionFilter() {
  // Tombol segmen (Semua / Pemasukan / Pengeluaran)
  document.querySelectorAll("[data-filter]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      document.querySelectorAll("[data-filter]").forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      txFilter.type = btn.dataset.filter;
      renderTransactions();
    });
  });

  // Search input
  document.getElementById("search").addEventListener("input", function (e) {
    txFilter.search = e.target.value;
    renderTransactions();
  });

  // Tombol hapus (event delegation di body)
  document.body.addEventListener("click", function (e) {
    // event delegation dengan tipe "click" pada seluruh body
    console.log(e.target.dataset);
    const id = e.target.dataset.delete;
    if (!id) return;
    if (!confirm("Hapus transaksi ini?")) return;
    deleteTransaction(id);
  });
}

/** Modal tambah transaksi. */
function setupAddModal() {
  const modal = document.getElementById("modal-add");
  const form = document.getElementById("form-add");

  // Buka modal
  document.getElementById("btn-add").addEventListener("click", function () {
    openAddModal();
  });

  // Tutup modal (klik backdrop, tombol close, atau tombol batal)
  modal.addEventListener("click", function (e) {
    if (e.target.dataset.close !== undefined) closeAddModal();
  });
  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape" && !modal.hidden) closeAddModal();
  });

  // Toggle pengeluaran/pemasukan
  modal.querySelectorAll("[data-type]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      modal.querySelectorAll("[data-type]").forEach(function (b) {
        b.classList.remove("is-active");
      });
      btn.classList.add("is-active");
      addType = btn.dataset.type;
      populateCategoryOptions();
    });
  });

  // Input uang: live format
  const amountInput = document.getElementById("amount");
  const amountHint = document.getElementById("amount-hint");
  amountInput.addEventListener("input", function () {
    const n = parseNumber(amountInput.value);
    amountInput.value = n === "" ? "" : formatNumber(n);
    amountHint.textContent =
      n !== "" ? formatIDR(n) : "Masukkan jumlah dalam Rupiah.";
  });

  // Submit form tambah
  form.addEventListener("submit", function (e) {
    e.preventDefault();
    clearErrors();

    const amount = parseNumber(document.getElementById("amount").value);
    const category = document.getElementById("category").value;
    const account = document.getElementById("account").value;
    const date = document.getElementById("date").value;
    const note = document.getElementById("note").value.trim();

    // Validasi
    let ok = true;
    if (amount === "" || Number(amount) <= 0) {
      setError("amount", "Nominal harus lebih dari 0");
      ok = false;
    }
    if (!category) {
      ok = false;
    }
    if (!account) {
      ok = false;
    }
    if (!date) {
      ok = false;
    }
    if (!ok) return;

    addTransaction({
      type: addType,
      amount: Number(amount),
      category: category,
      account: account,
      date: new Date(date).toISOString(),
      note: note,
    });

    closeAddModal();
  });
}

function openAddModal() {
  document.getElementById("modal-add").hidden = false;

  // Reset form
  document.getElementById("form-add").reset();
  document.getElementById("amount-hint").textContent =
    "Masukkan jumlah dalam Rupiah.";
  addType = "expense";
  document.querySelectorAll("[data-type]").forEach(function (b) {
    b.classList.toggle("is-active", b.dataset.type === "expense");
  });

  // Set default tanggal = sekarang
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 16);
  document.getElementById("date").value = local;

  // Isi opsi kategori & akun
  populateCategoryOptions();
  populateAccountOptions();
}

function closeAddModal() {
  document.getElementById("modal-add").hidden = true;
}

/** Isi <select> kategori sesuai tipe (expense/income) yang aktif. */
function populateCategoryOptions() {
  const wantedType = addType === "income" ? "in" : "out";
  const opts = CATEGORIES.filter(function (c) {
    return c.type === wantedType;
  });
  document.getElementById("category").innerHTML = opts
    .map(function (c) {
      return `<option value="${c.id}">${c.icon} ${c.label}</option>`;
    })
    .join("");
}

/** Isi <select> akun beserta saldonya. */
function populateAccountOptions() {
  document.getElementById("account").innerHTML = state.accounts
    .map(function (a) {
      return `<option value="${a.id}">${a.name} — ${formatIDR(a.balance)}</option>`;
    })
    .join("");
}

/* ===== 7. MUTASI STATE (Tambah / Hapus transaksi) ===== */

function addTransaction(tx) {
  // Simpan transaksi baru di paling atas array.
  state.transactions.unshift(Object.assign({ id: uid() }, tx));

  // Update saldo akun terkait.
  state.accounts = state.accounts.map(function (a) {
    if (a.id !== tx.account) return a;
    const delta = tx.type === "income" ? Number(tx.amount) : -Number(tx.amount);
    return Object.assign({}, a, { balance: a.balance + delta });
  });

  saveState();
  renderApp();
}

function deleteTransaction(id) {
  const tx = state.transactions.find(function (t) {
    return t.id === id;
  });
  if (!tx) return;

  // Hapus dari array
  state.transactions = state.transactions.filter(function (t) {
    return t.id !== id;
  });

  // Kembalikan saldo akun (balikkan operasi sebelumnya)
  state.accounts = state.accounts.map(function (a) {
    if (a.id !== tx.account) return a;
    const delta = tx.type === "income" ? -Number(tx.amount) : Number(tx.amount);
    return Object.assign({}, a, { balance: a.balance + delta });
  });

  saveState();
  renderApp();
}

/* ===== 8. INISIALISASI ===== */
/* Dijalankan satu kali setelah halaman selesai dimuat. */

function init() {
  setupOnboarding();
  setupNavigation();
  setupTransactionFilter();
  setupAddModal();
  renderApp();
}

// Karena <script> ditaruh di akhir <body>, DOM sudah siap saat baris ini berjalan.
init();
