import { z } from 'zod';
export declare const createAddressSchema: z.ZodObject<{
    recipient_name: z.ZodString;
    phone: z.ZodString;
    full_address: z.ZodString;
    city: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    postal_code: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    label: z.ZodDefault<z.ZodString>;
    is_default: z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodNumber]>, z.ZodTransform<boolean, number | boolean>>>;
}, z.core.$strip>;
export declare const updateAddressSchema: z.ZodObject<{
    recipient_name: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    full_address: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    postal_code: z.ZodOptional<z.ZodNullable<z.ZodOptional<z.ZodString>>>;
    label: z.ZodOptional<z.ZodDefault<z.ZodString>>;
    is_default: z.ZodOptional<z.ZodOptional<z.ZodPipe<z.ZodUnion<readonly [z.ZodBoolean, z.ZodNumber]>, z.ZodTransform<boolean, number | boolean>>>>;
}, z.core.$strip>;
export declare const addToCartSchema: z.ZodObject<{
    product_id: z.ZodCoercedNumber<unknown>;
    quantity: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    variant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const updateCartSchema: z.ZodObject<{
    quantity: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    variant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const checkoutItemSchema: z.ZodObject<{
    product_id: z.ZodCoercedNumber<unknown>;
    quantity: z.ZodCoercedNumber<unknown>;
    variant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    unit_price: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
}, z.core.$strip>;
export declare const checkoutOrderSchema: z.ZodObject<{
    mitra_id: z.ZodCoercedNumber<unknown>;
    address_id: z.ZodCoercedNumber<unknown>;
    shipping_method: z.ZodDefault<z.ZodString>;
    shipping_cost: z.ZodDefault<z.ZodCoercedNumber<unknown>>;
    customer_notes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    payment_method: z.ZodDefault<z.ZodEnum<{
        cod: "cod";
        qris: "qris";
        transfer: "transfer";
        va: "va";
    }>>;
    items: z.ZodArray<z.ZodObject<{
        product_id: z.ZodCoercedNumber<unknown>;
        quantity: z.ZodCoercedNumber<unknown>;
        variant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
        unit_price: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    }, z.core.$strip>>;
}, z.core.$strip>;
export declare const updateOrderStatusSchema: z.ZodObject<{
    status: z.ZodEnum<{
        cancelled: "cancelled";
        completed: "completed";
        packed: "packed";
        paid: "paid";
        pending: "pending";
        shipped: "shipped";
    }>;
    tracking_number: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const createReviewSchema: z.ZodObject<{
    product_id: z.ZodCoercedNumber<unknown>;
    order_item_id: z.ZodNullable<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    rating: z.ZodCoercedNumber<unknown>;
    variant: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    comment: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    photo_urls: z.ZodNullable<z.ZodOptional<z.ZodArray<z.ZodString>>>;
}, z.core.$strip>;
export declare const replyReviewSchema: z.ZodObject<{
    seller_reply: z.ZodString;
}, z.core.$strip>;
export declare const registerMitraSchema: z.ZodObject<{
    name: z.ZodString;
    email: z.ZodString;
    password: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    whatsapp_number: z.ZodString;
    store_name: z.ZodString;
    workshop_address: z.ZodString;
    started_year: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>>;
}, z.core.$strip>;
export declare const loginSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
}, z.core.$strip>;
export declare const googleLoginSchema: z.ZodObject<{
    credential: z.ZodOptional<z.ZodString>;
    userInfo: z.ZodOptional<z.ZodRecord<z.ZodString, z.ZodAny>>;
}, z.core.$strip>;
export declare const forgotPasswordSchema: z.ZodObject<{
    email: z.ZodString;
}, z.core.$strip>;
export declare const verifyOtpSchema: z.ZodObject<{
    email: z.ZodString;
    otp: z.ZodString;
}, z.core.$strip>;
export declare const resetPasswordSchema: z.ZodObject<{
    email: z.ZodString;
    newPassword: z.ZodString;
    otp: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const updateProfileSchema: z.ZodObject<{
    ownerName: z.ZodOptional<z.ZodString>;
    nama: z.ZodOptional<z.ZodString>;
    storeName: z.ZodOptional<z.ZodString>;
    nama_toko: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    whatsapp_number: z.ZodOptional<z.ZodString>;
    address: z.ZodOptional<z.ZodString>;
    alamat: z.ZodOptional<z.ZodString>;
    workshop_address: z.ZodOptional<z.ZodString>;
    yearStarted: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    tahun_mulai: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    started_year: z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodNumber]>>;
    description: z.ZodOptional<z.ZodString>;
    deskripsi: z.ZodOptional<z.ZodString>;
    website: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    instagram: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const createProductSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    price: z.ZodCoercedNumber<unknown>;
    stock: z.ZodCoercedNumber<unknown>;
    category_id: z.ZodCoercedNumber<unknown>;
    weight_gram: z.ZodOptional<z.ZodDefault<z.ZodCoercedNumber<unknown>>>;
    variants: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodAny>]>>>;
}, z.core.$strip>;
export declare const updateProductSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    title: z.ZodOptional<z.ZodString>;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    price: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    stock: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    category_id: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    weight_gram: z.ZodOptional<z.ZodCoercedNumber<unknown>>;
    variants: z.ZodNullable<z.ZodOptional<z.ZodUnion<readonly [z.ZodString, z.ZodArray<z.ZodAny>]>>>;
}, z.core.$strip>;
export declare const sendMessageSchema: z.ZodObject<{
    message: z.ZodString;
}, z.core.$strip>;
export declare const updateUserStatusSchema: z.ZodObject<{
    is_active: z.ZodCoercedBoolean<unknown>;
}, z.core.$strip>;
export declare const createMasterDataSchema: z.ZodObject<{
    category: z.ZodString;
    key: z.ZodString;
    value: z.ZodString;
    description: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const verifyMitraStoreSchema: z.ZodObject<{
    status: z.ZodEnum<{
        approved: "approved";
        ditolak: "ditolak";
        rejected: "rejected";
        terverifikasi: "terverifikasi";
    }>;
    reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    rejection_reason: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const aiAnalysisSchema: z.ZodObject<{
    context: z.ZodString;
    productCategory: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    targetMarket: z.ZodNullable<z.ZodOptional<z.ZodString>>;
    additionalNotes: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const handleReportActionSchema: z.ZodObject<{
    action: z.ZodEnum<{
        abaikan: "abaikan";
        delete: "delete";
        hapus: "hapus";
        ignore: "ignore";
        suspend: "suspend";
        takedown: "takedown";
    }>;
    targetId: z.ZodNullable<z.ZodOptional<z.ZodCoercedNumber<unknown>>>;
    type: z.ZodNullable<z.ZodOptional<z.ZodString>>;
}, z.core.$strip>;
export declare const handleDeletionActionSchema: z.ZodObject<{
    action: z.ZodEnum<{
        approved: "approved";
        rejected: "rejected";
    }>;
}, z.core.$strip>;
//# sourceMappingURL=schemas.d.ts.map