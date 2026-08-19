import { IsIn } from 'class-validator';

export class ChangeRoleDto {
  @IsIn(['user', 'admin'])
  role: 'user' | 'admin';
}
