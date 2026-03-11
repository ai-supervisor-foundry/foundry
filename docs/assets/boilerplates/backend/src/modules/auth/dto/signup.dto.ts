import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, Length } from 'class-validator';

export class SignupDto {
  @ApiProperty({
    example: 'test@example.com',
    description: 'User email',
    minLength: 5,
    maxLength: 255,
  })
  @IsEmail()
  @Length(5, 255)
  email: string;

  @ApiProperty({
    example: 'Test123!',
    description: 'Password (min 8 chars, 1 upper, 1 number, 1 special)',
    minLength: 8,
    maxLength: 128,
  })
  @IsString()
  @IsNotEmpty()
  @Length(8, 128)
  password: string;

  @ApiProperty({
    example: 'Test User',
    description: 'Display name',
    minLength: 1,
    maxLength: 32,
  })
  @IsString()
  @Length(1, 32)
  name: string;
}
