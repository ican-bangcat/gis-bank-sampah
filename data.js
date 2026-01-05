import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// =====================================================
// SUPABASE CONFIGURATION
// =====================================================
const SUPABASE_URL = "https://mekbftnxhxuwxkdclrkq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1la2JmdG54aHh1d3hrZGNscmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTUzMjUsImV4cCI6MjA4MjAzMTMyNX0.9k4GZLLJQ5Y06Q5NAAhiegmCBZDZs0LhlhNo5ovEsRE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// =====================================================
// STATE MANAGEMENT
// =====================================================
let allData = [];
let filteredData = [];
// TAMBAHKAN INI (Pagination state)
let currentPage = 1;
let entriesPerPage = 10; // Default 10 data

// =====================================================
// DOM ELEMENTS
// =====================================================
const searchBox = document.getElementById("search-box");
const kecamatanFilter = document.getElementById("kecamatan-filter");
const dataTbody = document.getElementById("data-tbody");
const loadingEl = document.getElementById("loading");
const tableContainer = document.getElementById("table-container");
const noDataEl = document.getElementById("no-data");
const btnReset = document.getElementById("btn-reset");
const statTotal = document.getElementById("stat-total");
const statFiltered = document.getElementById("stat-filtered");

// Checkboxes
const filterKertas = document.getElementById("filter-kertas");
const filterPlastik = document.getElementById("filter-plastik");
const filterBesi = document.getElementById("filter-besi");
const filterKaca = document.getElementById("filter-kaca");
const filterLogam = document.getElementById("filter-logam");

// =====================================================
// LOAD DATA FROM SUPABASE
// =====================================================
async function loadData() {
  try {
    const { data, error } = await supabase.from("BankSampah").select("*");

    if (error) {
      console.error("❌ Error loading data:", error.message);
      showError("Gagal memuat data dari server");
      return;
    }

    // Transform data (JANGAN swap lagi!)
    allData = data.map((item) => ({
      No: item.No,
      Nama: item.Nama || item.nama_bank_sampah || "N/A",
      Kecamatan: item.Kecamatan || "N/A",
      Kertas: parseInt(item.Kertas || 0),
      Plastik: parseInt(item.Plastik || 0),
      Besi: parseInt(item.Besi || 0),
      Kaca: parseInt(item.Kaca || 0),
      Logam: parseInt(item.Logam || 0),
      Volume_Sampah_kg_per_minggu: parseFloat(
        item["Volume Sampah (per minggu/kg)"] || item.volume || 0
      ),
      Jumlah_Anggota: parseInt(item.Jumlah_Anggota || 0),

      // ✅ PERBAIKAN: Ambil langsung sesuai nama kolom
      latitude: parseFloat(item.latitude || 0), // 0.58... ✅
      longitude: parseFloat(item.longitude || 0), // 101.42... ✅
    }));

    filteredData = [...allData];

    console.log(`✅ Loaded ${allData.length} records`);

    populateKecamatanDropdown();
    renderTable();
    updateStats();

    loadingEl.style.display = "none";
    tableContainer.style.display = "block";
  } catch (err) {
    console.error("Error:", err);
    showError("Terjadi kesalahan saat memuat data");
  }
}

// =====================================================
// POPULATE KECAMATAN DROPDOWN
// =====================================================
function populateKecamatanDropdown() {
  const kecamatanSet = new Set();
  allData.forEach((item) => {
    if (item.Kecamatan && item.Kecamatan !== "N/A") {
      kecamatanSet.add(item.Kecamatan);
    }
  });

  const sortedKecamatan = Array.from(kecamatanSet).sort();

  kecamatanFilter.innerHTML = '<option value="">Semua Kecamatan</option>';
  sortedKecamatan.forEach((kec) => {
    const option = document.createElement("option");
    option.value = kec;
    option.textContent = kec;
    kecamatanFilter.appendChild(option);
  });
}

// =====================================================
// RENDER TABLE (WITH PAGINATION)
// =====================================================
function renderTable() {
  if (filteredData.length === 0) {
    dataTbody.innerHTML = "";
    noDataEl.style.display = "block";
    updatePaginationInfo(0, 0, 0);
    return;
  }

  noDataEl.style.display = "none";

  // Hitung data yang ditampilkan
  const totalEntries = filteredData.length;
  const startIndex = (currentPage - 1) * entriesPerPage;
  const endIndex = entriesPerPage === -1 ? totalEntries : Math.min(startIndex + entriesPerPage, totalEntries);
  
  const dataToShow = entriesPerPage === -1 
    ? filteredData 
    : filteredData.slice(startIndex, endIndex);

  dataTbody.innerHTML = dataToShow
    .map((item, index) => {
      const actualIndex = startIndex + index + 1; // Nomor urut asli
      
      const jenisBadges = [];
      if (item.Kertas === 1) jenisBadges.push('<span class="badge-jenis badge-kertas">Kertas</span>');
      if (item.Plastik === 1) jenisBadges.push('<span class="badge-jenis badge-plastik">Plastik</span>');
      if (item.Besi === 1) jenisBadges.push('<span class="badge-jenis badge-besi">Besi</span>');
      if (item.Kaca === 1) jenisBadges.push('<span class="badge-jenis badge-kaca">Kaca</span>');
      if (item.Logam === 1) jenisBadges.push('<span class="badge-jenis badge-logam">Logam</span>');

      const jenisBadgesHTML = jenisBadges.length > 0 ? jenisBadges.join(" ") : '<span class="text-muted">-</span>';

      return `
        <tr>
          <td>${actualIndex}</td>
          <td><strong>${item.Nama}</strong></td>
          <td>${item.Kecamatan}</td>
          <td>${jenisBadgesHTML}</td>
          <td>${item.Volume_Sampah_kg_per_minggu.toLocaleString()}</td>
          <td>${item.Jumlah_Anggota.toLocaleString()}</td>
          <td>
            <a href="map.html?lat=${item.latitude}&lng=${item.longitude}&zoom=18&name=${encodeURIComponent(item.Nama)}" 
               class="btn-map" 
               title="Lihat di peta">
              <i class="fas fa-map-marker-alt"></i> Peta
            </a>
          </td>
        </tr>
      `;
    })
    .join("");

  updatePaginationInfo(startIndex + 1, endIndex, totalEntries);
}

// =====================================================
// UPDATE PAGINATION INFO
// =====================================================
function updatePaginationInfo(start, end, total) {
  document.getElementById("showing-start").textContent = start;
  document.getElementById("showing-end").textContent = end;
  document.getElementById("showing-total").textContent = total;
}

// =====================================================
// UPDATE STATISTICS
// =====================================================
function updateStats() {
  statTotal.textContent = allData.length;
  statFiltered.textContent = filteredData.length;
}

// =====================================================
// APPLY FILTERS
// =====================================================
function applyFilters() {
  const searchTerm = searchBox.value.toLowerCase().trim();
  const selectedKecamatan = kecamatanFilter.value;

  const checkedJenis = {
    Kertas: filterKertas.checked,
    Plastik: filterPlastik.checked,
    Besi: filterBesi.checked,
    Kaca: filterKaca.checked,
    Logam: filterLogam.checked,
  };

  // Cek apakah ada checkbox yang dicentang
  const anyJenisChecked = Object.values(checkedJenis).some((v) => v);

  filteredData = allData.filter((item) => {
    // Filter: Search by name
    const matchesSearch = item.Nama.toLowerCase().includes(searchTerm);

    // Filter: Kecamatan
    const matchesKecamatan =
      !selectedKecamatan || item.Kecamatan === selectedKecamatan;

    // Filter: Jenis Sampah
    let matchesJenis = true;
    if (anyJenisChecked) {
      matchesJenis =
        (checkedJenis.Kertas && item.Kertas === 1) ||
        (checkedJenis.Plastik && item.Plastik === 1) ||
        (checkedJenis.Besi && item.Besi === 1) ||
        (checkedJenis.Kaca && item.Kaca === 1) ||
        (checkedJenis.Logam && item.Logam === 1);
    }

    return matchesSearch && matchesKecamatan && matchesJenis;
  });

  renderTable();
  updateStats();
}

// =====================================================
// RESET FILTERS
// =====================================================
function resetFilters() {
  searchBox.value = "";
  kecamatanFilter.value = "";
  filterKertas.checked = true;
  filterPlastik.checked = true;
  filterBesi.checked = true;
  filterKaca.checked = true;
  filterLogam.checked = true;

  filteredData = [...allData];
  renderTable();
  updateStats();
}

// =====================================================
// ERROR HANDLING
// =====================================================
function showError(message) {
  loadingEl.innerHTML = `
    <i class="fas fa-exclamation-triangle fa-3x" style="color: #e74c3c;"></i>
    <p class="mt-3">${message}</p>
  `;
}

// =====================================================
// EVENT LISTENERS
// =====================================================
searchBox.addEventListener("input", applyFilters);
kecamatanFilter.addEventListener("change", applyFilters);
filterKertas.addEventListener("change", applyFilters);
filterPlastik.addEventListener("change", applyFilters);
filterBesi.addEventListener("change", applyFilters);
filterKaca.addEventListener("change", applyFilters);
filterLogam.addEventListener("change", applyFilters);
btnReset.addEventListener("click", resetFilters);

// =====================================================
// EVENT LISTENERS (TAMBAHKAN INI DI AKHIR)
// =====================================================

// Dropdown entries per page
const entriesDropdown = document.getElementById("entries-per-page");
if (entriesDropdown) {
  entriesDropdown.addEventListener("change", function () {
    entriesPerPage = parseInt(this.value);
    currentPage = 1; // Reset ke halaman pertama
    renderTable();
  });
}
// =====================================================
// INITIALIZE
// =====================================================
loadData();
