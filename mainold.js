import './style.css';
import { Map, View } from 'ol';
import TileLayer from 'ol/layer/Tile';
import OSM from 'ol/source/OSM';
import VectorLayer from 'ol/layer/Vector';
import { Vector as VectorSource } from 'ol/source.js';
import GeoJSON from 'ol/format/GeoJSON.js';
import { fromLonLat } from 'ol/proj.js';
import { Icon, Style } from 'ol/style.js';
import Overlay from 'ol/Overlay.js';

// Setup popup overlay
const container = document.getElementById('popup');
const content_element = document.getElementById('popup-content');
const closer = document.getElementById('popup-closer');

const overlay = new Overlay({
  element: container,
  autoPan: { animation: { duration: 250 } },
});

// Format GeoJSON dengan transform 4326 -> 3857
const geojsonFormat = new GeoJSON({
  dataProjection: 'EPSG:4326',
  featureProjection: 'EPSG:3857',
});

// Polygon Riau
const riau = new VectorLayer({
  source: new VectorSource({
    format: geojsonFormat,
    url: 'data/polygon_riau.json',
  }),
});

// Titik Bank Sampah
const bankSampah = new VectorLayer({
  source: new VectorSource({
    format: geojsonFormat,
    url: 'data/bank_sampah.geojson',
  }),
  style: (feature) => {
    const nama = feature.get('Nama');
    if (!nama) return null;

    return new Style({
      image: new Icon({
        anchor: [0.5, 0.5],
        anchorXUnits: 'fraction',
        anchorYUnits: 'fraction',
        src: 'icon/sampah.png',
        scale: 0.05,
      }),
    });
  },
});

const map = new Map({
  target: 'map',
  layers: [
    new TileLayer({ source: new OSM() }),
    riau,
    bankSampah,
  ],
  view: new View({
    center: fromLonLat([101.44777, 0.507068]),
    zoom: 8,
  }),
  overlays: [overlay],
});

// Popup on click
map.on('singleclick', function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);

  if (!feature) {
    overlay.setPosition(undefined);
    return;
  }

  const nama = feature.get('Nama');
  if (!nama) return;

  const kecamatan = feature.get('Kecamatan') || 'N/A';

  // ✅ sesuai field di GeoJSON hasil konversi
  const volumeMingguan = feature.get('Volume_Sampah_kg_per_minggu') ?? '0';
  const jumlahAnggota = feature.get('Jumlah_Anggota') ?? '0';

  const jenisSampah = [];
  if (feature.get('Kertas') === 1) jenisSampah.push('Kertas');
  if (feature.get('Plastik') === 1) jenisSampah.push('Plastik');
  if (feature.get('Besi') === 1) jenisSampah.push('Besi');
  if (feature.get('Kaca') === 1) jenisSampah.push('Kaca');
  if (feature.get('Logam') === 1) jenisSampah.push('Logam');

  content_element.innerHTML = `
    <div class="popup-content">
      <h3>${nama}</h3>
      <p><strong>Kecamatan:</strong> ${kecamatan}</p>
      <p><strong>Volume Mingguan:</strong> ${volumeMingguan} kg</p>
      <p><strong>Jumlah Anggota:</strong> ${jumlahAnggota} orang</p>
      <p><strong>Jenis Sampah:</strong><br>${jenisSampah.length ? jenisSampah.join(', ') : 'Tidak ada data'}</p>
    </div>
  `;

  overlay.setPosition(evt.coordinate);
});

closer.onclick = function () {
  overlay.setPosition(undefined);
  closer.blur();
  return false;
};

// =====================================================
// LAYER CONTROL - Menghubungkan checkbox dengan layer
// =====================================================

// Ambil elemen checkbox
const polygonCheckbox = document.getElementById('polygon');
const pointCheckbox = document.getElementById('point');
const infoElement = document.getElementById('info');

// Event listener untuk checkbox Polygon Riau
if (polygonCheckbox) {
  polygonCheckbox.addEventListener('change', function () {
    riau.setVisible(this.checked);
    updateInfo();
  });
}

// Event listener untuk checkbox Titik Bank Sampah
if (pointCheckbox) {
  pointCheckbox.addEventListener('change', function () {
    bankSampah.setVisible(this.checked);
    updateInfo();
  });
}

// Fungsi untuk update info layer aktif
function updateInfo() {
  const layers = [];
  if (polygonCheckbox && polygonCheckbox.checked) {
    layers.push('Polygon Riau');
  }
  if (pointCheckbox && pointCheckbox.checked) {
    layers.push('Titik Bank Sampah');
  }
  
  if (infoElement) {
    if (layers.length > 0) {
      infoElement.innerHTML = `<strong>Layer Aktif:</strong><br>${layers.join(', ')}`;
    } else {
      infoElement.innerHTML = '<em>Tidak ada layer aktif</em>';
    }
  }
}

// Update info saat pertama kali load
updateInfo();

// Tampilkan info feature saat hover/click
map.on('pointermove', function (evt) {
  const feature = map.forEachFeatureAtPixel(evt.pixel, (f) => f);
  
  if (feature) {
    map.getTargetElement().style.cursor = 'pointer';
    
    // Update info box dengan nama feature
    const nama = feature.get('Nama') || feature.get('PROVINSI') || 'Feature';
    if (infoElement) {
      infoElement.innerHTML = `<strong>Hover:</strong> ${nama}`;
    }
  } else {
    map.getTargetElement().style.cursor = '';
    updateInfo(); // Reset ke info layer aktif
  }
});