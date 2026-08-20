import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { PromoCode } from '../models';
import { PromoService } from '../promo-service';
import { ToastService } from '../toast-service';
import { GiftRewardDialog } from '../gift-reward-dialog/gift-reward-dialog';

const GIFT_BOX_COUNT = 5;

// Minigame "Hộp Quà May Mắn": 5 hộp quà, mở 1 hộp nhận 1 mã giảm giá % (10/15/20/50%, có trọng số
// — xem DISCOUNT_TIERS ở PromoCodesService phía backend). Mã được SINH VÀ KHOÁ Ở SERVER, giới hạn
// 1 lượt mở/ngày (kể cả khi chạy `ng serve` — cố tình KHÔNG bỏ qua giới hạn ở dev mode nữa) và
// trạng thái "đã nhận quà hôm nay" đều lấy từ backend (GET/POST /promo-codes) — không còn random
// thuần + lưu localStorage như bản đầu, nên không thể lách bằng cách xoá localStorage/đổi trình
// duyệt, và mã trúng dùng thật được ở bước đặt hàng (xem cart.ts).
@Component({
  selector: 'app-lucky-gift',
  imports: [CommonModule, MatDialogModule, MatButtonModule, MatIconModule],
  templateUrl: './lucky-gift.html',
  styleUrl: './lucky-gift.css',
})
export class LuckyGift implements OnInit {
  private readonly promoService = inject(PromoService);
  private readonly dialog = inject(MatDialog);
  private readonly toast = inject(ToastService);
  private readonly panelRef = inject(MatDialogRef<LuckyGift>);

  protected readonly boxIndexes = Array.from({ length: GIFT_BOX_COUNT }, (_, i) => i);
  protected readonly openingIndex = signal<number | null>(null);
  protected readonly claimed = signal<PromoCode | null>(null);
  protected readonly loadingToday = signal(true);
  protected readonly isLocked = computed(
    () => this.claimed() !== null || this.openingIndex() !== null,
  );

  ngOnInit(): void {
    this.promoService
      .getToday()
      .then((promo) => {
        if (promo) {
          this.claimed.set(promo);
        }
      })
      .catch(() => {})
      .finally(() => this.loadingToday.set(false));
  }

  protected async openBox(index: number): Promise<void> {
    if (this.isLocked()) {
      return;
    }
    this.openingIndex.set(index);

    try {
      // Chờ đúng thời lượng hiệu ứng mở nắp (khớp với CSS) song song với gọi API — để người dùng
      // kịp thấy animation trước khi popup hiện ra, không phải đợi cộng dồn cả 2 thời gian.
      const [claimedGift] = await Promise.all([
        this.promoService.claimDaily(),
        new Promise((resolve) => setTimeout(resolve, 650)),
      ]);
      this.claimed.set(claimedGift);

      // Đóng khung chọn hộp quà trước khi mở popup phần thưởng — tránh 2 lớp dialog chồng lên nhau
      // cùng lúc (khung viền chấm của khung chọn hộp vẫn hiện mờ phía sau popup, nhìn rối).
      this.panelRef.close();

      const dialogRef = this.dialog.open(GiftRewardDialog, {
        panelClass: 'brand-dialog-panel',
        data: claimedGift,
      });
      const applied = await firstValueFrom(dialogRef.afterClosed());
      if (applied) {
        this.copyCode(claimedGift.code);
      }
    } catch {
      this.openingIndex.set(null);
      this.toast.show('Không mở được hộp quà, vui lòng thử lại.');
    }
  }

  protected closePanel(): void {
    this.panelRef.close();
  }

  protected async copyCode(code: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(code);
      this.toast.show(`Đã sao chép mã ${code} — dùng khi đặt món nhé!`);
    } catch {
      this.toast.show(`Mã ưu đãi của bạn: ${code}`, 'Thông báo', 5000);
    }
  }
}
