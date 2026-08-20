import { Injectable, Logger } from '@nestjs/common';
import { readFile } from 'node:fs/promises';
import * as tf from '@tensorflow/tfjs';
import { load as loadNsfwModel, NSFWJS, PredictionType } from 'nsfwjs';
import * as cocoSsd from '@tensorflow-models/coco-ssd';
import { Jimp } from 'jimp';

export type NsfwCheckContext = 'avatar' | 'recipe';

// Ngưỡng xác suất để coi 1 ảnh là vi phạm — tách riêng theo ngữ cảnh:
// - avatar: bất kỳ user nào cũng tự đặt được, không được kiểm duyệt trước bởi ai khác -> siết
//   chặt, kể cả "Sexy" (khoe thân/gợi cảm, cả nam cởi trần lẫn nữ hở da thịt nhiều).
// - recipe: chỉ admin (đã tin cậy) mới tải được -> bỏ nhãn "Sexy" (chỉ chặn Porn/Hentai rõ ràng).
const NSFW_THRESHOLDS: Record<
  NsfwCheckContext,
  Partial<Record<PredictionType['className'], number>>
> = {
  avatar: {
    Porn: 0.6,
    Hentai: 0.6,
    Sexy: 0.5,
  },
  recipe: {
    Porn: 0.6,
    Hentai: 0.6,
  },
};

// Chỉ coi là "có người trong ảnh" khi độ tự tin của coco-ssd đạt ngưỡng này trở lên.
const PERSON_DETECTION_MIN_SCORE = 0.4;

// Kiểm duyệt ảnh khoả thân/khiêu dâm khi upload — chạy cục bộ, không gọi dịch vụ ngoài nên không
// tốn phí và không lộ ảnh người dùng ra bên thứ ba. Mục tiêu chỉ là chặn nội dung khoả thân/khiêu
// dâm của CON NGƯỜI (cả nam lẫn nữ) — ảnh động vật, đồ ăn, đồ vật... dù trông "nhạy cảm" thế nào
// (thịt, nội tạng...) cũng không bị chặn. Vì vậy làm 2 bước:
//   1. coco-ssd: có phát hiện người ("person") trong ảnh không? Không có người -> an toàn, bỏ qua
//      luôn bước 2, không đoán mò qua threshold nữa.
//   2. Chỉ khi CÓ người mới chạy tiếp nsfwjs (MobileNetV2) để phân loại mức độ khoả thân/khiêu dâm.
@Injectable()
export class NsfwService {
  private readonly logger = new Logger(NsfwService.name);
  private nsfwModelPromise: Promise<NSFWJS> | null = null;
  private personModelPromise: Promise<cocoSsd.ObjectDetection> | null = null;
  private webpDecoderPromise: Promise<
    (data: ArrayBuffer) => Promise<{ width: number; height: number; data: Uint8ClampedArray }>
  > | null = null;

  // Gói "jimp" mặc định KHÔNG đọc được WEBP (chỉ có JPEG/PNG/BMP/GIF/TIFF) — trong khi form tải
  // ảnh ở frontend lại chấp nhận WEBP, nên ảnh WEBP trước đây luôn bị báo nhầm "không đọc được
  // ảnh". Giải mã WEBP riêng bằng @jsquash/webp (bộ giải mã libwebp biên dịch ra WASM) thay vì
  // Jimp — nhưng KHÔNG dùng flow mặc định của thư viện (nó tự fetch() file .wasm, mà fetch() của
  // Node không đọc được đường dẫn cục bộ "file://" nên luôn báo lỗi "fetch failed") — mà tự đọc
  // file .wasm từ node_modules rồi biên dịch/khởi tạo module thủ công 1 lần, dùng lại cho mọi ảnh
  // WEBP sau đó.
  private async getWebpDecoder() {
    if (!this.webpDecoderPromise) {
      this.webpDecoderPromise = (async () => {
        const { default: decode, init } = await import('@jsquash/webp/decode.js');
        const wasmPath = require.resolve('@jsquash/webp/codec/dec/webp_dec.wasm');
        const wasmModule = await WebAssembly.compile(await readFile(wasmPath));
        await init(wasmModule);
        return decode;
      })();
    }
    return this.webpDecoderPromise;
  }

  private async readImageBitmap(
    filePath: string,
  ): Promise<{ width: number; height: number; data: Buffer }> {
    if (filePath.toLowerCase().endsWith('.webp')) {
      const decode = await this.getWebpDecoder();
      const fileBuffer = await readFile(filePath);
      const imageData = await decode(
        fileBuffer.buffer.slice(fileBuffer.byteOffset, fileBuffer.byteOffset + fileBuffer.byteLength),
      );
      return { width: imageData.width, height: imageData.height, data: Buffer.from(imageData.data) };
    }
    const image = await Jimp.read(filePath);
    return image.bitmap;
  }

  private getNsfwModel(): Promise<NSFWJS> {
    if (!this.nsfwModelPromise) {
      this.nsfwModelPromise = loadNsfwModel();
    }
    return this.nsfwModelPromise;
  }

  private getPersonModel(): Promise<cocoSsd.ObjectDetection> {
    if (!this.personModelPromise) {
      this.personModelPromise = cocoSsd.load();
    }
    return this.personModelPromise;
  }

  /**
   * Trả về null nếu ảnh an toàn, hoặc thông báo lỗi (tiếng Việt) nếu ảnh vi phạm / không kiểm
   * duyệt được (ví dụ định dạng không đọc được).
   */
  async checkImage(
    filePath: string,
    context: NsfwCheckContext,
  ): Promise<string | null> {
    let bitmap: { width: number; height: number; data: Buffer };
    try {
      bitmap = await this.readImageBitmap(filePath);
    } catch (error) {
      this.logger.warn(`Không đọc được ảnh để kiểm duyệt: ${filePath}`, error);
      return 'Không đọc được ảnh này để kiểm duyệt, vui lòng dùng ảnh định dạng JPG hoặc PNG.';
    }

    const { width, height, data } = bitmap;
    const numPixels = width * height;
    const rgb = new Int32Array(numPixels * 3);
    for (let i = 0; i < numPixels; i++) {
      rgb[i * 3] = data[i * 4];
      rgb[i * 3 + 1] = data[i * 4 + 1];
      rgb[i * 3 + 2] = data[i * 4 + 2];
    }
    const tensor = tf.tensor3d(rgb, [height, width, 3], 'int32');

    try {
      const personModel = await this.getPersonModel();
      const detections = await personModel.detect(tensor);
      const hasPerson = detections.some(
        (d) => d.class === 'person' && d.score >= PERSON_DETECTION_MIN_SCORE,
      );
      if (!hasPerson) {
        // Không có người trong ảnh -> không thuộc phạm vi kiểm duyệt (ảnh động vật, đồ ăn, đồ
        // vật... đều được phép dù trông thế nào).
        return null;
      }

      const nsfwModel = await this.getNsfwModel();
      const predictions = await nsfwModel.classify(tensor);
      const thresholds = NSFW_THRESHOLDS[context];
      const flagged = predictions.find((p) => {
        const threshold = thresholds[p.className];
        return threshold !== undefined && p.probability >= threshold;
      });

      if (flagged) {
        this.logger.warn(
          `Chặn ảnh nghi vấn nội dung nhạy cảm (${context}): ${filePath} — ${flagged.className} (${(flagged.probability * 100).toFixed(1)}%)`,
        );
        return 'Ảnh này chứa nội dung khoả thân/khiêu dâm, không được phép tải lên.';
      }
      return null;
    } finally {
      tensor.dispose();
    }
  }
}
