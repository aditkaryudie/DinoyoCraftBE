export interface SupportedCountry {
    country: string;
    currency: string;
    iso2: string;
}
export declare const SUPPORTED_COUNTRIES: Record<string, {
    currency: string;
    iso2: string;
}>;
export declare class CookieJar {
    private cookies;
    updateFromHeaders(headers: Headers): void;
    getCookieHeader(): string;
    get(name: string): string | undefined;
    getCsrf(): string;
}
export declare class SociabuzzClient {
    private baseURL;
    /**
     * 1. Inisialisasi sesi & ambil CSRF Token dari halaman creator
     */
    initSession(username: string, jar: CookieJar): Promise<string>;
    /**
     * 2. Buat sesi donasi / pembayaran untuk mendapatkan payment token
     */
    submitDonation(username: string, amount: number, fullname: string, email: string, note: string, jar: CookieJar, country?: string): Promise<{
        token: string;
        actualAmount: number;
        redirectUrl: string;
    }>;
    /**
     * 3. Ambil pengaturan channel pembayaran & CSRF pembayaran
     */
    visitPaymentPage(token: string, jar: CookieJar): Promise<string>;
    /**
     * 4. Ambil metode pembayaran yang aktif
     */
    getPaymentSettings(token: string, amount: number, country: string | undefined, jar: CookieJar): Promise<any>;
    /**
     * 5. Buat tagihan pembayaran (Generate QRIS / Payment Link)
     */
    createPayment(token: string, paymentMethod: string, amount: number, country: string | undefined, jar: CookieJar): Promise<any>;
    /**
     * 6. Cek Status Pembayaran ke SociaBuzz
     */
    checkPaymentStatus(token: string, paymentMethod: string, invId?: string): Promise<'paid' | 'pending' | 'expired' | 'failed'>;
}
export declare const sociabuzzClient: SociabuzzClient;
export default sociabuzzClient;
//# sourceMappingURL=sociabuzzClient.d.ts.map