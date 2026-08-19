import {
  BadRequestException,
  Controller,
  Post,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname } from 'path';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/gif',
];
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB

const imageFileFilter = (
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, acceptFile: boolean) => void,
) => {
  if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
    callback(
      new BadRequestException('Chỉ chấp nhận file ảnh (JPG, PNG, WEBP, GIF)'),
      false,
    );
    return;
  }
  callback(null, true);
};

const uniqueFilename = (
  _req: unknown,
  file: Express.Multer.File,
  callback: (error: Error | null, filename: string) => void,
) => {
  const uniqueSuffix = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
  callback(null, `${uniqueSuffix}${extname(file.originalname)}`);
};

@UseGuards(JwtAuthGuard)
@Controller('uploads')
export class UploadsController {
  // Chỉ admin mới được tải ảnh món ăn (dùng cho ảnh trong Thêm/Sửa công thức).
  @UseGuards(RolesGuard)
  @Roles('admin')
  @Post('image')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/uploads',
        filename: uniqueFilename,
      }),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  uploadImage(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }
    return { url: `/uploads/${file.filename}` };
  }

  // Mọi user đã đăng nhập đều được tải ảnh đại diện của chính mình (FE-12).
  @Post('avatar')
  @UseInterceptors(
    FileInterceptor('file', {
      storage: diskStorage({
        destination: './public/uploads/avatars',
        filename: uniqueFilename,
      }),
      fileFilter: imageFileFilter,
      limits: { fileSize: MAX_FILE_SIZE_BYTES },
    }),
  )
  uploadAvatar(@UploadedFile() file: Express.Multer.File) {
    if (!file) {
      throw new BadRequestException('Không có file nào được tải lên');
    }
    return { url: `/uploads/avatars/${file.filename}` };
  }
}
