import { Test, TestingModule } from '@nestjs/testing';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AuthenticatedRequest } from './auth/types/auth-user.interface';

describe('AppController', () => {
  let appController: AppController;

  beforeEach(async () => {
    const app: TestingModule = await Test.createTestingModule({
      controllers: [AppController],
      providers: [AppService],
    }).compile();

    appController = app.get<AppController>(AppController);
  });

  describe('getProfile', () => {
    it("should return the request's user", () => {
      const req = {
        user: { userId: '1', username: 'test', role: 'user' },
      } as AuthenticatedRequest;

      expect(appController.getProfile(req)).toBe(req.user);
    });
  });
});
