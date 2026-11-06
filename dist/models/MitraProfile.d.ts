import { Model } from 'sequelize';
import { sequelize } from '../config/database.js';
declare class MitraProfile extends Model {
    id: number;
    user_id: number;
    whatsapp_number: string;
    store_name: string;
    workshop_address: string;
    started_year: number | null;
    description: string | null;
    website: string | null;
    instagram: string | null;
    banner_url: string | null;
    avatar_url: string | null;
    ktp_file_url: string;
    nib_file_url: string;
    sample_product_images: string[] | string;
    is_verified: number;
    rejection_reason: string | null;
    is_active: number;
    created_at: Date;
    updated_at: Date;
}
/**
 * Memastikan tabel mitra_profiles memiliki seluruh kolom yang dibutuhkan
 * secara idempotent tanpa menghapus atau merusak data yang sudah ada.
 */
export declare const ensureMitraProfileSchema: () => Promise<void>;
export { sequelize };
export default MitraProfile;
//# sourceMappingURL=MitraProfile.d.ts.map