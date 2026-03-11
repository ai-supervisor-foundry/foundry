import {
  BadRequestException,
  ConflictException,
  Injectable,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  DeepPartial,
  FindManyOptions,
  FindOneOptions,
  Repository,
} from 'typeorm';
import { User, UserRole, UserStatus } from './entities/user.entity';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PasswordService } from '../auth/password/password.service';

@Injectable()
export class UsersService {
  constructor(
    @InjectRepository(User)
    private readonly usersRepository: Repository<User>,
    private readonly passwordService: PasswordService,
  ) {}

  async create(user: DeepPartial<User>) {
    return this.usersRepository.save(this.usersRepository.create(user));
  }

  async createUser(dto: CreateUserDto): Promise<User> {
    const strength = this.passwordService.validatePasswordStrength(
      dto.password,
    );
    if (!strength.valid) {
      throw new BadRequestException(
        strength.errors?.join('; ') ?? 'Weak password',
      );
    }
    const existing = await this.usersRepository.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.passwordService.hashPassword(dto.password);
    if (dto.managerId != null) {
      const managerExists = await this.usersRepository.findOneBy({
        id: dto.managerId,
      });
      if (!managerExists) {
        throw new BadRequestException('Manager user not found');
      }
    }
    const user = this.usersRepository.create({
      email: dto.email,
      name: dto.name,
      password: passwordHash,
      role: dto.role ?? UserRole.USER,
      status: UserStatus.ACTIVE,
      position: dto.position ?? null,
      managerId: dto.managerId ?? null,
    });
    return this.usersRepository.save(user);
  }

  async find(options?: FindManyOptions<User>) {
    const relations = Array.isArray(options?.relations)
      ? [...options.relations, 'manager']
      : ['manager'];
    const order = options?.order ?? { name: 'ASC' };
    return this.usersRepository.find({ ...options, relations, order });
  }

  async findById(id: number) {
    return this.usersRepository.findOneBy({ id });
  }

  async findOne(options: FindOneOptions<User>) {
    return this.usersRepository.findOne(options);
  }

  async update(id: number, user: DeepPartial<User>) {
    return this.usersRepository.update({ id: id }, user);
  }

  async updateUserById(id: number, dto: UpdateUserDto): Promise<User> {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (dto.email !== undefined) {
      const trimmed = dto.email.trim();
      if (!trimmed) {
        throw new BadRequestException('Email is required');
      }
      if (trimmed.length > 100) {
        throw new BadRequestException('Email must be 100 characters or less');
      }
      const existing = await this.usersRepository.findOne({
        where: { email: trimmed },
      });
      if (existing && existing.id !== id) {
        throw new ConflictException('Email already registered');
      }
      user.email = trimmed;
    }
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.name !== undefined && !user.name) {
      throw new BadRequestException('Name is required');
    }
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.position !== undefined)
      user.position = dto.position?.trim() || null;
    if (dto.managerId !== undefined) {
      const newManagerId = dto.managerId ?? null;
      if (newManagerId !== null && newManagerId === id) {
        throw new BadRequestException('User cannot be their own manager');
      }
      if (newManagerId !== null) {
        const managerExists = await this.usersRepository.findOneBy({
          id: newManagerId,
        });
        if (!managerExists) {
          throw new BadRequestException('Manager user not found');
        }
      }
      user.managerId = newManagerId;
    }
    return this.usersRepository.save(user);
  }

  async remove(id: number) {
    return this.usersRepository.softRemove({ id: id });
  }

  async changePassword(id: number, oldPassword: string, newPassword: string) {
    const user = await this.usersRepository.findOneBy({ id });
    if (!user) {
      throw new BadRequestException('User not found');
    }
    if (!user.passwordMatch(oldPassword)) {
      throw new BadRequestException('Old password is not correct');
    }
    user.password = newPassword;
    return this.usersRepository.save(user);
  }
}
