import {
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsStrongPassword,
  Length,
  IsInt,
  Matches,
} from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import {
  PasswordPattern,
  PasswordStrengthPattern,
} from '../constants/users-validation.constants';
import { UserRole } from '../entities/user.entity';

export class CreateUserDto {
  @ApiProperty({
    example: 'John Doe',
    description: 'Name of the user',
    minLength: 1,
    maxLength: 32,
  })
  @IsString()
  @Length(1, 32)
  name: string;

  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the user (must contain @)',
    minLength: 1,
    maxLength: 100,
  })
  @IsEmail({}, { message: 'Email must be a valid format (e.g. name@domain)' })
  @Length(1, 100)
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password for the user account',
    minLength: 8,
    maxLength: 24,
    pattern: PasswordPattern,
  })
  @IsNotEmpty()
  @Length(8, 24)
  @IsStrongPassword()
  @Matches(new RegExp(PasswordPattern))
  @Matches(new RegExp(PasswordStrengthPattern), {
    message: 'Password must be min 8 chars with 1 uppercase and 1 number',
  })
  password: string;

  @ApiProperty({
    example: UserRole.USER,
    description: 'Role: ADMIN, MANAGER, USER',
    enum: UserRole,
  })
  @IsEnum(UserRole)
  @IsOptional()
  role?: UserRole;

  @ApiProperty({
    example: 'Developer',
    description: 'User position (max 200 chars)',
    maxLength: 200,
    required: false,
  })
  @IsString()
  @IsOptional()
  @Length(0, 200)
  position?: string;

  @ApiProperty({
    example: null,
    description: 'Manager user ID (optional)',
    required: false,
    nullable: true,
  })
  @IsOptional()
  @IsInt()
  managerId?: number | null;
}
