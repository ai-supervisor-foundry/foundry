import { Injectable } from '@nestjs/common';
import { compareSync, hashSync } from 'bcrypt';
import { stubStore, StubUser } from './stub-store';
import { User, UserRole, UserStatus } from '../../../src/modules/users/entities/user.entity';
import { CreateUserDto } from '../../../src/modules/users/dto/create-user.dto';
import { UpdateUserDto } from '../../../src/modules/users/dto/update-user.dto';
import { PasswordService } from '../../../src/modules/auth/password/password.service';

function toUser(row: StubUser): User {
  const u = {
    ...row,
    role: row.role as UserRole,
    status: row.status as UserStatus,
    passwordMatch(plain: string) {
      return plain && row.password ? compareSync(plain, row.password) : false;
    },
  } as User;
  return u;
}

@Injectable()
export class StubUsersService {
  constructor(private readonly passwordService: PasswordService) {}

  async create(partial: Partial<User>) {
    const id = stubStore.nextUserId++;
    const hashed = partial.password
      ? (typeof partial.password === 'string' && partial.password.startsWith('$2')
          ? partial.password
          : hashSync(partial.password as string, 10))
      : undefined;
    const row: StubUser = {
      id,
      email: partial.email!,
      name: partial.name!,
      password: hashed,
      role: (partial.role as string) ?? 'USER',
      status: (partial.status as string) ?? 'active',
      position: partial.position ?? null,
    };
    stubStore.users.set(id, row);
    return toUser(row);
  }

  async findOne(options: { where?: { email?: string; id?: number } }) {
    const w = options?.where;
    if (!w) return null;
    let found: StubUser | undefined;
    if (w.email) found = [...stubStore.users.values()].find((u) => u.email === w.email);
    else if (w.id) found = stubStore.users.get(w.id);
    return found ? toUser(found) : null;
  }

  async findOneBy(where: { id: number }) {
    const found = stubStore.users.get(where.id);
    return found ? toUser(found) : null;
  }

  async find() {
    return [...stubStore.users.values()].map(toUser);
  }

  async update(id: number, partial: Partial<User>) {
    const existing = stubStore.users.get(id);
    if (!existing) return { affected: 0 };
    if (partial.email !== undefined) existing.email = partial.email;
    if (partial.name !== undefined) existing.name = partial.name;
    if (partial.role !== undefined) existing.role = partial.role as string;
    if (partial.position !== undefined) existing.position = partial.position;
    return { affected: 1 };
  }

  async save(user: User) {
    const row = stubStore.users.get(user.id) ?? {
      id: stubStore.nextUserId++,
      email: user.email,
      name: user.name,
      password: (user as any).password,
      role: user.role,
      status: user.status,
      position: user.position ?? null,
    };
    stubStore.users.set(row.id, row as StubUser);
    return toUser(row as StubUser);
  }

  async createUser(dto: CreateUserDto) {
    const strength = this.passwordService.validatePasswordStrength(dto.password);
    if (!strength.valid) throw new Error(strength.errors?.join('; '));
    const existing = await this.findOne({ where: { email: dto.email } });
    if (existing) throw new Error('Email already registered');
    const passwordHash = await this.passwordService.hashPassword(dto.password);
    return this.create({
      ...dto,
      password: passwordHash as any,
      role: dto.role ?? UserRole.USER,
      status: UserStatus.ACTIVE,
    });
  }

  async updateUserById(id: number, dto: UpdateUserDto) {
    const user = await this.findOneBy({ id });
    if (!user) throw new Error('User not found');
    if (dto.email !== undefined) user.email = dto.email.trim();
    if (dto.name !== undefined) user.name = dto.name.trim();
    if (dto.role !== undefined) user.role = dto.role;
    if (dto.position !== undefined) user.position = dto.position?.trim() || null;
    return this.save(user);
  }

  async remove() {
    return {};
  }

  async changePassword() {
    return {};
  }

  async findById(id: number) {
    return this.findOneBy({ id });
  }
}
