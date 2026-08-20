import { ChangeDetectionStrategy, Component, ElementRef, inject, signal, viewChild } from '@angular/core';
import { MAT_DIALOG_DATA, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSliderModule } from '@angular/material/slider';
import {
  ImageCroppedEvent,
  ImageCropperComponent,
  ImageTransform,
  LoadedImage,
} from 'ngx-image-cropper';

export interface AvatarCropDialogData {
  file: File;
}

const MIN_ZOOM = 1;
const MAX_ZOOM = 3;
const MIN_WRAPPER_HEIGHT = 220;
const MAX_WRAPPER_HEIGHT = 480;
const DEFAULT_WRAPPER_HEIGHT = 320;

// Dialog cắt ảnh đại diện: người dùng kéo để căn khung vuông, dùng thanh trượt để phóng to/thu
// nhỏ trước khi xác nhận — chỉ đóng vai trò xử lý ảnh cục bộ (không tự upload), trả về Blob đã
// cắt qua afterClosed() để nơi gọi (ProfilePage) tự upload như bình thường.
@Component({
  selector: 'app-avatar-crop-dialog',
  imports: [MatDialogModule, MatButtonModule, MatIconModule, MatSliderModule, ImageCropperComponent],
  templateUrl: './avatar-crop-dialog.html',
  styleUrl: './avatar-crop-dialog.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AvatarCropDialog {
  protected readonly dialogRef = inject(MatDialogRef<AvatarCropDialog>);
  protected readonly data = inject<AvatarCropDialogData>(MAT_DIALOG_DATA);

  protected readonly minZoom = MIN_ZOOM;
  protected readonly maxZoom = MAX_ZOOM;

  protected readonly imageReady = signal(false);
  protected readonly loadError = signal(false);
  protected readonly zoom = signal(MIN_ZOOM);
  protected readonly transform = signal<ImageTransform>({ scale: MIN_ZOOM });
  protected readonly wrapperHeight = signal(DEFAULT_WRAPPER_HEIGHT);

  private readonly wrapper = viewChild<ElementRef<HTMLDivElement>>('wrapper');

  private croppedBlob: Blob | null = null;

  // Khung crop mặc định (320px) chỉ vừa khít với ảnh có tỉ lệ gần đúng — ảnh rộng/hẹp hơn để lại
  // khoảng trống thừa vì thư viện chỉ scale ảnh vừa khung theo tỉ lệ gốc chứ không lấp đầy. Tính lại
  // chiều cao khung khớp đúng tỉ lệ ảnh thật (theo chiều rộng khung cố định) để ảnh luôn lấp đầy,
  // giới hạn trong khoảng min/max để tránh dialog quá cao/thấp với ảnh tỉ lệ bất thường.
  protected onImageLoaded(image: LoadedImage): void {
    const wrapperWidth = this.wrapper()?.nativeElement.clientWidth;
    const { width: imgWidth, height: imgHeight } = image.transformed.size;
    if (wrapperWidth && imgWidth && imgHeight) {
      const fittedHeight = Math.round(wrapperWidth / (imgWidth / imgHeight));
      this.wrapperHeight.set(
        Math.min(MAX_WRAPPER_HEIGHT, Math.max(MIN_WRAPPER_HEIGHT, fittedHeight)),
      );
    }
    this.imageReady.set(true);
  }

  protected onLoadImageFailed(): void {
    this.loadError.set(true);
  }

  protected onImageCropped(event: ImageCroppedEvent): void {
    this.croppedBlob = event.blob ?? null;
  }

  protected onZoomChange(value: number): void {
    this.zoom.set(value);
    this.transform.set({ ...this.transform(), scale: value });
  }

  protected confirm(): void {
    if (!this.croppedBlob) {
      return;
    }
    this.dialogRef.close(this.croppedBlob);
  }

  protected cancel(): void {
    this.dialogRef.close(null);
  }
}
