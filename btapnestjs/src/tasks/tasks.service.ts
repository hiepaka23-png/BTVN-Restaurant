import { Injectable, NotFoundException } from '@nestjs/common';
import { task } from './task.model';

@Injectable()
export class TasksService {
  private tasks: task[] = [];

  getAllTasks(): task[] {
    return this.tasks;
  }

  getTaskById(id: string): task {
    const task = this.tasks.find((t) => t.id === id);
    if (!task) throw new NotFoundException(`Task ${id} not found`);
    return task;
  }

  createTask(title: string): task {
    const newTask: task = {
      id: Date.now().toString(),
      title,
      done: false,
    };
    this.tasks.push(newTask);
    return newTask;
  }

  maskAsDone(id: string): task {
    const task = this.getTaskById(id);
    task.done = true;
    return task;
  }
}
