#!/bin/bash
# setup-folders.sh
# Jalankan ini di server Pterodactyl untuk memastikan folder ada

echo "=== Setting up folders ==="

# Buat folder temp_audio jika belum ada
if [ ! -d "temp_audio" ]; then
    mkdir -p temp_audio
    echo "✅ Folder temp_audio/ dibuat"
else
    echo "✅ Folder temp_audio/ sudah ada"
fi

# Buat folder education jika belum ada (isinya diisi pengguna sendiri)
for d in "jadwal" "Modul Fisika" "MATKUL"; do
    if [ ! -d "$d" ]; then
        mkdir -p "$d"
        echo "✅ Folder $d/ dibuat"
    else
        echo "✅ Folder $d/ sudah ada"
    fi
done

echo "=== Setup folders selesai ==="
