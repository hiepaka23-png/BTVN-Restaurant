import { Routes } from '@angular/router';
import { authGuard, adminGuard } from './auth-guard';

// Toàn bộ route dùng loadComponent (lazy) thay vì import tĩnh ở đầu file — mỗi trang chỉ được tải
// khi thật sự điều hướng tới, giảm kích thước bundle ban đầu.
//
// Lưu ý bảo mật (đề bài FE-01 — chống directory traversal qua đường dẫn): route '**' ở cuối cùng
// LUÔN phải được giữ lại. Angular Router chỉ khớp các route đã khai báo tường minh ở trên, nên bất
// kỳ đường dẫn lạ/độc hại nào (kể cả có '../', '%2e%2e', v.v.) đều rơi vào route bắt-tất-cả này
// thay vì được trình duyệt/route resolver diễn giải thành một đường dẫn hệ thống tệp thật.
export const routes: Routes = [
    { path: 'login', loadComponent: () => import('./auth-page/auth-page').then((m) => m.AuthPage) },

    // Xem danh sách/chi tiết: cần đăng nhập, không có thao tác quản trị nào ở đây (AD-09 — CRUD
    // recipe chỉ tồn tại ở khu vực /admin/recipes, tách bạch hoàn toàn khỏi trang xem của user).
    {
        path: 'recipes',
        loadComponent: () => import('./recipe-list/recipe-list').then((m) => m.RecipeList),
        canActivate: [authGuard],
    },
    {
        path: 'recipes/:id',
        loadComponent: () => import('./recipe-detail/recipe-detail').then((m) => m.RecipeDetail),
        canActivate: [authGuard],
    },

    // Các mục điều hướng trong menu 3 gạch
    {
        path: 'reservation',
        loadComponent: () => import('./reservation/reservation').then((m) => m.ReservationPage),
        canActivate: [authGuard],
    },
    {
        path: 'careers',
        loadComponent: () => import('./careers/careers').then((m) => m.CareersPage),
        canActivate: [authGuard],
    },
    {
        path: 'contact',
        loadComponent: () => import('./contact/contact').then((m) => m.ContactPage),
        canActivate: [authGuard],
    },
    {
        path: 'cart',
        loadComponent: () => import('./cart/cart').then((m) => m.CartPage),
        canActivate: [authGuard],
    },

    // Tài khoản cá nhân
    {
        path: 'profile',
        loadComponent: () => import('./profile/profile').then((m) => m.ProfilePage),
        canActivate: [authGuard],
    },
    {
        path: 'orders',
        loadComponent: () => import('./my-orders/my-orders').then((m) => m.MyOrdersPage),
        canActivate: [authGuard],
    },

    // Khu vực quản trị — mỗi route đều canActivate: [authGuard, adminGuard]
    {
        path: 'admin/orders',
        loadComponent: () => import('./admin/admin-orders/admin-orders').then((m) => m.AdminOrdersPage),
        canActivate: [authGuard, adminGuard],
    },
    {
        path: 'admin/dashboard',
        loadComponent: () =>
            import('./admin/admin-dashboard/admin-dashboard').then((m) => m.AdminDashboardPage),
        canActivate: [authGuard, adminGuard],
    },
    {
        path: 'admin/members',
        loadComponent: () => import('./admin/admin-members/admin-members').then((m) => m.AdminMembersPage),
        canActivate: [authGuard, adminGuard],
    },
    {
        path: 'admin/recipes',
        loadComponent: () => import('./admin/admin-recipes/admin-recipes').then((m) => m.AdminRecipesPage),
        canActivate: [authGuard, adminGuard],
    },
    {
        path: 'admin/recipes/new',
        loadComponent: () => import('./add-recipe/add-recipe').then((m) => m.AddRecipe),
        canActivate: [authGuard, adminGuard],
        data: { returnTo: '/admin/recipes' },
    },
    {
        path: 'admin/recipes/:id/edit',
        loadComponent: () => import('./add-recipe/add-recipe').then((m) => m.AddRecipe),
        canActivate: [authGuard, adminGuard],
        data: { returnTo: '/admin/recipes' },
    },

    // Mặc định khi mở web ('') sẽ nhảy thẳng vào 'login'
    { path: '', redirectTo: 'login', pathMatch: 'full' },

    // Nếu gõ đường dẫn linh tinh bất kỳ -> Cũng quay về 'login'
    { path: '**', redirectTo: 'login' },
];
