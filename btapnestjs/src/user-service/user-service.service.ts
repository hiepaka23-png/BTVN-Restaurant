import { Injectable } from '@nestjs/common';
import { CreateUserServiceDto } from './dto/create-user-service.dto';
import { UpdateUserServiceDto } from './dto/update-user-service.dto';

@Injectable()
export class UserServiceService {
  private readonly users: CreateUserServiceDto[] = [];

  create(createUserServiceDto: CreateUserServiceDto) {
    this.users.push(createUserServiceDto);
    return 'This action adds a new userService';
  }

  findAll() {
    return `This action returns all userService`;
  }

  findOne(id: number) {
    return `This action returns a #${id} userService`;
  }

  update(id: number, updateUserServiceDto: UpdateUserServiceDto) {
    this.users[id] = { ...this.users[id], ...updateUserServiceDto };
    return `This action updates a #${id} userService`;
  }

  remove(id: number) {
    this.users.splice(id, 1);
    return `This action removes a #${id} userService`;
  }
}
