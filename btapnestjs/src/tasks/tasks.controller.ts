import {
  Controller,
  Get,
  Post,
  Patch,
  Param,
  Body,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { TasksService } from './tasks.service';
import type { task } from './task.model';

@Controller('tasks')
export class TasksController {
  constructor(private readonly tasksService: TasksService) {}

  @Get()
  getAllTasks(): task[] {
    return this.tasksService.getAllTasks();
  }
  @Post()
  @HttpCode(HttpStatus.CREATED)
  createTask(@Body('title') title: string): task {
    return this.tasksService.createTask(title);
  }
  @Get(':id')
  getTaskById(@Param('id') id: string): task {
    return this.tasksService.getTaskById(id);
  }
  @Patch(':id/done')
  maskAsDone(@Param('id') id: string): task {
    return this.tasksService.maskAsDone(id);
  }
}
