import db from '../config/database';

const runMigration = async () => {
    const query = `
    ALTER TABLE mitra_profiles 
    ADD COLUMN description TEXT NULL AFTER started_year,
    ADD COLUMN website VARCHAR(255) NULL AFTER description,
    ADD COLUMN instagram VARCHAR(100) NULL AFTER website,
    ADD COLUMN banner_url VARCHAR(500) NULL AFTER instagram;
  `;

    try {
        console.log('Menjalankan migrasi database...');
        await db.query(query);
        console.log('✅ Migrasi berhasil! Kolom profil toko mitra telah ditambahkan.');
    } catch (error: any) {
        // ER_DUP_FIELDNAME adalah kode error MySQL jika kolom sudah ada
        if (error.code === 'ER_DUP_FIELDNAME') {
            console.log('⚠️ Aman: Kolom sudah ada di database, migrasi dilewati.');
        } else {
            console.error('❌ Migrasi gagal:', error);
        }
    }
    process.exit();
};

runMigration();