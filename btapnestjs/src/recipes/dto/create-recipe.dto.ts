import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsEmail,
  IsNumber,
  IsOptional,
  IsString,
  MinLength,
  ValidateNested,
} from 'class-validator';

export class IngredientDto {
  @IsString()
  name: string;

  @IsNumber()
  quantity: number;

  @IsString()
  unit: string;
}

export class CreateRecipeDto {
  @IsString()
  @MinLength(3, { message: 'Tên món phải có ít nhất 3 ký tự' })
  name: string;

  @IsString()
  @MinLength(10, { message: 'Mô tả phải có ít nhất 10 ký tự' })
  description: string;

  // Không đặt giá trị mặc định (= []) ngay trên field: PartialType (dùng cho UpdateRecipeDto)
  // sẽ khởi tạo field đó bằng giá trị mặc định dù người dùng không gửi lên, ghi đè mất dữ liệu cũ khi PATCH.
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IngredientDto)
  ingredients?: IngredientDto[];

  @IsOptional()
  @IsString()
  imgUrl?: string;

  @IsOptional()
  @IsNumber()
  price?: number;

  @IsOptional()
  @IsBoolean()
  isFavorite?: boolean;

  @IsEmail({}, { message: 'Email tác giả không hợp lệ' })
  authorEmail: string;
}
