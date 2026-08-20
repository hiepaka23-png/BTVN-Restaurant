export interface Ingredient {
    name: string;
    quantity: number;
    unit: string;
}

// Khớp đúng danh sách RECIPE_CATEGORIES ở backend (recipes/schemas/recipe.schema.ts) — khác với
// isFavorite (đánh dấu món "Đặc biệt" nổi bật, không phải một danh mục).
export const RECIPE_CATEGORIES = [
    'Món chính',
    'Khai vị',
    'Súp & Salad',
    'Đồ uống',
    'Tráng miệng',
] as const;
export type RecipeCategory = (typeof RECIPE_CATEGORIES)[number];

export interface RecipeModel {
    id: number;
    name: string;
    description: string;
    ingredients: Ingredient[];
    imgUrl: string;
    price: number;
    isFavorite: boolean;
    category: RecipeCategory;
    authorEmail: string;
}

export interface CartItem {
    recipeId: number;
    name: string;
    price: number;
    imgUrl: string;
    quantity: number;
}

export type OrderStatus = 'dang_lam' | 'hoan_thanh' | 'bi_huy';
export type PaymentMethod = 'cod' | 'bank_transfer';
export type PaymentStatus = 'chua_thanh_toan' | 'da_thanh_toan';

export interface OrderItem {
    recipeId: number;
    name: string;
    price: number;
    quantity: number;
}

export interface Order {
    _id: string;
    username: string;
    items: OrderItem[];
    total: number;
    recipientName: string;
    phone: string;
    address: string;
    note?: string;
    status: OrderStatus;
    cancelReason: string | null;
    paymentMethod: PaymentMethod;
    paymentStatus: PaymentStatus;
    transactionId: string | null;
    paidAt: string | null;
    promoCode: string | null;
    discountPercent: number;
    discountAmount: number;
    createdAt: string;
    updatedAt: string;
}

// Mã ưu đãi trúng từ minigame Hộp Quà May Mắn — sinh ở server, dùng thật được ở bước đặt hàng.
export interface PromoCode {
    code: string;
    discountPercent: number;
    used: boolean;
    createdAt: string;
}

export interface RevenueByDay {
    date: string; // 'YYYY-MM-DD'
    revenue: number;
    orders: number;
}

export interface OrderStats {
    total: number;
    byStatus: Record<OrderStatus, number>;
    topRecipes: { name: string; quantity: number }[];
    totalRevenue: number;
    revenueByDay: RevenueByDay[];
}

// Hồ sơ ứng tuyển gửi từ trang /careers — admin xem qua GET /job-applications.
export interface JobApplication {
    _id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    position: string;
    message: string;
    cvUrl: string;
    cvFileName: string;
    createdAt: string;
}

// Tin nhắn liên hệ gửi từ trang /contact — admin xem qua GET /contact-messages.
export interface ContactMessage {
    _id: string;
    username: string;
    fullName: string;
    email: string;
    phone: string;
    subject: string;
    message: string;
    createdAt: string;
}

// Yêu cầu đặt bàn gửi từ trang /reservation — admin xem qua GET /reservations.
export interface Reservation {
    _id: string;
    username: string;
    customerName: string;
    phone: string;
    date: string;
    time: string;
    guestCount: number;
    note: string;
    createdAt: string;
}
