import {
  Body,
  Controller,
  Get,
  Post,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { AuthService } from './auth.service';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { LoginDto } from './dto/login.dto';
import { LoginResponseDto } from './dto/login-response.dto';
import { SignupDto } from './dto/signup.dto';
import { Public } from './auth.guard';
import { RequireRole } from './auth.decorator';
import { AuthRequest } from './types/request.types';

@ApiTags('Auth')
@Controller({
  path: 'auth',
  version: '1',
})
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  /**
   * CONTEXT: API standards mismatch between controller and existing E2E tests.
   * SITUATION: NestJS defaults POST to 201 Created, but tests and standard login patterns expect 200 OK.
   * ACTION: Added @HttpCode(HttpStatus.OK) to align the implementation with the test suite expectations.
   * RESULT: Auth E2E tests now pass without status code conflicts.
   */
  @Post('login')
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Login with email and password' })
  @ApiResponse({
    status: 200,
    description: 'Login successful',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.authService.login(loginDto);
  }

  @Post('signup')
  @Public()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register with email, password, name' })
  @ApiResponse({
    status: 201,
    description: 'User created',
    type: LoginResponseDto,
  })
  @ApiResponse({ status: 400, description: 'Invalid email or weak password' })
  @ApiResponse({ status: 409, description: 'Email already registered' })
  async signup(@Body() dto: SignupDto): Promise<LoginResponseDto> {
    return this.authService.signup(dto);
  }

  @Get('profile')
  @ApiOperation({ summary: 'Get current user from JWT' })
  @ApiResponse({ status: 200, description: 'Current user payload' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async profile(@Req() req: AuthRequest) {
    return req.user;
  }

  @Get('role-check/admin')
  @RequireRole('ADMIN')
  @ApiOperation({ summary: 'Admin only' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  roleCheckAdmin(@Req() req: AuthRequest) {
    return { ok: true, role: req.user.role };
  }

  @Get('role-check/manager')
  @RequireRole('ADMIN', 'MANAGER')
  @ApiOperation({ summary: 'Manager or Admin' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  roleCheckManager(@Req() req: AuthRequest) {
    return { ok: true, role: req.user.role };
  }

  @Get('role-check/user')
  @RequireRole('ADMIN', 'MANAGER', 'USER')
  @ApiOperation({ summary: 'Any authenticated user' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 403, description: 'Forbidden' })
  roleCheckUser(@Req() req: AuthRequest) {
    return { ok: true, role: req.user.role };
  }
}
