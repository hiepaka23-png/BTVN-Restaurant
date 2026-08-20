import { IsNotEmpty, IsString } from 'class-validator';

export class ConfirmDeleteAccountDto {
  @IsString()
  @IsNotEmpty()
  token: string;
}
