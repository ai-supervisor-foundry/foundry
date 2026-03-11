import {
  UnauthorizedException,
  ConflictException,
  BadRequestException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { JwtService } from '@nestjs/jwt';
import { AuthService } from './auth.service';
import { UsersService } from '../users/users.service';
import { PasswordService } from './password/password.service';
import { UserRole, UserStatus } from '../users/entities/user.entity';

describe('AuthService', () => {
  let service: AuthService;
  let userService: jest.Mocked<UsersService>;
  let jwtService: jest.Mocked<JwtService>;
  let passwordService: jest.Mocked<PasswordService>;

  const mockUser = {
    id: 1,
    email: 'a@b.com',
    name: 'Test',
    role: UserRole.USER,
    status: UserStatus.ACTIVE,
    password: 'hashed',
  };

  beforeEach(async () => {
    userService = {
      findOne: jest.fn(),
      create: jest.fn(),
    } as any;
    jwtService = { signAsync: jest.fn().mockResolvedValue('token') } as any;
    passwordService = {
      verifyPassword: jest.fn(),
      validatePasswordStrength: jest
        .fn()
        .mockReturnValue({ valid: true, errors: [] }),
      hashPassword: jest.fn().mockResolvedValue('hashed'),
    } as any;

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: UsersService, useValue: userService },
        { provide: JwtService, useValue: jwtService },
        { provide: PasswordService, useValue: passwordService },
      ],
    }).compile();

    service = module.get(AuthService);
  });

  describe('login', () => {
    it('should return token and user on valid credentials', async () => {
      userService.findOne.mockResolvedValue(mockUser as any);
      passwordService.verifyPassword.mockResolvedValue(true);

      const result = await service.login({
        email: 'a@b.com',
        password: 'Test123!',
      });

      expect(result.accessToken).toBe('token');
      expect(result.user).toBeDefined();
      expect(result.user.password).toBeUndefined();
    });

    it('should throw when user not found', async () => {
      userService.findOne.mockResolvedValue(null);

      await expect(
        service.login({ email: 'x@y.com', password: 'Test123!' }),
      ).rejects.toThrow(UnauthorizedException);
    });

    it('should throw when password invalid', async () => {
      userService.findOne.mockResolvedValue(mockUser as any);
      passwordService.verifyPassword.mockResolvedValue(false);

      await expect(
        service.login({ email: 'a@b.com', password: 'Wrong' }),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('signup', () => {
    it('should create user and return token', async () => {
      userService.findOne.mockResolvedValue(null);
      userService.create.mockResolvedValue(mockUser as any);

      const result = await service.signup({
        email: 'new@b.com',
        name: 'New',
        password: 'Test123!',
      });

      expect(result.accessToken).toBe('token');
      expect(userService.create).toHaveBeenCalled();
    });

    it('should throw when email already exists', async () => {
      userService.findOne.mockResolvedValue(mockUser as any);

      await expect(
        service.signup({ email: 'a@b.com', name: 'X', password: 'Test123!' }),
      ).rejects.toThrow(ConflictException);
    });

    it('should throw when password weak', async () => {
      passwordService.validatePasswordStrength.mockReturnValue({
        valid: false,
        errors: ['Too short'],
      });

      await expect(
        service.signup({ email: 'new@b.com', name: 'X', password: 'weak' }),
      ).rejects.toThrow(BadRequestException);
    });
  });
});
