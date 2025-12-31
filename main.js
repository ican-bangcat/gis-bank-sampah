import "./style.css";
import { Map, View } from "ol";
import TileLayer from "ol/layer/Tile";
import OSM from "ol/source/OSM";
import XYZ from "ol/source/XYZ";
import VectorLayer from "ol/layer/Vector";
import { Vector as VectorSource } from "ol/source.js";
import GeoJSON from "ol/format/GeoJSON.js";
import { fromLonLat } from "ol/proj.js";
import {
  Icon,
  Style,
  Fill,
  Stroke,
  Circle as CircleStyle,
  Text,
} from "ol/style.js";
import Overlay from "ol/Overlay.js";
import Feature from "ol/Feature.js";
import { Point, Circle as CircleGeom } from "ol/geom.js";
import { createClient } from "@supabase/supabase-js";

// =====================================================
// SUPABASE CONFIGURATION
// =====================================================
const SUPABASE_URL = "https://mekbftnxhxuwxkdclrkq.supabase.co";
const SUPABASE_ANON_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1la2JmdG54aHh1d3hrZGNscmtxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjY0NTUzMjUsImV4cCI6MjA4MjAzMTMyNX0.9k4GZLLJQ5Y06Q5NAAhiegmCBZDZs0LhlhNo5ovEsRE";

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// Setup popup overlay
const container = document.getElementById("popup");
const content_element = document.getElementById("popup-content");
const closer = document.getElementById("popup-closer");

const overlay = new Overlay({
  element: container,
  autoPan: { animation: { duration: 250 } },
});

// Format GeoJSON dengan transform 4326 -> 3857
const geojsonFormat = new GeoJSON({
  dataProjection: "EPSG:4326",
  featureProjection: "EPSG:3857",
});

// =====================================================
// BASEMAP LAYERS
// =====================================================

const osmStandard = new TileLayer({
  source: new OSM(),
  visible: false,
  title: "OSM Standard",
});

const esriSatellite = new TileLayer({
  source: new XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attributions: "Tiles © Esri",
  }),
  visible: true,
  title: "Satellite",
});

const esriTopo = new TileLayer({
  source: new XYZ({
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attributions: "Tiles © Esri",
  }),
  visible: false,
  title: "Topo Map",
});

const openTopoMap = new TileLayer({
  source: new XYZ({
    url: "https://{a-c}.tile.opentopomap.org/{z}/{x}/{y}.png",
    attributions: "© OpenTopoMap",
  }),
  visible: false,
  title: "OpenTopoMap",
});

const cartoDark = new TileLayer({
  source: new XYZ({
    url: "https://{a-d}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png",
    attributions: "© CARTO",
  }),
  visible: false,
  title: "Dark Mode",
});

const cartoVoyager = new TileLayer({
  source: new XYZ({
    url: "https://{a-d}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png",
    attributions: "© CARTO",
  }),
  visible: false,
  title: "Voyager",
});

const basemaps = [
  { layer: esriSatellite, name: "Satellite", icon: "🛰️" },
  { layer: openTopoMap, name: "Topo Map", icon: "🏔️" },
  { layer: esriTopo, name: "Esri Topo", icon: "🗺️" },
  { layer: osmStandard, name: "OSM", icon: "🗺️" },
  { layer: cartoVoyager, name: "Voyager", icon: "✨" },
  { layer: cartoDark, name: "Dark", icon: "🌙" },
];

// =====================================================
// DATA SOURCE - Bank Sampah dari Supabase
// =====================================================

const bankSampahSource = new VectorSource();

// Function to fetch data from Supabase and convert to GeoJSON features
async function loadBankSampahFromSupabase() {
  try {
    const { data, error } = await supabase.from("BankSampah").select("*");

    if (error) {
      console.error("❌ Error ambil data:", error.message);
      return;
    }

    console.log("✅ Data Raw dari Supabase:", data);

    const features = data
      .map((item) => {
        // ✅ PERBAIKAN: JANGAN SWAP! Ambil langsung sesuai nama kolom
        const lat = parseFloat(item.latitude);    // 0.58... ✅
        const lon = parseFloat(item.longitude);   // 101.42... ✅

        if (isNaN(lon) || isNaN(lat)) return null;

        const feature = new Feature({
          geometry: new Point(fromLonLat([lon, lat])), // Urutan: [Longitude, Latitude] ✅

          // Properties
          Nama: item.Nama || item.nama_bank_sampah,
          Kecamatan: item.Kecamatan,

          Kertas: parseInt(item.Kertas || 0),
          Plastik: parseInt(item.Plastik || 0),
          Besi: parseInt(item.Besi || 0),
          Kaca: parseInt(item.Kaca || 0),
          Logam: parseInt(item.Logam || 0),

          Volume_Sampah_kg_per_minggu: parseFloat(
            item["Volume Sampah (per minggu/kg)"] || item.volume || 0
          ),
          Jumlah_Anggota: parseInt(item.Jumlah_Anggota || 0),
        });
        return feature;
      })
      .filter((f) => f !== null);

    bankSampahSource.clear();
    bankSampahSource.addFeatures(features);

    generateZonaJangkauan();
    updateVolumeSliderMax();

    console.log(`🗺️ Berhasil plot ${features.length} titik dengan koordinat BENAR.`);

    // Panggil handler URL setelah data loaded
    handleURLParameters();
  } catch (err) {
    console.error("Error loading:", err);
  }
}

// Update volume slider max value
function updateVolumeSliderMax() {
  let maxVol = 0;
  const features = bankSampahSource.getFeatures();
  features.forEach((f) => {
    const vol = parseFloat(f.get("Volume_Sampah_kg_per_minggu")) || 0;
    if (vol > maxVol) maxVol = vol;
  });

  const volumeSlider = document.getElementById("volume-slider");
  if (volumeSlider) {
    volumeSlider.max = Math.ceil(maxVol);
    volumeSlider.value = Math.ceil(maxVol);
    volumeFilterMax = Math.ceil(maxVol);
    document.getElementById("volume-value").textContent = `0 - ${Math.ceil(
      maxVol
    ).toLocaleString()} kg`;
  }
}

// =====================================================
// LAYER 0: Polygon Riau
// =====================================================

const riau = new VectorLayer({
  source: new VectorSource({
    format: geojsonFormat,
    url: "data/polygon_riau.json",
  }),
  style: new Style({
    fill: new Fill({ color: "rgba(45, 122, 62, 0.15)" }),
    stroke: new Stroke({ color: "#2d7a3e", width: 2.5, lineDash: [5, 5] }),
  }),
});

// =====================================================
// LAYER 1: Indeks Diversifikasi
// =====================================================

const diversityColors = {
  1: "#e74c3c",
  2: "#e67e22",
  3: "#f1c40f",
  4: "#27ae60",
  5: "#1abc9c",
};

function getDiversityIndex(feature) {
  let count = 0;
  if (feature.get("Kertas") === 1) count++;
  if (feature.get("Plastik") === 1) count++;
  if (feature.get("Besi") === 1) count++;
  if (feature.get("Kaca") === 1) count++;
  if (feature.get("Logam") === 1) count++;
  return count;
}

function getDiversityLabel(index) {
  const labels = {
    1: "Sangat Terbatas",
    2: "Terbatas",
    3: "Sedang",
    4: "Lengkap",
    5: "Sangat Lengkap",
  };
  return labels[index] || "N/A";
}

let filterJenisSampah = {
  Kertas: true,
  Plastik: true,
  Besi: true,
  Kaca: true,
  Logam: true,
};

const layerDiversifikasi = new VectorLayer({
  source: bankSampahSource,
  visible: false,
  style: (feature) => {
    const nama = feature.get("Nama");
    if (!nama) return null;

    let hasFilteredType = false;
    if (filterJenisSampah.Kertas && feature.get("Kertas") === 1)
      hasFilteredType = true;
    if (filterJenisSampah.Plastik && feature.get("Plastik") === 1)
      hasFilteredType = true;
    if (filterJenisSampah.Besi && feature.get("Besi") === 1)
      hasFilteredType = true;
    if (filterJenisSampah.Kaca && feature.get("Kaca") === 1)
      hasFilteredType = true;
    if (filterJenisSampah.Logam && feature.get("Logam") === 1)
      hasFilteredType = true;

    const anyFilterActive = Object.values(filterJenisSampah).some((v) => v);
    if (anyFilterActive && !hasFilteredType) return null;

    const diversityIndex = getDiversityIndex(feature);
    const color = diversityColors[diversityIndex] || "#999";

    return new Style({
      image: new CircleStyle({
        radius: 14,
        fill: new Fill({ color: color }),
        stroke: new Stroke({ color: "#fff", width: 2.5 }),
      }),
      text: new Text({
        text: diversityIndex.toString(),
        font: "bold 11px Arial",
        fill: new Fill({ color: "#fff" }),
        offsetY: 1,
      }),
    });
  },
});

function updateDiversifikasiFilter() {
  layerDiversifikasi.changed();
}

// =====================================================
// LAYER 2: Rasio Produktivitas
// =====================================================

function getProduktivitas(feature) {
  const volume = parseFloat(feature.get("Volume_Sampah_kg_per_minggu")) || 0;
  const anggota = parseInt(feature.get("Jumlah_Anggota")) || 1;
  return volume / anggota;
}

function getProduktivitasCategory(produktivitas) {
  if (produktivitas < 50) return { label: "Rendah", color: "#e74c3c" };
  else if (produktivitas < 100) return { label: "Sedang", color: "#f39c12" };
  else if (produktivitas < 200) return { label: "Tinggi", color: "#27ae60" };
  else return { label: "Sangat Tinggi", color: "#9b59b6" };
}

let volumeFilterMin = 0;
let volumeFilterMax = 10000;

const layerProduktivitas = new VectorLayer({
  source: bankSampahSource,
  visible: false,
  style: (feature) => {
    const nama = feature.get("Nama");
    if (!nama) return null;
    const volume = parseFloat(feature.get("Volume_Sampah_kg_per_minggu")) || 0;
    if (volume < volumeFilterMin || volume > volumeFilterMax) return null;

    const produktivitas = getProduktivitas(feature);
    const category = getProduktivitasCategory(produktivitas);
    const logProd = Math.log10(produktivitas + 1);
    const normalizedSize = Math.max(10, Math.min(30, 10 + logProd * 6));

    return new Style({
      image: new CircleStyle({
        radius: normalizedSize,
        fill: new Fill({ color: category.color }),
        stroke: new Stroke({ color: "#fff", width: 2.5 }),
      }),
    });
  },
});

// =====================================================
// LAYER 3: Zona Jangkauan
// =====================================================

const zonaJangkauanSource = new VectorSource();

const layerZonaJangkauan = new VectorLayer({
  source: zonaJangkauanSource,
  visible: false,
  style: (feature) => {
    return new Style({
      fill: new Fill({ color: "rgba(52, 152, 219, 0.15)" }),
      stroke: new Stroke({ color: "#3498db", width: 2, lineDash: [8, 4] }),
    });
  },
});

const layerTitikZona = new VectorLayer({
  source: bankSampahSource,
  visible: false,
  style: (feature) => {
    const nama = feature.get("Nama");
    if (!nama) return null;
    return new Style({
      image: new CircleStyle({
        radius: 8,
        fill: new Fill({ color: "#3498db" }),
        stroke: new Stroke({ color: "#fff", width: 2 }),
      }),
    });
  },
});

let radiusMultiplier = 2;

function calculateRadius(volume) {
  const baseRadius = 300;
  const calculated = baseRadius + volume * radiusMultiplier;
  return Math.min(Math.max(calculated, 500), 8000);
}

function generateZonaJangkauan() {
  zonaJangkauanSource.clear();
  const features = bankSampahSource.getFeatures();
  features.forEach((feature) => {
    const nama = feature.get("Nama");
    if (!nama) return;
    const geom = feature.getGeometry();
    if (geom && geom.getType() === "Point") {
      const center = geom.getCoordinates();
      const volume =
        parseFloat(feature.get("Volume_Sampah_kg_per_minggu")) || 0;
      const radius = calculateRadius(volume);
      const circle = new Feature({
        geometry: new CircleGeom(center, radius),
        nama: nama,
        volume: volume,
        radius: radius,
      });
      zonaJangkauanSource.addFeature(circle);
    }
  });
}

// =====================================================
// LAYER: Titik Bank Sampah (Default)
// =====================================================

const bankSampah = new VectorLayer({
  source: bankSampahSource,
  visible: true,
  style: (feature) => {
    const nama = feature.get("Nama");
    if (!nama) return null;
    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        src: "icon/iconaaa.png",
        scale: 0.3,
      }),
    });
  },
});

// =====================================================
// INISIALISASI MAP
// =====================================================

const map = new Map({
  target: "map",
  layers: [
    osmStandard,
    esriSatellite,
    esriTopo,
    openTopoMap,
    cartoDark,
    cartoVoyager,
    riau,
    layerZonaJangkauan,
    layerTitikZona,
    layerDiversifikasi,
    layerProduktivitas,
    bankSampah,
  ],
  view: new View({
    center: fromLonLat([101.42, 0.5]),
    zoom: 12,
    minZoom: 5,
    maxZoom: 18,
  }),
  overlays: [overlay],
});

// Load data from Supabase on initialization
loadBankSampahFromSupabase();

// =====================================================
// BASEMAP SWITCHER
// =====================================================

function createBasemapSwitcher() {
  const basemapContainer = document.getElementById("basemap-switcher");
  if (!basemapContainer) return;

  basemaps.forEach((basemap) => {
    const btn = document.createElement("button");
    btn.className = `basemap-btn ${basemap.layer.getVisible() ? "active" : ""}`;
    btn.innerHTML = `${basemap.icon} ${basemap.name}`;
    btn.title = basemap.name;

    btn.addEventListener("click", () => {
      basemaps.forEach((b) => b.layer.setVisible(false));
      basemap.layer.setVisible(true);
      document
        .querySelectorAll(".basemap-btn")
        .forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
    });
    basemapContainer.appendChild(btn);
  });
}
createBasemapSwitcher();

// =====================================================
// POPUP ON CLICK
// =====================================================

map.on("singleclick", function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
  if (!feature) {
    overlay.setPosition(undefined);
    return;
  }

  // Panggil helper function untuk generate content popup
  // Kita buatkan helper agar bisa dipanggil juga dari fitur "Show on Map"
  displayPopup(feature, evt.coordinate);
});

// Helper untuk menampilkan isi popup (biar kodingan rapi)
function displayPopup(feature, coordinate) {
  const nama = feature.get("Nama") || feature.get("nama");
  if (!nama) return;

  let extraInfo = "";

  if (layerDiversifikasi.getVisible()) {
    const diversityIndex = getDiversityIndex(feature);
    extraInfo = `
      <div class="popup-analysis">
        <span class="analysis-badge" style="background: ${
          diversityColors[diversityIndex]
        }">
          🎨 Indeks Diversifikasi: ${diversityIndex}/5
          <br><small>${getDiversityLabel(diversityIndex)}</small>
        </span>
      </div>`;
  }

  if (layerProduktivitas.getVisible()) {
    const produktivitas = getProduktivitas(feature);
    const category = getProduktivitasCategory(produktivitas);
    extraInfo = `
      <div class="popup-analysis">
        <span class="analysis-badge" style="background: ${category.color}">
          📊 Produktivitas: ${produktivitas.toFixed(0)} kg/anggota/minggu
          <br><small>${category.label}</small>
        </span>
      </div>`;
  }

  if (layerZonaJangkauan.getVisible()) {
    const volume = parseFloat(feature.get("Volume_Sampah_kg_per_minggu")) || 0;
    const radius = calculateRadius(volume);
    extraInfo = `
      <div class="popup-analysis">
        <span class="analysis-badge" style="background: #3498db">
          🎯 Zona Jangkauan
          <br><small>Radius: ${(radius / 1000).toFixed(1)} km</small>
        </span>
      </div>`;
  }

  const kecamatan = feature.get("Kecamatan") || "N/A";
  const volumeMingguan = feature.get("Volume_Sampah_kg_per_minggu") ?? "0";
  const jumlahAnggota = feature.get("Jumlah_Anggota") ?? "0";

  const jenisSampah = [];
  if (feature.get("Kertas") === 1) jenisSampah.push("📄 Kertas");
  if (feature.get("Plastik") === 1) jenisSampah.push("🥤 Plastik");
  if (feature.get("Besi") === 1) jenisSampah.push("🔩 Besi");
  if (feature.get("Kaca") === 1) jenisSampah.push("🪟 Kaca");
  if (feature.get("Logam") === 1) jenisSampah.push("⚙️ Logam");

  content_element.innerHTML = `
    <div class="popup-content">
      <h3>🏦 ${nama}</h3>
      ${extraInfo}
      <div class="popup-info">
        <p><i class="fas fa-map-marker-alt"></i> <strong>Kecamatan:</strong> ${kecamatan}</p>
        <p><i class="fas fa-weight"></i> <strong>Volume Mingguan:</strong> ${parseFloat(
          volumeMingguan
        ).toLocaleString()} kg</p>
        <p><i class="fas fa-users"></i> <strong>Jumlah Anggota:</strong> ${jumlahAnggota} orang</p>
      </div>
      <div class="popup-jenis">
        <strong>♻️ Jenis Sampah:</strong><br>
        <span class="jenis-tags">${
          jenisSampah.length ? jenisSampah.join(" • ") : "Tidak ada data"
        }</span>
      </div>
    </div>
  `;

  overlay.setPosition(coordinate);
}

closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

// =====================================================
// LAYER CONTROL
// =====================================================

const polygonCheckbox = document.getElementById("polygon");
const pointCheckbox = document.getElementById("point");

if (polygonCheckbox) {
  polygonCheckbox.addEventListener("change", function () {
    riau.setVisible(this.checked);
  });
}

if (pointCheckbox) {
  pointCheckbox.addEventListener("change", function () {
    bankSampah.setVisible(this.checked);
  });
}

// =====================================================
// ANALYSIS LAYER CONTROLS
// =====================================================

function hideAllAnalysisLayers() {
  layerDiversifikasi.setVisible(false);
  layerProduktivitas.setVisible(false);
  layerZonaJangkauan.setVisible(false);
  layerTitikZona.setVisible(false);

  document.getElementById("filter-diversifikasi").style.display = "none";
  document.getElementById("filter-produktivitas").style.display = "none";
  document.getElementById("filter-zona").style.display = "none";

  document
    .querySelectorAll(".analysis-layer")
    .forEach((el) => el.classList.remove("active"));
}

const layer1Checkbox = document.getElementById("layer-diversifikasi");
const filterDiversifikasi = document.getElementById("filter-diversifikasi");

if (layer1Checkbox) {
  layer1Checkbox.addEventListener("change", function () {
    if (this.checked) {
      hideAllAnalysisLayers();
      this.checked = true;
      layerDiversifikasi.setVisible(true);
      filterDiversifikasi.style.display = "block";
      document.getElementById("layer1-container").classList.add("active");
    } else {
      layerDiversifikasi.setVisible(false);
      filterDiversifikasi.style.display = "none";
      document.getElementById("layer1-container").classList.remove("active");
    }
  });
}

["Kertas", "Plastik", "Besi", "Kaca", "Logam"].forEach((jenis) => {
  const checkbox = document.getElementById(`filter-${jenis.toLowerCase()}`);
  if (checkbox) {
    checkbox.addEventListener("change", function () {
      filterJenisSampah[jenis] = this.checked;
      updateDiversifikasiFilter();
    });
  }
});

const layer2Checkbox = document.getElementById("layer-produktivitas");
const filterProduktivitasEl = document.getElementById("filter-produktivitas");

if (layer2Checkbox) {
  layer2Checkbox.addEventListener("change", function () {
    if (this.checked) {
      hideAllAnalysisLayers();
      this.checked = true;
      layerProduktivitas.setVisible(true);
      filterProduktivitasEl.style.display = "block";
      document.getElementById("layer2-container").classList.add("active");
    } else {
      layerProduktivitas.setVisible(false);
      filterProduktivitasEl.style.display = "none";
      document.getElementById("layer2-container").classList.remove("active");
    }
  });
}

const volumeSlider = document.getElementById("volume-slider");
if (volumeSlider) {
  volumeSlider.addEventListener("input", function () {
    volumeFilterMax = parseInt(this.value);
    document.getElementById("volume-value").textContent = `0 - ${parseInt(
      this.value
    ).toLocaleString()} kg`;
    layerProduktivitas.changed();
  });
}

const layer3Checkbox = document.getElementById("layer-zona");
const filterZona = document.getElementById("filter-zona");

if (layer3Checkbox) {
  layer3Checkbox.addEventListener("change", function () {
    if (this.checked) {
      hideAllAnalysisLayers();
      this.checked = true;
      layerZonaJangkauan.setVisible(true);
      layerTitikZona.setVisible(true);
      filterZona.style.display = "block";
      document.getElementById("layer3-container").classList.add("active");
    } else {
      layerZonaJangkauan.setVisible(false);
      layerTitikZona.setVisible(false);
      filterZona.style.display = "none";
      document.getElementById("layer3-container").classList.remove("active");
    }
  });
}

const radiusSlider = document.getElementById("radius-slider");
if (radiusSlider) {
  radiusSlider.addEventListener("input", function () {
    radiusMultiplier = parseFloat(this.value);
    document.getElementById("radius-value").textContent = `${this.value} m/kg`;
    generateZonaJangkauan();
  });
}

// =====================================================
// HOVER EFFECT & ZOOM CONTROLS
// =====================================================

map.on("pointermove", function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
  map.getTargetElement().style.cursor = feature ? "pointer" : "";
});

const zoomInBtn = document.getElementById("zoom-in");
const zoomOutBtn = document.getElementById("zoom-out");
const resetViewBtn = document.getElementById("reset-view");

if (zoomInBtn)
  zoomInBtn.addEventListener("click", () =>
    map.getView().animate({ zoom: map.getView().getZoom() + 1, duration: 300 })
  );
if (zoomOutBtn)
  zoomOutBtn.addEventListener("click", () =>
    map.getView().animate({ zoom: map.getView().getZoom() - 1, duration: 300 })
  );
if (resetViewBtn)
  resetViewBtn.addEventListener("click", () =>
    map
      .getView()
      .animate({ center: fromLonLat([101.42, 0.5]), zoom: 12, duration: 500 })
  );

// =====================================================
// URL PARAMETER HANDLER (FITUR BARU)
// =====================================================

/**
 * 1. Fungsi untuk membaca parameter lat, lng, zoom, name dari URL
 */
function getURLParams() {
  const params = new URLSearchParams(window.location.search);
  return {
    lat: params.get("lat"),
    lng: params.get("lng"),
    zoom: params.get("zoom"),
    name: params.get("name"),
  };
}

/**
 * 2. Fungsi untuk menampilkan popup berdasarkan koordinat (Triggered by URL)
 */
function showPopupAtCoordinate(lat, lng, name) {
  const features = bankSampahSource.getFeatures();
  let targetFeature = null;
  const targetLat = parseFloat(lat);
  const targetLng = parseFloat(lng);

  // Loop semua fitur untuk mencari yang koordinatnya cocok
  features.forEach((feature) => {
    const geom = feature.getGeometry();
    if (geom && geom.getType() === "Point") {
      const coords = geom.getCoordinates();
      // Konversi target lat/lng ke proyeksi peta (EPSG:3857) agar bisa dibandingkan
      const [targetProjLng, targetProjLat] = fromLonLat([targetLng, targetLat]);

      // Cek jarak/kesamaan (gunakan toleransi kecil karena float)
      if (
        Math.abs(coords[0] - targetProjLng) < 1 &&
        Math.abs(coords[1] - targetProjLat) < 1
      ) {
        targetFeature = feature;
      }
    }
  });

  if (targetFeature) {
    // Gunakan fungsi displayPopup yang sudah kita buat tadi
    // Kita perlu koordinat dalam proyeksi peta untuk posisi popup
    const popupCoord = fromLonLat([targetLng, targetLat]);
    displayPopup(targetFeature, popupCoord);

    console.log(`📍 Popup ditampilkan untuk: ${name}`);
  } else {
    console.warn("Feature tidak ditemukan di koordinat:", lat, lng);
  }
}

/**
 * 3. Handler Utama: Cek URL -> Animasi Zoom -> Tampilkan Popup
 */
function handleURLParameters() {
  const urlParams = getURLParams();

  if (urlParams.lat && urlParams.lng) {
    const lat = parseFloat(urlParams.lat);
    const lng = parseFloat(urlParams.lng);
    const zoom = urlParams.zoom ? parseInt(urlParams.zoom) : 18; // Default zoom tinggi
    const name = urlParams.name ? decodeURIComponent(urlParams.name) : null;

    if (!isNaN(lat) && !isNaN(lng)) {
      console.log(`🎯 URL Command Detected: Go to ${name} (${lat}, ${lng})`);

      // 1. Terbang ke lokasi
      map.getView().animate({
        center: fromLonLat([lng, lat]),
        zoom: zoom,
        duration: 1500, // Durasi terbang
      });

      // 2. Tunggu animasi selesai dikit, lalu munculkan popup
      setTimeout(() => {
        showPopupAtCoordinate(lat, lng, name);
      }, 1600);
    }
  }
}
