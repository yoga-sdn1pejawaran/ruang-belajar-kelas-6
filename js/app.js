"use strict";

const daftarMurid = [
  "ADELIA FARANISA AZNI", "AHZA HANAN MUTAQIM", "AIDA NADHIF LATIFA",
  "AKRAF AHLAL BAITI", "ALBAR ARROSYID", "ALGA ADINATA SYAHPUTRA",
  "ANASTASYA PUTRI WULANDARI", "AULIA IZZATUN NISA",
  "CAKKA RAFFANDITYA PRATAMA", "FAIRUZ AUNULLOH ASSAJID",
  "FAKIH IHSANUDIN", "HAZAR AFIKO MAULANA", "JESEN WIBISANA",
  "KANAYA NADHIFA AFRIANI", "KHAFIZAN SA’DAN PRAMUDYA",
  "MEILA NUR SALSA BELA", "MEILANI ROUDHATUL WALIJAH",
  "MUHAMMAD AL HABSYIPAHLEVIE", "VIOLA NUR QUSNAENI"
];

const daftarMapel = {
  matematika: "Matematika",
  "bahasa-indonesia": "Bahasa Indonesia",
  ipas: "IPAS",
  "pendidikan-pancasila": "Pendidikan Pancasila",
  "bahasa-inggris": "Bahasa Inggris",
  "seni-rupa": "Seni Rupa",
  "bahasa-jawa": "Bahasa Jawa",
  "dawet-ayu": "Dawet Ayu Banjarnegara",
  "belajar-tka": "BELAJAR TKA"
};

const $ = id => document.getElementById(id);
const el = {
  nama: $("namaMurid"), absen: $("nomorAbsen"),
  action: $("actionSection"), material: $("materialSection"),
  package: $("packageSection"), quiz: $("quizSection"),
  result: $("resultSection"), subjectTitle: $("selectedSubjectTitle"),
  materialTitle: $("materialTitle"), materialContent: $("materialContent"),
  packageTitle: $("packageTitle"), packageDescription: $("packageDescription"),
  packageGrid: $("packageGrid"), packageInfo: $("packageInfo"),
  start: $("startButton"), questionList: $("questionList"),
  quizTitle: $("quizTitle"),
  quizPackageLabel: $("quizPackageLabel"), quizStudent: $("quizStudent"),
  progressBar: $("progressBar"), progressLabel: $("progressLabel"),
  submit: $("submitQuiz"), finalScore: $("finalScore"),
  scoreDetail: $("scoreDetail"), resultIdentity: $("resultIdentity"),
  reviewList: $("reviewList"), historyContent: $("historyContent")
};

let muridTerpilih = null;
let mapelTerpilih = null;
let paketTerpilih = null;
let bankAktif = null;
let soalAktif = [];
let sisaDetik = 0;
let intervalTimer = null;
let latihanSelesai = false;
let kunciTimerSimulasi = null;
let nomorSoalAktif = 0;
let waktuMulaiSimulasi = null;
let jumlahPeringatanPindahTab = 0;

// Endpoint Web App Google Apps Script untuk rekap Simulasi ASAS.
const GOOGLE_SHEETS_API_URL = "https://script.google.com/macros/s/AKfycbw7kCm4weAe94dAEB2cL-dHQoBHLp1_PLHvVZG4g9A73WHMcmLcQaFfPu5dgfZ2aTY/exec";

// Coba kirim ulang satu payload yang sebelumnya gagal dimulai/dikirim oleh browser.
(function kirimUlangJikaAdaPayloadTertunda() {
  let tertunda = null;
  try {
    tertunda = localStorage.getItem("ruangBelajarPengirimanTertunda");
  } catch (error) {
    console.warn("Penyimpanan lokal tidak dapat dibaca:", error);
  }
  if (!tertunda) return;
  fetch(GOOGLE_SHEETS_API_URL, {
    method: "POST",
    mode: "no-cors",
    credentials: "omit",
    keepalive: true,
    headers: { "Content-Type": "text/plain;charset=UTF-8" },
    body: tertunda
  }).then(() => {
    // Mode no-cors tidak membuka isi respons; hapus hanya setelah request diterima browser.
    localStorage.removeItem("ruangBelajarPengirimanTertunda");
  }).catch(error => console.error("Pengiriman ulang nilai tertunda gagal:", error));
})();

// Hitung setiap kali siswa meninggalkan tab saat sedang mengerjakan simulasi.
document.addEventListener("visibilitychange", () => {
  if (document.hidden && modeBankAktif === "Simulasi ASAS" && !latihanSelesai && el.quiz && !el.quiz.hidden) {
    jumlahPeringatanPindahTab++;
  }
});

function sembunyikanSemuaPanelPembelajaran() {
  [
    "mainHomeSection", "semester2Section", "subjectSection",
    "actionSection", "materialSection", "packageSection", "quizSection",
    "resultSection", "historySection", "topicSection", "assessmentPackageSection",
    "asasPackageSection", "tkaSubjectSection", "tkaSessionSection",
    "tkaPackageSection"
  ].forEach(id => { const node = document.getElementById(id); if (node) node.hidden = true; });
}


const konfigurasiMatematika = {
  1: {durasi: 35, tersedia: true},
  2: {durasi: 40, tersedia: true},
  3: {durasi: 45, tersedia: true},
  4: {durasi: 40, tersedia: true},
  5: {durasi: 40, tersedia: true},
  6: {durasi: 45, tersedia: true},
  7: {durasi: 60, tersedia: false},
  8: {durasi: 60, tersedia: false},
  9: {durasi: 60, tersedia: false},
  10: {durasi: 60, tersedia: false}
};

function muatDaftarMurid() {
  daftarMurid.forEach((nama, index) => {
    const option = document.createElement("option");
    option.value = String(index + 1);
    option.textContent = nama;
    el.nama.appendChild(option);
  });
}

el.nama.addEventListener("change", () => {
  const nomor = Number(el.nama.value);
  muridTerpilih = nomor ? {
    nama: daftarMurid[nomor - 1], nomorAbsen: nomor, kelas: "VI"
  } : null;
  el.absen.value = nomor ? String(nomor).padStart(2, "0") : "";
});

document.querySelectorAll(".subject-button").forEach(button => {
  button.addEventListener("click", () => {
    // Bahasa Inggris memakai halaman belajar mandiri dari file HTML khusus.
    // Mata pelajaran lain tetap memakai alur Ruang Belajar Digital seperti semula.
    if (button.dataset.mapel === "bahasa-inggris") {
      // Simpan sesi siswa sementara agar tombol kembali dari halaman Bahasa Inggris
      // dapat langsung membuka daftar mata pelajaran Semester 1 tanpa login ulang.
      if (muridTerpilih) {
        sessionStorage.setItem("ruangBelajarSiswaSemester1", JSON.stringify(muridTerpilih));
      }
      window.location.href = "bahasa-inggris.html";
      return;
    }
    mapelTerpilih = button.dataset.mapel;
    paketTerpilih = null;
    daftarMateriCache = [];
    sembunyikanSemuaPanelPembelajaran();
    document.querySelectorAll(".subject-button").forEach(b => b.classList.remove("active"));
    button.classList.add("active");
    document.getElementById("subjectSection").hidden = true;
    el.subjectTitle.textContent = daftarMapel[mapelTerpilih];
    el.action.hidden = false;
    el.material.hidden = true;
    el.package.hidden = true;
    el.quiz.hidden = true;
    el.result.hidden = true;
    el.action.scrollIntoView({behavior: "smooth", block: "start"});
  });
});

let daftarMateriCache = [];
function renderDaftarMateri() {
  el.materialContent.innerHTML = "";
  const intro = document.createElement("p");
  intro.className = "material-list-intro";
  intro.textContent = "Pilih salah satu materi untuk membuka pembelajaran secara terpisah.";
  el.materialContent.appendChild(intro);
  const grid = document.createElement("div");
  grid.className = "material-card-grid";
  daftarMateriCache.forEach((materi, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "material-card";
    button.innerHTML = `<span class="material-card-number">MATERI ${index+1}</span><strong>${materi.judul}</strong><span class="material-card-action">Buka materi <span aria-hidden="true">→</span></span>`;
    button.addEventListener("click", () => renderDetailMateri(index));
    grid.appendChild(button);
  });
  el.materialContent.appendChild(grid);
}
function normalisasiBarisMateri(teks) {
  return String(teks ?? "").replace(/\\r\\n/g, "\n").replace(/\\n/g, "\n").replace(/\\r/g, "\n");
}

function renderDetailMateri(index) {
  const materi = daftarMateriCache[index];
  el.materialContent.innerHTML = "";
  const back = document.createElement("button");
  back.type = "button"; back.className = "secondary-button material-back-button";
  back.textContent = "← Kembali ke daftar materi";
  back.addEventListener("click", renderDaftarMateri);
  el.materialContent.appendChild(back);
  const section = document.createElement("section"); section.className = "lesson-unit lesson-detail";
  const heading = document.createElement("h3"); heading.textContent = `Materi ${index+1}. ${materi.judul}`;
  const intro = document.createElement("p"); intro.className = "lesson-intro"; intro.innerHTML = formatTeksMatematika(normalisasiBarisMateri(materi.pengantar || ""));
  section.append(heading, intro);
  if (Array.isArray(materi.tujuan) && materi.tujuan.length) {
    const wrap=document.createElement("div"); wrap.className="lesson-part lesson-objectives";
    const h=document.createElement("h4"); h.textContent="Tujuan Pembelajaran";
    const ul=document.createElement("ul");
    materi.tujuan.forEach(item=>{const li=document.createElement("li");li.innerHTML=formatTeksMatematika(normalisasiBarisMateri(item));ul.appendChild(li);});
    wrap.append(h,ul);section.appendChild(wrap);
  }
  (materi.bagian || []).forEach(([judul, isi]) => {
    const part=document.createElement("div");part.className="lesson-part";
    const h=document.createElement("h4");h.textContent=judul;
    part.appendChild(h);
    normalisasiBarisMateri(isi || "").split("\n").map(line=>line.trim()).filter(Boolean).forEach(line=>{
      if(line.startsWith("• ")){
        let list=part.lastElementChild;
        if(!list || list.tagName!=="UL"){list=document.createElement("ul");list.className="lesson-bullets";part.appendChild(list);}
        const li=document.createElement("li");li.innerHTML=formatTeksMatematika(line.slice(2));list.appendChild(li);
      } else {
        const p=document.createElement("p");
        if(line.startsWith("Contoh:") || line.startsWith("Contoh ")) p.className="lesson-example";
        else if(line.startsWith("Ingat:") || line.startsWith("Rangkuman:")) p.className="lesson-tip";
        else if(line.startsWith("Langkah ") || line.startsWith("Jawaban:")) p.className="lesson-step";
        p.innerHTML=formatTeksMatematika(line);part.appendChild(p);
      }
    });
    section.appendChild(part);
  });
  el.materialContent.appendChild(section);
  el.materialContent.scrollIntoView({behavior:"smooth",block:"start"});
}
$("materialButton").addEventListener("click", async () => {
  if (!mapelTerpilih) return;
  el.action.hidden = true;
  el.package.hidden = true;
  el.material.hidden = false;
  el.materialTitle.textContent = "Materi " + daftarMapel[mapelTerpilih];
  try {
    const konfigurasi = konfigurasiMapelDigital[mapelTerpilih];
    if (!konfigurasi) throw new Error("Konfigurasi materi mapel belum tersedia.");
    const response = await fetch(konfigurasi.fileMateri, {cache:"no-store"});
    if (!response.ok) throw new Error("File materi tidak ditemukan: " + konfigurasi.fileMateri);
    daftarMateriCache = await response.json();
    if (!Array.isArray(daftarMateriCache) || !daftarMateriCache.length) {
      throw new Error("Isi file materi kosong atau formatnya tidak sesuai.");
    }
    renderDaftarMateri();
  } catch (error) {
    el.materialContent.textContent = "Materi gagal dimuat: " + error.message;
  }
  el.material.scrollIntoView({behavior:"smooth",block:"start"});
});

$("backFromMaterial").addEventListener("click", () => {
  el.material.hidden = true;
  el.action.hidden = false;
  el.action.scrollIntoView({behavior: "smooth", block: "start"});
});

$("backToSubjects").addEventListener("click", () => {
  sembunyikanSemuaPanelPembelajaran();
  document.getElementById("subjectSection").hidden = false;
  document.querySelectorAll(".subject-button").forEach(button => button.classList.remove("active"));
  mapelTerpilih = null;
  paketTerpilih = null;
  document.getElementById("subjectSection").scrollIntoView({behavior:"smooth", block:"start"});
});

// Navigasi beranda utama: Semester 1, Semester 2, dan TKA.
const mainHomeSection = $("mainHomeSection");
const semester2Section = $("semester2Section");
const subjectSection = $("subjectSection");
function kembaliKeBerandaUtama() {
  sembunyikanSemuaPanelPembelajaran();
  mainHomeSection.hidden = false;
  window.scrollTo({top: 0, behavior: "smooth"});
}
$("openSemester1").addEventListener("click", () => {
  sembunyikanSemuaPanelPembelajaran();
  subjectSection.hidden = false;
  subjectSection.scrollIntoView({behavior:"smooth", block:"start"});
});
$("openSemester2").addEventListener("click", () => {
  sembunyikanSemuaPanelPembelajaran();
  semester2Section.hidden = false;
  semester2Section.scrollIntoView({behavior:"smooth", block:"start"});
});
$("backSemester2Home").addEventListener("click", kembaliKeBerandaUtama);
$("backSubjectsToHome").addEventListener("click", kembaliKeBerandaUtama);
$("openTkaFromHome").addEventListener("click", () => {
  sembunyikanSemuaPanelPembelajaran();
  $("tkaSubjectSection").hidden = false;
  $("tkaSubjectSection").scrollIntoView({behavior:"smooth", block:"start"});
});

const topicSection = $("topicSection");
const assessmentPackageSection = $("assessmentPackageSection");
const asasPackageSection = $("asasPackageSection");
let topikTerpilih = "";

let modeBankAktif = "Latihan Per Materi";
let namaMateriAktif = "";

async function mulaiBankDigital(namaFile, mode, paket, materi="") {
  if (!muridTerpilih) {
    alert("Silakan login terlebih dahulu.");
    return;
  }
  try {
    const response = await fetch(`data/${namaFile}`, {cache:"no-store"});
    if (!response.ok) throw new Error("Bank soal tidak ditemukan.");
    const bank = await response.json();
    if (mapelTerpilih === "matematika" && mode === "Latihan Per Materi") {
      const judulBank = String(bank.judul || "")
        .replace(/\s*•\s*(Latihan|Paket\s*\d+)\s*$/i, "")
        .trim();
      if (bank.materi !== materi || judulBank !== materi) {
        throw new Error(
          `Pemetaan materi tidak cocok. Materi yang dipilih "${materi}", ` +
          `metadata file "${bank.materi || "(kosong)"}", judul file "${judulBank || "(kosong)"}".`
        );
      }
    }
    const targetJumlah = mode === "Simulasi ASAS" ? 30 : 10;
    if (!Array.isArray(bank.soal) || bank.soal.length !== targetJumlah) {
      throw new Error(`Jumlah soal tidak sesuai. Seharusnya ${targetJumlah} soal.`);
    }
    if (bank.soal.some(s => !s.pembahasan || !s.pertanyaan || !s.jenis)) {
      throw new Error("Ada soal yang belum lengkap jenis, pertanyaan, atau pembahasannya.");
    }
    const jenisDidukung = ["pilihan_ganda", "pilihan_ganda_kompleks", "menjodohkan", "benar_salah", "isian_angka", "isian", "uraian"];
    const jenisTidakDidukung = [...new Set(bank.soal.map(s => s.jenis).filter(jenis => !jenisDidukung.includes(jenis)))];
    if (jenisTidakDidukung.length) {
      throw new Error("Jenis soal belum didukung: " + jenisTidakDidukung.join(", "));
    }
    bank.soal.forEach((soal, index) => {
      const nomor = index + 1;
      if ((soal.jenis === "pilihan_ganda" || soal.jenis === "pilihan_ganda_kompleks") && (!Array.isArray(soal.opsi) || !soal.opsi.length || !soal.kunci)) {
        throw new Error(`Struktur pilihan pada soal ${nomor} tidak lengkap.`);
      }
      if ((soal.jenis === "benar_salah" || soal.jenis === "menjodohkan") && (!Array.isArray(soal.kunci) || !soal.kunci.length)) {
        throw new Error(`Kunci soal ${nomor} tidak lengkap.`);
      }
      if (soal.jenis === "benar_salah" && (!Array.isArray(soal.pernyataan) || soal.pernyataan.length !== soal.kunci.length)) {
        throw new Error(`Pernyataan dan kunci soal ${nomor} tidak seimbang.`);
      }
      if (soal.jenis === "menjodohkan" && (!Array.isArray(soal.pasangan) || soal.pasangan.length !== soal.kunci.length)) {
        throw new Error(`Pasangan dan kunci soal ${nomor} tidak seimbang.`);
      }
      if (["isian", "isian_angka", "uraian"].includes(soal.jenis) && soal.kunci == null) {
        throw new Error(`Kunci soal ${nomor} tidak tersedia.`);
      }
    });
    bankAktif = bank;
    modeBankAktif = mode;
    namaMateriAktif = materi;
    paketTerpilih = paket;
    soalAktif = [...bank.soal];
    nomorSoalAktif = 0;
    latihanSelesai = false;
    if (mode === "Simulasi ASAS") {
      waktuMulaiSimulasi = Date.now();
      jumlahPeringatanPindahTab = 0;
    } else {
      waktuMulaiSimulasi = null;
      jumlahPeringatanPindahTab = 0;
    }
    topicSection.hidden = true;
    assessmentPackageSection.hidden = true;
    asasPackageSection.hidden = true;
    el.action.hidden = true;
    el.material.hidden = true;
    el.package.hidden = true;
    el.result.hidden = true;
    renderSoal();
    $("quizModeLabel").textContent = mode.toUpperCase();
    $("quizTimerLabel").textContent = mode === "Simulasi ASAS" ? ((Number(bank.durasiMenit) || (mapelTerpilih === "matematika" ? 70 : mapelTerpilih === "ipas" || mapelTerpilih === "bahasa-indonesia" ? 40 : 75)) + ":00") : "Tanpa batas waktu";
    $("quizTimerLabel").classList.toggle("timer-active", mode === "Simulasi ASAS");
    $("quizTimerLabel").classList.remove("timer-warning");
    el.quizPackageLabel.textContent = `${daftarMapel[mapelTerpilih] || "MATA PELAJARAN"} • ${mode.toUpperCase()} • PAKET ${paket}`;
    el.quiz.hidden = false;
    el.result.hidden = true;
    el.quiz.scrollIntoView({behavior:"smooth",block:"start"});
    clearInterval(intervalTimer);
    if (mode === "Simulasi ASAS") {
      kunciTimerSimulasi = `rbd-simulasi-${muridTerpilih.nomorAbsen}-${bank.id}-${Number(bank.durasiMenit) || (mapelTerpilih === "matematika" ? 70 : mapelTerpilih === "ipas" || mapelTerpilih === "bahasa-indonesia" ? 40 : 75)}`;
      let mulaiPada = Number(localStorage.getItem(kunciTimerSimulasi));
      if (!mulaiPada || !Number.isFinite(mulaiPada)) {
        mulaiPada = Date.now();
        localStorage.setItem(kunciTimerSimulasi, String(mulaiPada));
      }
      const durasiSimulasiMenit = Number(bank.durasiMenit) || (mapelTerpilih === "matematika" ? 70 : mapelTerpilih === "ipas" || mapelTerpilih === "bahasa-indonesia" ? 40 : 75);
      sisaDetik = Math.max(0, durasiSimulasiMenit*60 - Math.floor((Date.now()-mulaiPada)/1000));
      const menitAwal = Math.floor(sisaDetik/60);
      const detikAwal = sisaDetik%60;
      $("quizTimerLabel").textContent = `${String(menitAwal).padStart(2,"0")}:${String(detikAwal).padStart(2,"0")}`;
      if (sisaDetik <= 300) $("quizTimerLabel").classList.add("timer-warning");
      if (sisaDetik <= 0) {
        $("quizTimerLabel").textContent = "00:00";
        setTimeout(() => selesaikanLatihan(true), 0);
      }
      intervalTimer = setInterval(() => {
        if (latihanSelesai) return;
        sisaDetik--;
        const menit = Math.floor(sisaDetik/60);
        const detik = sisaDetik%60;
        $("quizTimerLabel").textContent = `${String(menit).padStart(2,"0")}:${String(detik).padStart(2,"0")}`;
        if (sisaDetik <= 300) $("quizTimerLabel").classList.add("timer-warning");
        if (sisaDetik <= 0) {
          clearInterval(intervalTimer);
          alert("Waktu simulasi telah habis. Jawaban akan dikumpulkan otomatis.");
          selesaikanLatihan(true);
        }
      },1000);
    }
  } catch (error) {
    alert("Bank soal belum dapat dibuka: " + error.message);
  }
}

const konfigurasiMapelDigital = {
  matematika: {prefix:"matematika", fileMateri:"data/matematika-materi.json", jumlahMateri:6},
  "bahasa-indonesia": {prefix:"bahasa-indonesia", fileMateri:"data/bahasa-indonesia-materi.json", jumlahMateri:5},
  ipas: {prefix:"ipas", fileMateri:"data/ipas-materi.json", jumlahMateri:6},
  "pendidikan-pancasila": {prefix:"pendidikan-pancasila", fileMateri:"data/pendidikan-pancasila-materi.json", jumlahMateri:3},
  "bahasa-inggris": {prefix:"bahasa-inggris", fileMateri:"data/bahasa-inggris-materi.json", jumlahMateri:1},
  "seni-rupa": {prefix:"seni-rupa", fileMateri:"data/seni-rupa-materi.json", jumlahMateri:4},
  "bahasa-jawa": {prefix:"bahasa-jawa", fileMateri:"data/bahasa-jawa-materi.json", jumlahMateri:3},
  "dawet-ayu": {prefix:"dawet-ayu", fileMateri:"data/dawet-ayu-materi.json", jumlahMateri:3}
};

async function ambilDaftarMateriMapel(mapel) {
  const konfigurasi = konfigurasiMapelDigital[mapel];
  if (!konfigurasi) throw new Error("Konfigurasi mapel tidak ditemukan: " + mapel);
  const response = await fetch(konfigurasi.fileMateri, {cache:"no-store"});
  if (!response.ok) throw new Error("File materi tidak ditemukan: " + konfigurasi.fileMateri);
  const materi = await response.json();
  if (!Array.isArray(materi) || materi.length !== konfigurasi.jumlahMateri || materi.some(item => !item.judul)) {
    throw new Error("Isi file materi tidak sesuai konfigurasi untuk " + (daftarMapel[mapel] || mapel));
  }
  return materi;
}

async function tampilkanTopik() {
  if (!mapelTerpilih) return;

  el.action.hidden = true;
  topicSection.hidden = false;
  assessmentPackageSection.hidden = true;
  asasPackageSection.hidden = true;

  const namaMapel = daftarMapel[mapelTerpilih] || "Mata Pelajaran";
  const konfigurasi = konfigurasiMapelDigital[mapelTerpilih];
  const grid = $("topicGrid");
  grid.innerHTML = "<p>Memuat daftar materi...</p>";
  $("topicSectionTitle").textContent = "Pilih Materi " + namaMapel;
  topicSection.scrollIntoView({behavior:"smooth",block:"start"});

  try {
    if (!konfigurasi) throw new Error("Konfigurasi mapel belum tersedia.");
    const daftarMateri = await ambilDaftarMateriMapel(mapelTerpilih);
    grid.innerHTML = "";
    daftarMateri.forEach((materi, index) => {
      const nama = materi.judul;
      const button = document.createElement("button");
      button.type = "button";
      button.className = "topic-button";
      // Kesepakatan proyek: setiap materi menampilkan tepat satu paket latihan.
      const satuPaketPerMateri = true;
      const isDawet = mapelTerpilih === "dawet-ayu";
      button.innerHTML = `<span class="topic-number">${isDawet ? `BAB ${index+1}` : `MATERI ${index+1}`}</span><strong>${nama}</strong><small>1 paket latihan • 10 soal • tanpa timer</small>`;
      button.addEventListener("click", () => {
        topikTerpilih = nama;
        topicSection.hidden = true;
        assessmentPackageSection.hidden = false;
        $("assessmentPackageTitle").textContent = nama;
        $("assessmentPackageDescription").textContent =
          `${namaMapel} • ${nama} • 1 paket berisi 10 soal • tanpa batas waktu.`;
        const packageGrid = $("assessmentPackageGrid");
        packageGrid.innerHTML = "";
        // Konsisten dengan label materi: hanya satu tombol latihan untuk setiap materi.
        const jumlahPaket = 1;
        for (let n=1;n<=jumlahPaket;n++) {
          const packageButton = document.createElement("button");
          packageButton.type = "button";
          packageButton.className = "package-button";
          packageButton.textContent = "MULAI LATIHAN • 10 SOAL";
          packageButton.addEventListener("click", () => {
            const file = satuPaketPerMateri
              ? `${konfigurasi.prefix}-latihan-m${index+1}-p1.json`
              : `${konfigurasi.prefix}-latihan-m${index+1}-p${n}.json`;
            mulaiBankDigital(file, "Latihan Per Materi", n, nama);
          });
          packageGrid.appendChild(packageButton);
        }
        const mathOnlyNote = assessmentPackageSection.querySelector(".tka-preparing");
        if (mathOnlyNote) {
          const showMathNote = mapelTerpilih === "matematika";
          mathOnlyNote.hidden = !showMathNote;
          mathOnlyNote.style.display = showMathNote ? "" : "none";
        }
        assessmentPackageSection.scrollIntoView({behavior:"smooth",block:"start"});
      });
      grid.appendChild(button);
    });
  } catch (error) {
    grid.innerHTML = "";
    const message = document.createElement("p");
    message.textContent = "Daftar materi gagal dimuat: " + error.message;
    grid.appendChild(message);
  }
}
$("practiceButton").addEventListener("click", tampilkanTopik);
$("asasButton").addEventListener("click", () => {
  el.action.hidden = true;
  asasPackageSection.hidden = false;
  const konfigurasi = konfigurasiMapelDigital[mapelTerpilih];
  if (!konfigurasi) {
    alert("Konfigurasi mapel belum tersedia.");
    return;
  }
  const namaMapel = daftarMapel[mapelTerpilih] || "Mata Pelajaran";
  $("asasPackageTitle").textContent = "Simulasi " + namaMapel;
  const grid = $("asasPackageGrid");
  grid.innerHTML = "";
  // Kesepakatan proyek: setiap mata pelajaran menyediakan tepat 2 paket simulasi.
  const jumlahSimulasi = 2;
  for (let n=1;n<=jumlahSimulasi;n++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "package-button";
    button.textContent = `PAKET ${n}`;
    button.addEventListener("click", () => {
      const file = `${konfigurasi.prefix}-simulasi-p${n}.json`;
      mulaiBankDigital(file, "Simulasi ASAS", n);
    });
    grid.appendChild(button);
  }
  const note = asasPackageSection.querySelector(".tka-preparing");
  note.textContent = `Tersedia ${jumlahSimulasi} paket simulasi. Setiap paket berisi 30 soal gabungan. Batas waktu mengikuti durasi yang tercantum pada masing-masing paket.`;
  asasPackageSection.scrollIntoView({behavior:"smooth",block:"start"});
});
$("backFromTopics").addEventListener("click", () => { topicSection.hidden = true; el.action.hidden = false; el.action.scrollIntoView({behavior:"smooth",block:"start"}); });
$("backFromAssessmentPackages").addEventListener("click", () => { assessmentPackageSection.hidden = true; topicSection.hidden = false; topicSection.scrollIntoView({behavior:"smooth",block:"start"}); });
$("backFromAsasPackages").addEventListener("click", () => { asasPackageSection.hidden = true; el.action.hidden = false; el.action.scrollIntoView({behavior:"smooth",block:"start"}); });

$("backFromPackage").addEventListener("click", () => {
  el.package.hidden = true;
  el.action.hidden = false;
  el.action.scrollIntoView({behavior: "smooth", block: "start"});
});

function renderPaket() {
  el.packageGrid.innerHTML = "";
  paketTerpilih = null;
  el.start.disabled = true;

  const jumlah = mapelTerpilih === "matematika" ? 10 : 4;
  el.packageDescription.textContent = mapelTerpilih === "matematika"
    ? "Paket 1 sampai 6 tersedia. Paket 7 sampai 10 akan dibuka setelah bank soalnya selesai."
    : "Pilih paket latihan yang tersedia.";

  for (let i = 1; i <= jumlah; i++) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "package-button";
    button.textContent = "PAKET " + i;
    button.dataset.paket = String(i);

    let tersedia = false;
    if (mapelTerpilih === "matematika") {
      tersedia = konfigurasiMatematika[i].tersedia;
    }
    button.disabled = !tersedia;
    if (!tersedia) {
      button.classList.add("not-ready");
      button.title = "Bank soal belum tersedia";
    }
    button.addEventListener("click", () => {
      if (!tersedia) return;
      paketTerpilih = i;
      el.packageGrid.querySelectorAll("button").forEach(b => b.classList.remove("active"));
      button.classList.add("active");
      el.packageInfo.textContent = "Mode latihan tanpa batas waktu. Kerjakan dengan tenang.";
      el.start.disabled = false;
    });
    el.packageGrid.appendChild(button);
  }
  el.packageInfo.textContent = mapelTerpilih === "matematika"
    ? "Pilih paket yang tersedia. Mode latihan tidak menggunakan hitung mundur."
    : "Bank soal untuk mata pelajaran ini belum dihubungkan.";
}

$("startButton").addEventListener("click", mulaiLatihan);

async function mulaiLatihan() {
  if (!muridTerpilih) {
    alert("Silakan pilih nama kamu terlebih dahulu agar hasil latihan tercatat dengan benar.");
    el.nama.focus();
    return;
  }
  if (mapelTerpilih !== "matematika" || !konfigurasiMatematika[paketTerpilih]?.tersedia) {
    alert("Bank soal untuk paket ini belum tersedia.");
    return;
  }

  el.start.disabled = true;
  el.start.textContent = "MEMUAT SOAL...";
  try {
    const response = await fetch(`data/matematika-paket-${paketTerpilih}.json`, {cache: "no-store"});
    if (!response.ok) throw new Error("File bank soal tidak ditemukan.");
    bankAktif = await response.json();
    if (!Array.isArray(bankAktif.soal) || bankAktif.soal.length !== 10) {
      throw new Error("Struktur bank soal tidak sesuai atau jumlah soal bukan 10.");
    }
    soalAktif = acak([...bankAktif.soal]);
    latihanSelesai = false;
    renderSoal();
    el.package.hidden = true;
    el.quiz.hidden = false;
    el.quiz.scrollIntoView({behavior: "smooth", block: "start"});
    // Mode latihan reguler tidak memakai hitung mundur agar murid dapat belajar dengan tenang.
  } catch (error) {
    alert("Gagal memuat soal: " + error.message + "\nPastikan aplikasi dibuka melalui Live Server.");
  } finally {
    el.start.textContent = "MULAI LATIHAN";
    el.start.disabled = false;
  }
}

function acak(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}


function formatTeksMatematika(teks) {
  const aman = String(teks)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");

  // Pecahan campuran: 2 1/2 -> 2 + pecahan bertingkat
  return aman
    .replace(/(\d+)\s+(\d+)\/(\d+)/g,
      '$1<span class="pecahan"><span class="pembilang">$2</span><span class="penyebut">$3</span></span>')
    // Pecahan biasa: 5/6 -> pecahan bertingkat
    .replace(/(\d+)\/(\d+)/g,
      '<span class="pecahan"><span class="pembilang">$1</span><span class="penyebut">$2</span></span>');
}

function drawMatchingArrows(board, selects) {
  const svg = board.querySelector(".matching-arrows");
  if (!svg) return;
  const rect = board.getBoundingClientRect();
  if (!rect.width || !rect.height) return;
  svg.setAttribute("width", String(rect.width));
  svg.setAttribute("height", String(rect.height));
  svg.setAttribute("viewBox", `0 0 ${rect.width} ${rect.height}`);
  board.querySelectorAll(".matching-left-item,.matching-right-item").forEach(el => {
    el.classList.remove("match-color-0","match-color-1","match-color-2","match-color-3","match-color-4");
  });
  const arrowColors = ["#2563eb", "#e11d48", "#059669", "#d97706", "#7c3aed"];
  svg.innerHTML = `<defs>${selects.map((_, i) => {
    const color = arrowColors[i % arrowColors.length];
    return `<marker id="matchingArrowHead-${i}" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L0,6 L7,3 z" fill="${color}"></path></marker>`;
  }).join("")}</defs>`;
  selects.forEach((select, index) => {
    if (!select.value) return;
    const left = board.querySelector(`.matching-left-item[data-left-index="${index}"]`);
    const right = [...board.querySelectorAll(".matching-right-item")].find(el => el.dataset.rightValue === select.value);
    if (!left || !right) return;
    const a = left.getBoundingClientRect(), b = right.getBoundingClientRect();
    const x1 = a.right - rect.left, y1 = a.top + a.height / 2 - rect.top;
    const x2 = b.left - rect.left, y2 = b.top + b.height / 2 - rect.top;
    const mid = (x1 + x2) / 2;
    const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
    path.setAttribute("d", `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2 - 5} ${y2}`);
    const color = arrowColors[index % arrowColors.length];
    path.setAttribute("fill", "none"); path.setAttribute("stroke", color);
    path.setAttribute("stroke-width", "3"); path.setAttribute("marker-end", `url(#matchingArrowHead-${index})`);
    path.setAttribute("opacity", "0.95"); svg.appendChild(path);
    left.classList.add(`match-color-${index % arrowColors.length}`);
    right.classList.add(`match-color-${index % arrowColors.length}`);
  });
}

function renderSoal() {
  el.quizTitle.textContent = bankAktif.judul;
  el.quizPackageLabel.textContent = `${bankAktif.mataPelajaran.toUpperCase()} • PAKET ${bankAktif.paket}`;
  el.quizStudent.textContent = `${muridTerpilih.nama} • Absen ${muridTerpilih.nomorAbsen} • Kelas VI`;
  el.questionList.innerHTML = "";

  soalAktif.forEach((soal, index) => {
    const article = document.createElement("article"); article.className = "question-card";
    const heading = document.createElement("h3"); heading.textContent = `Soal ${index + 1}`;
    article.appendChild(heading);
    if (soal.stimulus) {
      const stimulus = document.createElement("section");
      stimulus.className = "question-stimulus";
      stimulus.style.cssText = "margin:14px 0 18px;padding:16px 18px;border-left:4px solid #3b82f6;border-radius:10px;background:#f1f6fd;color:#243b53;";
      const stimulusText = document.createElement("p");
      stimulusText.innerHTML = formatTeksMatematika(soal.stimulus);
      stimulusText.style.cssText = "margin:0;line-height:1.7;text-align:justify;text-justify:inter-word;";
      stimulus.appendChild(stimulusText);
      article.appendChild(stimulus);
    }
    const prompt = document.createElement("p"); prompt.className = "question-prompt"; prompt.style.whiteSpace = "pre-line";
    prompt.innerHTML = formatTeksMatematika(soal.pertanyaan);
    article.appendChild(prompt);
    const groupName = `jawaban-${index}`;
    const addLabel = (text) => { const l=document.createElement("p"); l.className="answer-label"; l.textContent=text; article.appendChild(l); };
    if (soal.jenis === "pilihan_ganda" || soal.jenis === "pilihan_ganda_kompleks") {
      addLabel(soal.jenis === "pilihan_ganda" ? "Pilih satu jawaban yang benar." : "Pilih tepat tiga jawaban yang benar.");
      soal.opsi.forEach((opsi, oi) => {
        const label=document.createElement("label"); label.className="choice-option";
        const input=document.createElement("input"); input.type=soal.jenis === "pilihan_ganda" ? "radio" : "checkbox";
        input.name=groupName; input.value=opsi.id; input.className="answer-input"; input.dataset.index=String(index);
        input.addEventListener("change", updateProgress);
        const span=document.createElement("span");
        span.innerHTML=`<strong class="choice-letter">${opsi.id}.</strong> <span class="choice-answer">${formatTeksMatematika(opsi.teks)}</span>`;
        // Keep the option letter beside the answer; math expressions should not drift to the far edge.
        label.style.display="flex";
        label.style.alignItems="center";
        label.style.justifyContent="flex-start";
        label.style.gap="12px";
        label.style.textAlign="left";
        input.style.flex="0 0 auto";
        span.style.display="flex";
        span.style.alignItems="center";
        span.style.justifyContent="flex-start";
        span.style.gap="8px";
        span.style.flex="1 1 auto";
        span.style.minWidth="0";
        span.style.textAlign="left";
        label.append(input,span); article.appendChild(label);
      });
    } else if (soal.jenis === "benar_salah") {
      addLabel("Baca setiap pernyataan, lalu pilih Benar atau Salah.");
      const tfBoard = document.createElement("div"); tfBoard.className = "tf-board";
      soal.pernyataan.forEach((item, pi) => {
        const row = document.createElement("div"); row.className = "tf-row";
        const text = document.createElement("p"); text.className = "tf-statement";
        text.innerHTML = `${pi + 1}. ${formatTeksMatematika(item.teks)}`;
        const choices = document.createElement("div"); choices.className = "tf-options";
        ["benar", "salah"].forEach(value => {
          const label = document.createElement("label"); label.className = "tf-choice";
          const input = document.createElement("input"); input.type = "radio";
          input.name = `${groupName}-${pi}`; input.value = value;
          input.className = "answer-input"; input.dataset.index = String(index); input.dataset.sub = String(pi);
          input.addEventListener("change", updateProgress);
          label.append(input, document.createTextNode(value === "benar" ? "Benar" : "Salah"));
          choices.appendChild(label);
        });
        row.append(text, choices); tfBoard.appendChild(row);
      });
      article.appendChild(tfBoard);
    } else if (soal.jenis === "menjodohkan") {
      addLabel("Tarik garis dengan cara memilih pernyataan di kiri, lalu pilih pasangan yang tepat di kanan.");
      const board = document.createElement("div"); board.className = "matching-board";
      const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
      svg.classList.add("matching-arrows"); svg.setAttribute("aria-hidden", "true");
      const leftCol = document.createElement("div"); leftCol.className = "matching-column matching-left";
      const rightCol = document.createElement("div"); rightCol.className = "matching-column matching-right";
      const leftTitle = document.createElement("div"); leftTitle.className = "matching-column-title"; leftTitle.textContent = "PERNYATAAN";
      const rightTitle = document.createElement("div"); rightTitle.className = "matching-column-title"; rightTitle.textContent = "PASANGAN";
      leftCol.appendChild(leftTitle); rightCol.appendChild(rightTitle);
      const hiddenSelects = [];
      soal.pasangan.forEach((item, pi) => {
        const row = document.createElement("button"); row.type = "button"; row.className = "matching-left-item";
        row.innerHTML = `${pi + 1}. ${formatTeksMatematika(item.teks)}`; row.dataset.leftIndex = String(pi);
        row.addEventListener("click", () => {
          board.dataset.activeLeft = String(pi);
          board.querySelectorAll(".matching-left-item").forEach((el, i) => el.classList.toggle("is-selected", i === pi));
          board.querySelectorAll(".matching-right-item").forEach(el => el.classList.remove("is-selected"));
        });
        leftCol.appendChild(row);
        const hidden = document.createElement("select"); hidden.className = "answer-input matching-hidden-answer";
        hidden.dataset.index = String(index); hidden.dataset.sub = String(pi);
        const blank = document.createElement("option"); blank.value = ""; blank.textContent = "";
        hidden.appendChild(blank);
        soal.pilihan.forEach(value => { const opt = document.createElement("option"); opt.value = value; opt.textContent = value; hidden.appendChild(opt); });
        hidden.addEventListener("change", updateProgress);
        article.appendChild(hidden); hiddenSelects.push(hidden);
      });
      soal.pilihan.forEach((value, oi) => {
        const row = document.createElement("button"); row.type = "button"; row.className = "matching-right-item";
        row.innerHTML = formatTeksMatematika(value); row.dataset.rightValue = value; row.dataset.rightIndex = String(oi);
        row.addEventListener("click", () => {
          const leftIndex = Number(board.dataset.activeLeft);
          if (!Number.isInteger(leftIndex) || leftIndex < 0 || leftIndex >= hiddenSelects.length) {
            const hint = article.querySelector(".matching-hint");
            if (hint) hint.textContent = "Pilih pernyataan di kolom kiri terlebih dahulu.";
            return;
          }
          const current = hiddenSelects[leftIndex].value;
          const alreadyUsedBy = hiddenSelects.findIndex((sel, i) => i !== leftIndex && sel.value === value);
          if (alreadyUsedBy !== -1) {
            const hint = article.querySelector(".matching-hint");
            if (hint) hint.textContent = `Pilihan ${value} sudah dipasangkan dengan nomor ${alreadyUsedBy + 1}. Pilih pilihan lain.`;
            return;
          }
          if (current === value) hiddenSelects[leftIndex].value = "";
          else hiddenSelects[leftIndex].value = value;
          board.querySelectorAll(".matching-left-item").forEach((el, i) => el.classList.toggle("is-selected", i === leftIndex));
          board.querySelectorAll(".matching-right-item").forEach(el => {
            el.classList.toggle("is-used", hiddenSelects.some(sel => sel.value === el.dataset.rightValue));
            el.classList.toggle("is-selected", el.dataset.rightValue === hiddenSelects[leftIndex].value);
          });
          const hint = article.querySelector(".matching-hint");
          if (hint) hint.textContent = hiddenSelects[leftIndex].value ? `Pasangan nomor ${leftIndex + 1}: ${value}` : `Pasangan nomor ${leftIndex + 1} dihapus.`;
          drawMatchingArrows(board, hiddenSelects);
          updateProgress();
        });
        rightCol.appendChild(row);
      });
      const hint = document.createElement("p"); hint.className = "matching-hint"; hint.textContent = "Belum ada pasangan yang dipilih.";
      board.append(svg, leftCol, rightCol, hint);
      article.appendChild(board);
      requestAnimationFrame(() => drawMatchingArrows(board, hiddenSelects));
    } else if (soal.jenis === "isian" || soal.jenis === "uraian") {
      addLabel(soal.jenis === "uraian" ? "Tuliskan jawaban secara lengkap dan jelas." : "Tuliskan jawaban singkat dan tepat.");
      const input = document.createElement("textarea");
      input.id = groupName; input.className = "answer-input"; input.rows = soal.jenis === "uraian" ? 4 : 2;
      input.placeholder = soal.jenis === "uraian" ? "Tulis jawaban uraian di sini..." : "Tulis jawaban di sini...";
      input.dataset.index = String(index); input.addEventListener("input", updateProgress); article.appendChild(input);
      if (soal.jenis === "uraian") {
        const note = document.createElement("small"); note.textContent = "Jawaban uraian memerlukan pemeriksaan guru berdasarkan rubrik."; note.className = "answer-note"; article.appendChild(note);
      }
    } else {
      addLabel(soal.indikator === "Mengoperasikan pecahan biasa dan campuran" ? "Jawaban (pecahan atau desimal)" : "Jawaban (angka)"); const input=document.createElement("input");input.type="text";input.inputMode="decimal";input.spellcheck=false;input.id=groupName;input.className="answer-input";input.placeholder=soal.indikator === "Mengoperasikan pecahan biasa dan campuran" ? "Contoh: 3/4 atau 0,75" : "Ketik jawaban angka";input.autocomplete="off";input.dataset.index=String(index);input.addEventListener("input",updateProgress);article.appendChild(input);
    }
    const feedback = document.createElement("div");
    feedback.className = "practice-feedback";
    feedback.hidden = true;
    feedback.setAttribute("aria-live", "polite");
    article.appendChild(feedback);
    el.questionList.appendChild(article);
  });

  // Navigasi nomor soal: hanya satu kartu ditampilkan pada satu waktu.
  const nav = $("questionNumberNav");
  nav.innerHTML = "";
  soalAktif.forEach((_, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "question-number";
    button.textContent = String(index + 1);
    button.dataset.questionIndex = String(index);
    button.setAttribute("aria-label", `Buka soal ${index + 1}`);
    button.addEventListener("click", () => pindahKeSoal(index));
    nav.appendChild(button);
  });
  $("previousQuestion").onclick = () => pindahKeSoal(nomorSoalAktif - 1);
  $("nextQuestion").onclick = () => pindahKeSoal(nomorSoalAktif + 1);
  tampilkanSoalAktif();
  updateProgress();
}

function statusJawabanSoal(soal, card) {
  if (!card) return false;
  if (soal.jenis === "pilihan_ganda") return !!card.querySelector("input:checked");
  if (soal.jenis === "pilihan_ganda_kompleks") return card.querySelectorAll("input:checked").length === 3;
  if (soal.jenis === "benar_salah") return card.querySelectorAll("input:checked").length === soal.pernyataan.length;
  if (soal.jenis === "menjodohkan") {
    const vals = [...card.querySelectorAll("select")].map(x => x.value);
    return vals.length > 0 && vals.every(Boolean) && new Set(vals).size === vals.length;
  }
  return !!card.querySelector(".answer-input")?.value.trim();
}

function tampilkanSoalAktif() {
  [...el.questionList.children].forEach((card, index) => {
    card.hidden = index !== nomorSoalAktif;
  });
  $("previousQuestion").disabled = nomorSoalAktif === 0;
  $("nextQuestion").hidden = nomorSoalAktif === soalAktif.length - 1;
  $("submitQuiz").hidden = nomorSoalAktif !== soalAktif.length - 1;
  const navButtons = [...$("questionNumberNav").querySelectorAll("button")];
  navButtons.forEach((button, index) => {
    const answered = statusJawabanSoal(soalAktif[index], el.questionList.children[index]);
    button.classList.toggle("is-current", index === nomorSoalAktif);
    button.classList.toggle("is-answered", answered);
    button.classList.toggle("is-unanswered", !answered && index !== nomorSoalAktif);
    button.setAttribute("aria-current", index === nomorSoalAktif ? "step" : "false");
    button.title = `Soal ${index + 1}: ${index === nomorSoalAktif ? "sedang dikerjakan" : answered ? "sudah dijawab" : "belum dijawab"}`;
  });
  $("currentQuestionLabel").textContent = `SOAL ${nomorSoalAktif + 1} DARI ${soalAktif.length}`;
}

function pindahKeSoal(index) {
  if (index < 0 || index >= soalAktif.length) return;
  nomorSoalAktif = index;
  tampilkanSoalAktif();
  updateProgress();
  $("quizSection").scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateProgress() {
  let terisi = 0;
  soalAktif.forEach((soal, index) => {
    if (statusJawabanSoal(soal, el.questionList.children[index])) terisi++;
  });
  const belum = soalAktif.length - terisi;
  el.progressLabel.textContent = `Soal ${nomorSoalAktif + 1} dari ${soalAktif.length} • ${terisi} sudah dijawab • ${belum} belum dijawab`;
  el.progressBar.style.width = `${(terisi / soalAktif.length) * 100}%`;
  if (modeBankAktif === "Latihan Per Materi" && !latihanSelesai) {
    soalAktif.forEach((soal, index) => {
      tampilkanUmpanBalikLatihan(soal, el.questionList.children[index]);
    });
  }
  if ($("questionNumberNav").children.length) tampilkanSoalAktif();
}

function hitungJawabanSatuSoal(soal, card) {
  let benar = false;
  let skor = 0;
  let rincian = [];

  if (soal.jenis === "pilihan_ganda") {
    const jawaban = card.querySelector("input:checked")?.value || "";
    benar = jawaban === soal.kunci;
    skor = benar ? 2 : 0;
  } else if (soal.jenis === "pilihan_ganda_kompleks") {
    const dipilih = [...card.querySelectorAll("input:checked")].map(x => x.value);
    const kunci = [...soal.kunci];
    skor = dipilih.length === 3 ? dipilih.filter(x => kunci.includes(x)).length * 2 : 0;
    benar = dipilih.length === 3 && skor === 6;
  } else if (soal.jenis === "benar_salah") {
    const dipilih = soal.pernyataan.map((_, i) =>
      card.querySelector(`input[data-sub="${i}"]:checked`)?.value || ""
    );
    rincian = dipilih.map((jawaban, i) => ({
      benar: jawaban === soal.kunci[i],
      jawaban,
      kunci: soal.kunci[i],
      teks: soal.pernyataan[i].teks
    }));
    skor = dipilih.reduce((sum, jawaban, i) =>
      sum + (jawaban && jawaban === soal.kunci[i] ? 2 : 0), 0
    );
    benar = dipilih.length === soal.kunci.length &&
      dipilih.every((jawaban, i) => jawaban === soal.kunci[i]);
  } else if (soal.jenis === "menjodohkan") {
    const dipilih = [...card.querySelectorAll("select")].map(x => x.value);
    const unik = new Set(dipilih.filter(Boolean)).size === dipilih.filter(Boolean).length;
    rincian = dipilih.map((jawaban, i) => ({
      benar: unik && jawaban === soal.kunci[i],
      jawaban,
      kunci: soal.kunci[i],
      teks: soal.pasangan[i].teks
    }));
    skor = unik ? dipilih.reduce((sum, jawaban, i) =>
      sum + (jawaban && jawaban === soal.kunci[i] ? 1 : 0), 0
    ) : 0;
    benar = dipilih.length === soal.kunci.length && skor === 4;
  } else if (soal.jenis === "isian_angka") {
    const jawaban = card.querySelector(".answer-input")?.value.trim() || "";
    const nilaiJawaban = parseJawabanAngka(jawaban);
    const nilaiKunci = Number(soal.kunci);
    benar = nilaiJawaban !== null && Number.isFinite(nilaiKunci) && Math.abs(nilaiJawaban - nilaiKunci) < 0.00005;
    skor = benar ? 5 : 0;
  } else if (soal.jenis === "isian") {
    const jawaban = normalisasiJawabanTeks(card.querySelector(".answer-input")?.value || "");
    const kataKunci = (Array.isArray(soal.kataKunci) ? soal.kataKunci : [soal.kunci]).map(normalisasiJawabanTeks).filter(Boolean);
    benar = kataKunci.length > 0 && kataKunci.every(k => jawaban.includes(k));
    skor = benar ? Number(soal.skorMaksimal) || 5 : 0;
  }
  return {benar, skor, rincian};
}

function tampilkanUmpanBalikLatihan(soal, card) {
  if (soal.jenis === "uraian") return; // Uraian dinilai guru, bukan otomatis oleh aplikasi.
  if (!card || card.dataset.feedbackDone === "true" ||
      !statusJawabanSoal(soal, card)) return;

  const hasil = hitungJawabanSatuSoal(soal, card);
  const panel = card.querySelector(".practice-feedback");
  if (!panel) return;

  card.dataset.feedbackDone = "true";
  panel.hidden = false;
  const maksimal = {
    pilihan_ganda: 2,
    pilihan_ganda_kompleks: 6,
    benar_salah: 6,
    menjodohkan: 4,
    isian_angka: 5,
    isian: Number(soal.skorMaksimal) || 5,
    uraian: Number(soal.skorMaksimal) || 5
  }[soal.jenis] || 0;

  panel.style.cssText = `margin-top:18px;padding:16px;border-radius:12px;
    border:1px solid ${hasil.benar ? "#86d6a5" : "#f0aaaa"};
    background:${hasil.benar ? "#effaf2" : "#fff3f3"};color:#17324d;`;

  const status = document.createElement("strong");
  status.textContent = hasil.benar ? "✓ BENAR!" :
    hasil.skor > 0 ? "◐ SEBAGIAN BENAR" : "✕ BELUM TEPAT";
  status.style.cssText = `display:block;font-size:17px;margin-bottom:8px;
    color:${hasil.benar ? "#16743a" : hasil.skor > 0 ? "#9a6500" : "#b42318"};`;

  const skor = document.createElement("p");
  skor.textContent = `Skor soal: ${hasil.skor} dari ${maksimal}`;

  const key = document.createElement("p");
  key.textContent = `Kunci jawaban: ${
    Array.isArray(soal.kunci) ? soal.kunci.join(", ") : soal.kunci
  }`;

  panel.append(status, skor, key);

  if (hasil.rincian.length) {
    const ul = document.createElement("ul");
    ul.style.paddingLeft = "20px";
    hasil.rincian.forEach((item, i) => {
      const li = document.createElement("li");
      li.textContent = `${i + 1}. ${item.benar ? "Benar" : "Belum tepat"} — ` +
        `${item.teks} | Jawaban: ${item.jawaban || "Belum dijawab"} | ` +
        `Kunci: ${item.kunci}`;
      ul.appendChild(li);
    });
    panel.appendChild(ul);
  }

  const explanation = document.createElement("p");
  explanation.textContent = `Pembahasan: ${soal.pembahasan}`;
  explanation.style.marginBottom = "0";
  panel.appendChild(explanation);

  // Jawaban dikunci setelah dinilai agar umpan balik tidak berubah.
  card.querySelectorAll("input, select, textarea").forEach(control => {
    control.disabled = true;
  });
  card.querySelectorAll(".matching-left-item, .matching-right-item").forEach(button => {
    button.disabled = true;
  });
}

el.submit.addEventListener("click", () => {
  const kosong = soalAktif.length - Number((el.progressLabel.textContent.match(/^(\d+)/)||[0,0])[1]);
  const pesan = kosong
    ? `Masih ada ${kosong} soal yang belum dijawab. Tetap selesaikan latihan?`
    : "Yakin ingin menyelesaikan latihan dan mengirim jawaban?";
  if (confirm(pesan)) selesaikanLatihan(false);
});

function normalisasiJawabanTeks(teks) {
  return String(teks ?? "").toLocaleLowerCase("id-ID")
    .normalize("NFKD").replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, " ").trim().replace(/\s+/g, " ");
}

function parseJawabanAngka(teks) {
  const s = String(teks ?? '').trim().replace(/\s+/g, '');
  if (!s) return null;
  // Fraction: -3/4, 3/4, or mixed number 1 1/2 (spaces removed above -> 11/2 is ambiguous; mixed input should use 1+1/2).
  const pecahan = s.match(/^([+-]?\d+)\/([+-]?\d+)$/);
  if (pecahan) {
    const pembilang = Number(pecahan[1]), penyebut = Number(pecahan[2]);
    if (!Number.isFinite(pembilang) || !Number.isFinite(penyebut) || penyebut === 0) return null;
    return pembilang / penyebut;
  }
  const campuran = s.match(/^([+-]?\d+)\+(\d+)\/(\d+)$/);
  if (campuran) {
    const utuh = Number(campuran[1]), pembilang = Number(campuran[2]), penyebut = Number(campuran[3]);
    if (!Number.isFinite(utuh) || !Number.isFinite(pembilang) || !Number.isFinite(penyebut) || penyebut === 0) return null;
    return utuh < 0 ? utuh - pembilang / penyebut : utuh + pembilang / penyebut;
  }
  // Koma dan titik diterima sebagai tanda desimal.
  const normalized = s.replace(',', '.');
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(normalized)) return null;
  const value = Number(normalized);
  return Number.isFinite(value) ? value : null;
}

function selesaikanLatihan(otomatis) {
  if (latihanSelesai) return;
  latihanSelesai = true;
  clearInterval(intervalTimer);
  if (kunciTimerSimulasi) {
    localStorage.removeItem(kunciTimerSimulasi);
    kunciTimerSimulasi = null;
  }

  let totalBenar = 0;
  const bobotSoal = (soal) => ({
    pilihan_ganda: 2,
    pilihan_ganda_kompleks: 6,
    benar_salah: 6,
    menjodohkan: 4,
    isian_angka: 5,
    isian: Number(soal.skorMaksimal) || 5,
    uraian: Number(soal.skorMaksimal) || 5
  }[soal.jenis] ?? 0);

  const hasilSoal = soalAktif.map((soal, index) => {
    const card = el.questionList.children[index];
    let jawabanRaw = "";
    let benar = false;
    let skor = 0;
    let dinilaiManual = false;
    const skorMaksimalSoal = bobotSoal(soal);

    if (soal.jenis === "pilihan_ganda") {
      const v = card.querySelector("input:checked")?.value || "";
      jawabanRaw = v;
      benar = v === soal.kunci;
      skor = benar ? 2 : 0;
    } else if (soal.jenis === "pilihan_ganda_kompleks") {
      const v = [...card.querySelectorAll("input:checked")].map(x => x.value).sort();
      const kunci = [...soal.kunci].sort();
      jawabanRaw = v.join(", ");
      // PG kompleks wajib memilih tepat tiga opsi. Setiap opsi kunci yang dipilih bernilai 2 poin.
      if (v.length === 3) skor = v.filter(x => kunci.includes(x)).length * 2;
      benar = v.length === 3 && skor === 6;
    } else if (soal.jenis === "benar_salah") {
      const v = soal.pernyataan.map((_, pi) => card.querySelector(`input[data-sub="${pi}"]:checked`)?.value || "");
      jawabanRaw = v.map(x => x || "-").join(", ");
      skor = v.reduce((sum, x, i) => sum + (x && x === soal.kunci[i] ? 2 : 0), 0);
      benar = v.length === soal.kunci.length && v.every((x, i) => x === soal.kunci[i]);
    } else if (soal.jenis === "menjodohkan") {
      const v = [...card.querySelectorAll("select")].map(x => x.value);
      jawabanRaw = v.map((x, i) => `${i + 1}-${x || "-"}`).join(", ");
      const tidakDuplikat = new Set(v.filter(Boolean)).size === v.filter(Boolean).length;
      skor = tidakDuplikat ? v.reduce((sum, x, i) => sum + (x && x === soal.kunci[i] ? 1 : 0), 0) : 0;
      benar = v.length === soal.kunci.length && skor === 4;
    } else if (soal.jenis === "isian_angka") {
      const input = card.querySelector(".answer-input");
      jawabanRaw = input?.value.trim() || "";
      const val = parseJawabanAngka(jawabanRaw);
      const kunci = Number(soal.kunci);
      benar = val !== null && Number.isFinite(kunci) && Math.abs(val - kunci) < 0.00005;
      skor = benar ? 5 : 0;
    } else if (soal.jenis === "isian") {
      jawabanRaw = card.querySelector(".answer-input")?.value.trim() || "";
      const jawaban = normalisasiJawabanTeks(jawabanRaw);
      const kataKunci = (Array.isArray(soal.kataKunci) ? soal.kataKunci : [soal.kunci]).map(normalisasiJawabanTeks).filter(Boolean);
      benar = kataKunci.length > 0 && kataKunci.every(k => jawaban.includes(k));
      skor = benar ? (Number(soal.skorMaksimal) || 5) : 0;
    } else if (soal.jenis === "uraian") {
      jawabanRaw = card.querySelector(".answer-input")?.value.trim() || "";
      const maksimal = Number(soal.skorMaksimal) || 5;
      if (jawabanRaw && !otomatis) {
        const rubrik = Array.isArray(soal.rubrik) ? `\n\nRubrik penilaian:\n${soal.rubrik.map((r, i) => `${i + 1}. ${r}`).join("\n")}` : "";
        const masukan = prompt(`PENILAIAN GURU — Soal ${index + 1}\n\nJawaban murid: ${jawabanRaw}\n\nKunci/pedoman: ${soal.kunci}${rubrik}\n\nMasukkan skor 0 sampai ${maksimal}. Kosongkan jika belum dinilai:`, "");
        if (masukan !== null && masukan.trim() !== "" && Number.isFinite(Number(masukan))) {
          skor = Math.max(0, Math.min(maksimal, Number(masukan)));
          benar = skor >= maksimal;
          dinilaiManual = true;
        }
      }
    }
    if (benar) totalBenar++;
    return { soal, jawabanRaw, benar, skor, skorMaksimalSoal, dinilaiManual, perluPenilaian: soal.jenis === "uraian" && !!jawabanRaw && !dinilaiManual };
  });

  const soalBelumDinilai = hasilSoal.filter(item => item.perluPenilaian).length;
  const skorMaksimal = hasilSoal.reduce((sum, item) => sum + (item.perluPenilaian ? 0 : item.skorMaksimalSoal), 0);
  const skorDiperoleh = hasilSoal.reduce((sum, item) => sum + item.skor, 0);
  const nilai = skorMaksimal ? Math.round((skorDiperoleh / skorMaksimal) * 100) : 0;
  const catatan = {
    idPercobaan: `TRY-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    tanggal: new Date().toISOString(),
    nama: muridTerpilih.nama,
    nomorAbsen: muridTerpilih.nomorAbsen,
    kelas: "VI",
    mataPelajaran: bankAktif.mataPelajaran,
    modo: modeBankAktif,
    materi: namaMateriAktif,
    paket: bankAktif.paket,
    judul: bankAktif.judul,
    nilai, totalBenar, jumlahSoal: soalAktif.length,
    skorDiperoleh, skorMaksimal, soalBelumDinilai,
    otomatis
  };

  // Rekap skor per jenis soal untuk spreadsheet.
  const skorPerJenis = {
    pilihan_ganda: 0,
    benar_salah: 0,
    menjodohkan: 0,
    pilihan_ganda_kompleks: 0
  };
  hasilSoal.forEach(item => {
    if (Object.prototype.hasOwnProperty.call(skorPerJenis, item.soal.jenis)) {
      skorPerJenis[item.soal.jenis] += item.skor;
    }
  });

  // Hanya hasil Simulasi ASAS yang dikirim ke Google Sheets.
  if (modeBankAktif === "Simulasi ASAS") {
    const payloadSheets = {
      modo: "Simulasi ASAS",
      idPercobaan: catatan.idPercobaan,
      tanggal: catatan.tanggal,
      nama: muridTerpilih.nama,
      absen: muridTerpilih.nomorAbsen,
      kelas: "VI",
      mataPelajaran: bankAktif.mataPelajaran || daftarMapel[mapelTerpilih] || mapelTerpilih,
      paket: `Simulasi ${bankAktif.paket || paketTerpilih || "1"}`,
      jumlahSoal: soalAktif.length,
      nilaiAkhir: nilai,
      skorDiperoleh,
      skorMaksimal,
      skorPG: skorPerJenis.pilihan_ganda,
      skorBenarSalah: skorPerJenis.benar_salah,
      skorMenjodohkan: skorPerJenis.menjodohkan,
      skorPGKompleks: skorPerJenis.pilihan_ganda_kompleks,
      jumlahBenar: totalBenar,
      durasi: waktuMulaiSimulasi ? Math.max(0, Math.round((Date.now() - waktuMulaiSimulasi) / 1000)) : 0,
      peringatanPindahTab: jumlahPeringatanPindahTab
    };
    // Kirim hanya hasil Simulasi ASAS. Gunakan payload text/plain agar
    // browser tidak melakukan preflight CORS ke Google Apps Script.
    // keepalive membantu pengiriman tetap berjalan saat tampilan hasil dirender.
    try {
      fetch(GOOGLE_SHEETS_API_URL, {
        method: "POST",
        mode: "no-cors",
        credentials: "omit",
        keepalive: true,
        headers: { "Content-Type": "text/plain;charset=UTF-8" },
        body: JSON.stringify(payloadSheets)
      }).catch(error => {
        console.error("Pengiriman nilai Simulasi ASAS gagal:", error);
        try {
          localStorage.setItem("ruangBelajarPengirimanTertunda", JSON.stringify(payloadSheets));
        } catch (storageError) {
          console.error("Payload gagal disimpan sementara:", storageError);
        }
      });
    } catch (error) {
      console.error("Pengiriman nilai Simulasi ASAS gagal dimulai:", error);
      try {
        localStorage.setItem("ruangBelajarPengirimanTertunda", JSON.stringify(payloadSheets));
      } catch (storageError) {
        console.error("Payload gagal disimpan sementara:", storageError);
      }
    }
  }

  simpanRiwayat(catatan);
  tampilkanHasil(catatan, hasilSoal);
}

function tampilkanHasil(catatan, hasilSoal) {
  el.quiz.hidden = true;
  el.result.hidden = false;
  el.finalScore.textContent = String(catatan.nilai);
  const pesanSemangat = catatan.nilai >= 90
    ? "Hebat! Pemahamanmu sangat baik. Pertahankan semangat belajarmu!"
    : catatan.nilai >= 75
      ? "Bagus! Terus berlatih agar pemahamanmu semakin kuat."
      : catatan.nilai >= 60
        ? "Usahamu sudah baik. Baca pembahasan dan coba berlatih kembali."
        : "Tidak apa-apa jika belum tepat. Pelajari pembahasan, lalu coba lagi. Kamu pasti bisa berkembang!";
  el.scoreDetail.textContent = `${catatan.totalBenar} benar dari ${catatan.jumlahSoal} soal • ${catatan.skorDiperoleh}/${catatan.skorMaksimal} poin.${catatan.soalBelumDinilai ? ` Ada ${catatan.soalBelumDinilai} jawaban uraian yang belum dinilai guru; nilai ini sementara.` : ""} ${pesanSemangat}`;
  el.resultIdentity.textContent = `${catatan.nama} • Absen ${String(catatan.nomorAbsen).padStart(2,"0")} • ${catatan.mataPelajaran} • ${catatan.modo || "Latihan"} • Paket ${catatan.paket}`;
  el.reviewList.innerHTML = "";

  hasilSoal.forEach((item, index) => {
    const card = document.createElement("article");
    const belumDinilai = item.perluPenilaian;
    const status = belumDinilai ? "review-pending" : item.benar ? "review-correct" : item.skor > 0 ? "review-partial" : "review-wrong";
    card.className = `review-card ${status}`;
    const title = document.createElement("h4");
    title.textContent = `Soal ${index + 1} — ${belumDinilai ? "Menunggu penilaian guru" : item.benar ? "Benar" : item.skor > 0 ? "Sebagian benar" : "Belum tepat"} (${item.skor}/${item.skorMaksimalSoal} poin)`;
    const prompt = document.createElement("p");
    prompt.innerHTML = formatTeksMatematika(item.soal.pertanyaan);
    const answer = document.createElement("p");
    answer.textContent = `Jawaban kamu: ${item.jawabanRaw === "" ? "Tidak dijawab" : item.jawabanRaw}`;
    const key = document.createElement("p");
    key.textContent = `Kunci jawaban: ${Array.isArray(item.soal.kunci) ? item.soal.kunci.join(", ") : String(item.soal.kunci).replace(".", ",")}`;
    const explanation = document.createElement("p");
    explanation.className = "explanation";
    explanation.textContent = `Pembahasan: ${item.soal.pembahasan}`;
    card.append(title, prompt, answer, key, explanation);
    el.reviewList.appendChild(card);
  });
  el.result.scrollIntoView({behavior: "smooth", block: "start"});
}

function bacaRiwayat() {
  try {
    const data = JSON.parse(localStorage.getItem("kuisDigitalRiwayatV2") || "[]");
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.warn("Riwayat tersimpan tidak dapat dibaca.", error);
    return [];
  }
}

function simpanRiwayat(catatan) {
  const key = "kuisDigitalRiwayatV2";
  try {
    const riwayat = bacaRiwayat();
    riwayat.unshift(catatan);
    // Simpan paling banyak 100 hasil terbaru agar penyimpanan browser tetap ringan.
    localStorage.setItem(key, JSON.stringify(riwayat.slice(0, 100)));
  } catch (error) {
    alert("Nilai berhasil dihitung, tetapi riwayat tidak dapat disimpan pada perangkat ini. Periksa pengaturan penyimpanan browser.");
    console.warn("Gagal menyimpan riwayat.", error);
  }
}

$("backToHome").addEventListener("click", () => {
  el.result.hidden = true;
  el.action.hidden = false;
  el.action.scrollIntoView({behavior: "smooth", block: "start"});
});

$("cancelQuiz").addEventListener("click", () => {
  const yakin = confirm("Batalkan pengerjaan? Jawaban yang sudah diisi tidak akan disimpan.");
  if (!yakin) return;

  clearInterval(intervalTimer);
  intervalTimer = null;
  if (kunciTimerSimulasi) {
    localStorage.removeItem(kunciTimerSimulasi);
    kunciTimerSimulasi = null;
  }

  latihanSelesai = true;
  el.quiz.hidden = true;
  el.result.hidden = true;

  if (modeBankAktif === "Simulasi ASAS") {
    asasPackageSection.hidden = false;
    asasPackageSection.scrollIntoView({behavior:"smooth",block:"start"});
  } else {
    assessmentPackageSection.hidden = false;
    assessmentPackageSection.scrollIntoView({behavior:"smooth",block:"start"});
  }

  bankAktif = null;
  soalAktif = [];
  nomorSoalAktif = 0;
});

$("openHistoryFeature").addEventListener("click", () => {
  if (!muridTerpilih) {
    alert("Silakan login terlebih dahulu untuk membuka riwayat nilai.");
    return;
  }
  sembunyikanSemuaPanelPembelajaran();
  $("historySection").hidden = false;
  $("historyContent").hidden = true;
  $("clearHistoryButton").hidden = true;
  $("historyContent").innerHTML = "";
  $("historySection").scrollIntoView({behavior:"smooth", block:"start"});
});

$("backFromHistory").addEventListener("click", () => {
  $("historySection").hidden = true;
  kembaliKeBerandaUtama();
});

$("historyButton").addEventListener("click", () => {
  if (!muridTerpilih) {
    alert("Silakan pilih nama kamu terlebih dahulu agar hasil latihan tercatat dengan benar.");
    el.nama.focus();
    return;
  }
  const riwayat = bacaRiwayat()
    .filter(item => item.nomorAbsen === muridTerpilih.nomorAbsen);
  el.historyContent.hidden = false;
  $("clearHistoryButton").hidden = riwayat.length === 0;
  el.historyContent.innerHTML = "";
  if (!riwayat.length) {
    el.historyContent.textContent = "Belum ada riwayat latihan pada perangkat ini.";
    return;
  }
  riwayat.forEach(item => {
    const row = document.createElement("div");
    row.className = "history-row";
    const date = new Date(item.tanggal).toLocaleString("id-ID");
    row.textContent = `${date} — ${item.mataPelajaran} • ${item.modo || "Latihan"} • Paket ${item.paket}: nilai ${item.nilai}`;
    el.historyContent.appendChild(row);
  });
});

$("clearHistoryButton").addEventListener("click", () => {
  if (!muridTerpilih) return;
  const yakin = confirm("Hapus semua riwayat latihan milik nama yang sedang dipilih dari perangkat ini? Tindakan ini tidak dapat dibatalkan.");
  if (!yakin) return;
  const tersisa = bacaRiwayat().filter(item => item.nomorAbsen !== muridTerpilih.nomorAbsen);
  try {
    localStorage.setItem("kuisDigitalRiwayatV2", JSON.stringify(tersisa));
    el.historyContent.textContent = "Riwayat latihan untuk nama ini sudah dihapus dari perangkat ini.";
    $("clearHistoryButton").hidden = true;
  } catch (error) {
    alert("Riwayat belum dapat dihapus. Silakan periksa pengaturan browser.");
  }
});

muatDaftarMurid();

// LOGIN SEDERHANA V8: password = nama depan + nomor urut dua digit.
// Contoh: ADELIA FARANISA AZNI (absen 1) -> ADELIA01.
(() => {
  const loginCard = document.getElementById("identitySection");
  const appContent = document.getElementById("appContent");
  const passwordInput = document.getElementById("passwordMurid");
  const togglePassword = document.getElementById("togglePassword");
  togglePassword.addEventListener("click", () => {
    const isHidden = passwordInput.type === "password";
    passwordInput.type = isHidden ? "text" : "password";
    togglePassword.setAttribute("aria-label", isHidden ? "Sembunyikan password" : "Lihat password");
    togglePassword.setAttribute("title", isHidden ? "Sembunyikan password" : "Lihat password");
    togglePassword.innerHTML = isHidden
      ? '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 3l18 18M10.6 10.6a2 2 0 002.8 2.8M9.9 5.2A10.8 10.8 0 0112 5c5 0 9 4.5 10 7-.4 1.1-1.4 2.6-3 3.9M6.2 6.2C3.9 7.7 2.5 10 2 12c1 2.5 5 7 10 7 1.2 0 2.3-.2 3.3-.6"/></svg>'
      : '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/></svg>';
  });
  const loginButton = document.getElementById("loginButton");
  const loginError = document.getElementById("loginError");
  const sessionStrip = document.getElementById("sessionStrip");
  const activeStudentLabel = document.getElementById("activeStudentLabel");
  const logoutButton = document.getElementById("logoutButton");

  function passwordSiswa(nama, nomor) {
    const namaDepan = nama.trim().split(/\s+/)[0]
      .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
      .replace(/[^A-Za-z0-9]/g, "").toUpperCase();
    return namaDepan + String(nomor).padStart(2, "0");
  }

  function perbaruiTombolLogin() {
    loginButton.disabled = !(el.nama.value && passwordInput.value.trim());
    loginError.hidden = true;
  }

  el.nama.addEventListener("change", perbaruiTombolLogin);
  passwordInput.addEventListener("input", perbaruiTombolLogin);

  loginButton.addEventListener("click", () => {
    const nomor = Number(el.nama.value);
    if (!nomor || !daftarMurid[nomor - 1]) {
      loginError.textContent = "Silakan pilih nama siswa terlebih dahulu.";
      loginError.hidden = false;
      return;
    }
    const nama = daftarMurid[nomor - 1];
    const passwordBenar = passwordSiswa(nama, nomor);
    if (passwordInput.value.trim().toUpperCase() !== passwordBenar) {
      loginError.textContent = "Password belum tepat. Periksa kembali nama dan nomor urut kamu.";
      loginError.hidden = false;
      passwordInput.focus();
      return;
    }
    muridTerpilih = { nama, nomorAbsen: nomor, kelas: "VI" };
    el.absen.value = String(nomor).padStart(2, "0");
    loginCard.hidden = true;
    appContent.hidden = false;
    sessionStrip.hidden = false;
    activeStudentLabel.textContent = `${nama} • Absen ${String(nomor).padStart(2, "0")} • Kelas VI`;
    sembunyikanSemuaPanelPembelajaran();
    document.getElementById("mainHomeSection").hidden = false;
    window.scrollTo({top: 0, behavior: "smooth"});
  });

  logoutButton.addEventListener("click", () => {
    if (!confirm("Keluar dari akun siswa ini?")) return;
    appContent.hidden = true;
    loginCard.hidden = false;
    sessionStrip.hidden = true;
    el.nama.value = "";
    el.absen.value = "";
    passwordInput.value = "";
    muridTerpilih = null;
    mapelTerpilih = null;
    document.querySelectorAll(".subject-button").forEach(button => button.classList.remove("active"));
    sembunyikanSemuaPanelPembelajaran();
    document.getElementById("mainHomeSection").hidden = false;
    loginButton.disabled = true;
    loginError.hidden = true;
    window.scrollTo({top: 0, behavior: "smooth"});
  });

  // Saat kembali dari halaman Bahasa Inggris, pulihkan sesi tab ini
  // dan tampilkan langsung daftar mata pelajaran Semester 1.
  const params = new URLSearchParams(window.location.search);
  let sesiKembali = null;
  if (params.get("return") === "semester1") {
    try {
      sesiKembali = JSON.parse(sessionStorage.getItem("ruangBelajarSiswaSemester1") || "null");
    } catch (_) {
      sesiKembali = null;
    }
  }

  if (sesiKembali && sesiKembali.nama && sesiKembali.nomorAbsen) {
    muridTerpilih = sesiKembali;
    loginCard.hidden = true;
    appContent.hidden = false;
    sessionStrip.hidden = false;
    activeStudentLabel.textContent = `${sesiKembali.nama} • Absen ${String(sesiKembali.nomorAbsen).padStart(2, "0")} • Kelas VI`;
    sembunyikanSemuaPanelPembelajaran();
    mainHomeSection.hidden = true;
    subjectSection.hidden = false;
    document.querySelectorAll(".subject-button").forEach(button => button.classList.remove("active"));
    sessionStorage.removeItem("ruangBelajarSiswaSemester1");
    history.replaceState({}, "", window.location.pathname);
    requestAnimationFrame(() => subjectSection.scrollIntoView({behavior: "auto", block: "start"}));
  } else {
    // Semua konten pembelajaran tertutup sampai login berhasil.
    appContent.hidden = true;
    sessionStrip.hidden = true;
    loginCard.hidden = false;
  }
})();
console.log("Kuis Digital Kelas VI V2 siap. Mesin Paket 1–6 Matematika aktif.");


/* ===== Navigasi BELAJAR TKA: fitur terpisah dari mesin 8 mapel lama ===== */
(() => {
  const subjectMenu = document.getElementById("mainHomeSection");
  const tkaSubject = document.getElementById("tkaSubjectSection");
  const tkaSession = document.getElementById("tkaSessionSection");
  const tkaPackage = document.getElementById("tkaPackageSection");
  if (!subjectMenu || !tkaSubject || !tkaSession || !tkaPackage) return;

  let tkaMapel = "";
  let tkaSesi = "";

  const scrollToSection = section => section.scrollIntoView({behavior:"smooth", block:"start"});

  const tkaSubjectSelect = document.getElementById("tkaSubjectSelect");
  const confirmTkaSubject = document.getElementById("confirmTkaSubject");
  tkaSubjectSelect.addEventListener("change", () => {
    confirmTkaSubject.disabled = !tkaSubjectSelect.value;
  });
  confirmTkaSubject.addEventListener("click", () => {
    tkaMapel = tkaSubjectSelect.value;
    if (!tkaMapel) return;
    document.getElementById("tkaSelectedSubject").textContent =
      tkaMapel === "matematika" ? "Matematika" : "Bahasa Indonesia";
    tkaSubject.hidden = true;
    tkaSession.hidden = false;
    scrollToSection(tkaSession);
  });

  function tampilkanPaketTka(sesi) {
    tkaSesi = sesi;
    const namaMapel = tkaMapel === "matematika" ? "Matematika" : "Bahasa Indonesia";
    const namaSesi = sesi === "latihan" ? "Latihan" : "Simulasi";
    document.getElementById("tkaPackageTitle").textContent = `Paket ${namaSesi} ${namaMapel}`;
    document.getElementById("tkaPackageKicker").textContent =
      `BELAJAR TKA • ${namaMapel.toUpperCase()} • ${namaSesi.toUpperCase()}`;

    const grid = document.getElementById("tkaPackageGrid");
    grid.innerHTML = "";
    for (let nomor = 1; nomor <= 5; nomor++) {
      const tombol = document.createElement("button");
      tombol.type = "button";
      tombol.textContent = `PAKET ${nomor}`;
      tombol.disabled = true;
      tombol.title = "Bank soal belum diaktifkan";
      grid.appendChild(tombol);
    }

    document.getElementById("tkaPreparingMessage").textContent =
      `Paket ${namaMapel} untuk sesi ${namaSesi} belum tersedia. Paket akan dibuka setelah soal, kunci jawaban, dan pembahasannya selesai diperiksa. Silakan gunakan mata pelajaran lain terlebih dahulu.`;

    tkaSession.hidden = true;
    tkaPackage.hidden = false;
    scrollToSection(tkaPackage);
  }

  document.getElementById("tkaPracticeButton").addEventListener("click", () => tampilkanPaketTka("latihan"));
  document.getElementById("tkaSimulationButton").addEventListener("click", () => tampilkanPaketTka("simulasi"));

  document.getElementById("closeTkaSubject").addEventListener("click", () => {
    tkaSubject.hidden = true;
    subjectMenu.hidden = false;
    scrollToSection(subjectMenu);
  });
  document.getElementById("backTkaToSubject").addEventListener("click", () => {
    tkaSession.hidden = true;
    tkaSubject.hidden = false;
    tkaSubjectSelect.value = tkaMapel;
    confirmTkaSubject.disabled = !tkaSubjectSelect.value;
    scrollToSection(tkaSubject);
  });
  document.getElementById("backTkaToSession").addEventListener("click", () => {
    tkaPackage.hidden = true;
    tkaSession.hidden = false;
    scrollToSection(tkaSession);
  });
})();
