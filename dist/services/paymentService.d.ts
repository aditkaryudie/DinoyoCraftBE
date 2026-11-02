export declare function getPaymentCountries(): Promise<{
    success: boolean;
    total: number;
    countries: {
        country: string;
        currency: string;
        iso2: string;
    }[];
}>;
/**
 * Hitung Biaya Layanan (Service Fee / Admin Fee)
 * Membantu agar merchant / penjual menerima hasil bersih
 * dan menutup biaya penarikan bank dari SociaBuzz.
 */
export declare function calculateServiceFee(baseAmount: number): {
    baseAmount: number;
    fixedFee: number;
    percentFee: number;
    totalServiceFee: number;
    finalAmountToPay: number;
};
export declare function calculatePaymentFees(country: string, amount: number, _username?: string): Promise<{
    success: boolean;
    country: string;
    currency: string;
    amount: number;
    service_fee: {
        baseAmount: number;
        fixedFee: number;
        percentFee: number;
        totalServiceFee: number;
        finalAmountToPay: number;
    };
    methods: ({
        id: number;
        name: string;
        label: string;
        group: string;
        gateway: string;
        fee: {
            fee_type: string;
            fee_rate: string;
            total_fee: number;
            total_pay: number;
        };
    } | {
        id: number;
        name: string;
        label: string;
        group: string;
        gateway: string;
        fee: {
            fee_rate?: undefined;
            fee_type: string;
            total_fee: number;
            total_pay: number;
        };
    })[];
}>;
export declare function createDonationSession(params: {
    amount: number;
    fullname: string;
    email: string;
    note?: string;
    callback_url?: string;
    country?: string;
    username?: string;
}): Promise<{
    success: boolean;
    token: string;
    country: string;
    currency: string;
    amount: number;
    redirect_url: string;
    expires_in: number;
}>;
export declare function fetchPaymentMethods(token: string): Promise<{
    success: boolean;
    token: string;
    methods: any;
}>;
export declare function initiatePayment(token: string, paymentMethod: string): Promise<any>;
export declare function processDirectPayment(params: {
    username?: string;
    amount: number;
    fullname: string;
    email: string;
    note?: string;
    paymentMethod: string;
    country?: string;
}): Promise<any>;
export declare function verifyPaymentStatus(token: string, paymentMethod: string, invId?: string): Promise<{
    success: boolean;
    token: string;
    status: "expired" | "failed" | "paid" | "pending";
}>;
//# sourceMappingURL=paymentService.d.ts.map