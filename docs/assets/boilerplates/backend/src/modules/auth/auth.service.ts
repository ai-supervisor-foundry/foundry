import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { LoginDto } from './dto/login.dto';
import { SignupDto } from './dto/signup.dto';
import { UsersService } from '../users/users.service';
import { LoginResponseDto } from './dto/login-response.dto';
import { User, UserRole, UserStatus } from '../users/entities/user.entity';
import { JwtService, JwtSignOptions } from '@nestjs/jwt';
import { PasswordService } from './password/password.service';

@Injectable()
export class AuthService {
  constructor(
    private readonly userService: UsersService,
    private readonly jwtService: JwtService,
    private readonly passwordService: PasswordService,
  ) {}

  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const user = await this.userService.findOne({
      where: { email: loginDto.email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const valid = await this.passwordService.verifyPassword(
      loginDto.password,
      user.password ?? '',
    );
    if (!valid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const { password: _p, ...userWithoutPassword } = user as User & {
      password?: string;
    };
    const tokenOptions = loginDto.rememberMe ? { expiresIn: '30d' } : {};
    return {
      accessToken: await this.getAccessToken(user, tokenOptions),
      user: userWithoutPassword as User,
    };
  }

  async signup(dto: SignupDto): Promise<LoginResponseDto> {
    const strength = this.passwordService.validatePasswordStrength(
      dto.password,
    );
    if (!strength.valid) {
      throw new BadRequestException(
        strength.errors?.join('; ') ?? 'Weak password',
      );
    }
    const existing = await this.userService.findOne({
      where: { email: dto.email },
    });
    if (existing) {
      throw new ConflictException('Email already registered');
    }
    const passwordHash = await this.passwordService.hashPassword(dto.password);
    const user = await this.userService.create({
      email: dto.email,
      name: dto.name,
      password: passwordHash,
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
    });
    const { password: _p, ...userWithoutPassword } = user as User & {
      password?: string;
    };
    return {
      accessToken: await this.getAccessToken(user),
      user: userWithoutPassword as User,
    };
  }

  public async getAccessToken(
    user: User,
    options: JwtSignOptions = {},
  ): Promise<string> {
    return this.jwtService.signAsync(
      {
        ...(({ id, email, name, role }) => ({ id, email, name, role }))(user),
      },
      { ...options },
    );
  }
}
