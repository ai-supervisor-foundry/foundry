import { BadRequestException, ConflictException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UsersService } from './users.service';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { PasswordService } from '../auth/password/password.service';

describe('UsersService', () => {
  let service: UsersService;
  let repo: jest.Mocked<Repository<User>>;
  let passwordService: jest.Mocked<PasswordService>;

  const mockUser = {
    id: 1,
    email: 'a@b.com',
    name: 'Test',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    passwordMatch: jest.fn().mockReturnValue(true),
  };

  beforeEach(async () => {
    repo = {
      findOne: jest.fn(),
      findOneBy: jest.fn(),
      create: jest.fn((o) => ({ ...o })),
      save: jest.fn((e) => Promise.resolve({ ...e, id: 1 })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
      softRemove: jest.fn().mockResolvedValue({}),
    } as any;
    passwordService = {
      validatePasswordStrength: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
      hashPassword: jest.fn().mockResolvedValue('hashed'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UsersService,
        { provide: getRepositoryToken(User), useValue: repo },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get(UsersService);
  });

  describe('createUser', () => {
    it('should create user with hashed password', async () => {
      repo.findOne.mockResolvedValue(null);

      const result = await service.createUser({
        email: 'new@b.com',
        name: 'New',
        password: 'Test123!',
      });

      expect(result).toBeDefined();
      expect(passwordService.hashPassword).toHaveBeenCalledWith('Test123!');
      expect(repo.save).toHaveBeenCalled();
    });

    it('should throw when email exists', async () => {
      repo.findOne.mockResolvedValue(mockUser as any);

      await expect(
        service.createUser({
          email: 'a@b.com',
          name: 'X',
          password: 'Test123!',
        }),
      ).rejects.toThrow(ConflictException);
    });
  });

  describe('updateUserById', () => {
    it('should throw when user not found', async () => {
      repo.findOneBy.mockResolvedValue(null);

      await expect(service.updateUserById(999, { name: 'X' })).rejects.toThrow(
        BadRequestException,
      );
    });

    it('should update user', async () => {
      repo.findOneBy.mockResolvedValue({ ...mockUser } as any);
      repo.findOne.mockResolvedValue(null);

      await service.updateUserById(1, { name: 'Updated' });

      expect(repo.save).toHaveBeenCalled();
    });
  });
});
