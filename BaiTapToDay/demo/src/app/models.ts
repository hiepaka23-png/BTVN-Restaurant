export interface Ingredient {
    name: string;
    quantity: number;
    unit: string;
}

export interface RecipeModel {
    id: number;
    name: string;
    description: string;
    ingredients: Ingredient[];
    imgUrl: string;
    price: number;
    isFavorite: boolean;
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
    createdAt: string;
    updatedAt: string;
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
