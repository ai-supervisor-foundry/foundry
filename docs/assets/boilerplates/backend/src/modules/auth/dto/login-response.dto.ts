import { ApiResponseProperty, ApiProperty } from '@nestjs/swagger';
import { type User } from '../../users/entities/user.entity';

export class LoginResponseDto {
  @ApiProperty({
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
    description: 'JWT access token for API authentication',
  })
  @ApiResponseProperty()
  accessToken: string;

  @ApiProperty({
    description: 'Authenticated user object',
    example: {
      id: 1,
      email: 'john.doe@example.com',
      role: 'user',
      verified: true,
    },
  })
  @ApiResponseProperty()
  user: User;
}
