import { Directive, ElementRef, HostListener, Optional, Self } from '@angular/core';
import { NgControl } from '@angular/forms';

// Hai nguồn khiến FormControl bị "lệch" khỏi giá trị thật hiện trên input, dù mắt vẫn thấy chữ:
// 1) Autofill/trình quản lý mật khẩu gán thẳng .value mà KHÔNG bắn sự kiện 'input'.
// 2) Gõ tiếng Việt có dấu qua IME (Unikey, Telex, VNI...) — một số trình duyệt/bàn phím bắn sự
//    kiện 'input' với giá trị tạm thời trong lúc đang ghép dấu, chỉ chốt giá trị cuối cùng khi
//    'compositionend' bắn ra, khiến control giữ giá trị cũ (rỗng) và báo lỗi "bắt buộc nhập" sai
//    ngay khi người dùng đang gõ dở.
// 'change' bắt case (1) khi mất focus; 'compositionend' bắt case (2) ngay khi vừa gõ xong một
// cụm có dấu, không cần đợi blur.
@Directive({
  selector: 'input[formControlName], input[formControl]',
})
export class AutofillSyncDirective {
  constructor(
    @Optional() @Self() private readonly ngControl: NgControl | null,
    private readonly el: ElementRef<HTMLInputElement>,
  ) {}

  @HostListener('change')
  @HostListener('compositionend')
  protected sync(): void {
    const control = this.ngControl?.control;
    if (!control) {
      return;
    }
    const domValue = this.el.nativeElement.value;
    if (control.value !== domValue) {
      control.setValue(domValue);
    }
  }
}
