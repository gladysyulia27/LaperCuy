<div align="center">
  <img src="frontend/assets/lapercuylogo.png" alt="LaperCuy Logo" width="300">
  
  <h3><b>LaperCuy - Solusi Cerdas Pesan Makan di Kantin</b></h3>
  <p><i>Gak perlu antre lama, tinggal klik, makanan tiba!</i></p>
</div>

---

## Tentang LaperCuy

**LaperCuy** adalah aplikasi pemesanan makanan kantin berbasis digital yang dirancang khusus untuk mempermudah civitas kampus. Pada proyek ini, diutamakan mahasiswa. Kami hadir untuk mengatasi masalah klasik: **Antrean panjang yang membosankan.**

Dengan LaperCuy, pengalaman makan siang di kampus jadi lebih modern, cepat, dan praktis. Cari menu favoritmu, pesan dari mana saja, dan ambil saat sudah siap!

## Fitur Utama

*   📖 **Menu Digital Interaktif** – Lihat daftar makanan & minuman lengkap dengan gambar dan harga terbaru.
*   🔍 **Pencarian Pintar** – Temukan makanan yang kamu mau dengan fitur filter kategori.
*   🛒 **Keranjang Belanja** – Kelola pesananmu dengan mudah sebelum melakukan pembayaran.
*   🧾 **Status Antrean Real-time** – Pantau apakah pesananmu sedang dimasak atau sudah siap diambil.
*   👤 **Manajemen Profil** – Simpan informasi pribadi dan pantau saldo SaldoCuy milikmu.

## Teknologi yang Digunakan

Proyek ini dibangun menggunakan kombinasi teknologi modern untuk performa terbaik:

*   **Frontend:** HTML5, CSS3, JavaScript (Vanilla)
*   **Backend:** Node.js, Express.js
*   **Database:** PostgreSQL
*   **Icons:** Lucide Icons
*   **Version Control:** Git & GitHub

## Struktur Folder Proyek

```text
LaperCuy/
├── backend/            # Server logic, API routes, dan inisialisasi server
│   └── setup-db.js     # Script untuk setup data awal database
├── database/           # Kumpulan script SQL dan skema database
│   ├── lapercuy.sql
│   └── schema_postgresql.sql
└── frontend/           # Seluruh aset tampilan (Client-side)
    ├── assets/         # Gambar, Logo, dan Aset Visual
    ├── index.html      # Halaman utama (Beranda)
    ├── login.html      # Halaman masuk akun
    ├── register.html   # Halaman daftar akun baru
    ├── style.css       # Pengaturan UI/UX & Responsivitas
    └── app.js          # Logika interaksi Frontend
