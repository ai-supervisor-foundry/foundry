import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsNotEmpty,
  IsOptional,
  IsBoolean,
  Length,
  IsString,
} from 'class-validator';

export class LoginDto {
  @ApiProperty({
    example: 'john.doe@example.com',
    description: 'Email address of the user',
    minLength: 5,
    maxLength: 32,
  })
  @IsEmail()
  @Length(5, 32)
  email: string;

  @ApiProperty({
    example: 'password123',
    description: 'Password for the user account',
    maxLength: 24,
  })
  @IsString()
  @IsNotEmpty()
  password: string;

  @ApiProperty({
    example: false,
    description: 'Remember me - issues longer-lived token (30 days)',
    required: false,
  })
  @IsOptional()
  @IsBoolean()
  rememberMe?: boolean;
}
