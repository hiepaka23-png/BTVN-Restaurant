import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
} from '@nestjs/common';
import { UserServiceService } from './user-service.service';
import { CreateUserServiceDto } from './dto/create-user-service.dto';
import { UpdateUserServiceDto } from './dto/update-user-service.dto';

@Controller('user-service')
export class UserServiceController {
  constructor(private readonly userServiceService: UserServiceService) {}

  @Post()
  create(@Body() createUserServiceDto: CreateUserServiceDto) {
    return this.userServiceService.create(createUserServiceDto);
  }

  @Get()
  findAll() {
    return this.userServiceService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    const user = this.userServiceService.findOne(+id);
    if (!user) {
      throw new Error('user not found');
    }
    return user;
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateUserServiceDto: UpdateUserServiceDto,
  ) {
    const user = this.userServiceService.findOne(+id);
    if (!user) {
      throw new Error('user not found');
    }
    return this.userServiceService.update(+id, updateUserServiceDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    const user = this.userServiceService.findOne(+id);
    if (!user) {
      throw new Error('user not found');
    }
    return this.userServiceService.remove(+id);
  }
}
