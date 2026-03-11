import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  NotFoundException,
  ForbiddenException,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { User } from './entities/user.entity';
import { UsersService } from './users.service';
import { Auth } from '../auth/auth.decorator';
import { AuthRequest } from '../auth/types/request.types';
import { UserRole } from './entities/user.entity';

@ApiTags('Users')
@Controller({
  path: 'users',
  version: '1',
})
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @Auth(UserRole.ADMIN)
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create user with specified role (Admin only)' })
  @ApiResponse({ status: 201, description: 'User created', type: User })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden - Admin only' })
  async create(@Body() dto: CreateUserDto): Promise<User> {
    return this.usersService.createUser(dto);
  }

  @Get()
  @Auth(UserRole.ADMIN, UserRole.MANAGER)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'List all users (Admin/Manager for assignee dropdowns)',
  })
  @ApiResponse({
    status: 200,
    description: 'Returns user list',
    type: User,
    isArray: true,
  })
  async findAll(): Promise<User[]> {
    return this.usersService.find();
  }

  @Auth()
  @ApiBearerAuth()
  @Get('me')
  @ApiOperation({ summary: 'Get current authenticated user' })
  @ApiResponse({ status: 200, description: 'Returns current user', type: User })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Req() req: AuthRequest): Promise<User | null> {
    return this.usersService.findById(req.user.id);
  }

  @Auth(UserRole.ADMIN)
  @ApiBearerAuth()
  @Get(':id')
  @ApiOperation({ summary: 'Get user by ID (Admin only)' })
  @ApiResponse({ status: 200, description: 'Returns user', type: User })
  @ApiResponse({ status: 404, description: 'User not found' })
  async findOne(
    @Param('id', new ParseIntPipe()) id: number,
  ): Promise<User | null> {
    const user = await this.usersService.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  @Auth()
  @ApiBearerAuth()
  @Put('me')
  @ApiOperation({ summary: 'Update current user profile' })
  @ApiResponse({ status: 200, description: 'User updated successfully' })
  async updateMe(@Req() req: AuthRequest, @Body() user: UpdateUserDto) {
    await this.usersService.update(req.user.id, user);
    return { message: 'User updated successfully' };
  }

  @Auth(UserRole.ADMIN)
  @ApiBearerAuth()
  @Put(':id')
  @ApiOperation({ summary: 'Update a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User updated', type: User })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', new ParseIntPipe()) id: number,
    @Body() dto: UpdateUserDto,
  ): Promise<User> {
    return this.usersService.updateUserById(id, dto);
  }

  @Auth(UserRole.ADMIN)
  @ApiBearerAuth()
  @Delete(':id')
  @ApiOperation({ summary: 'Delete a user (Admin only)' })
  @ApiResponse({ status: 200, description: 'User deleted successfully' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async remove(@Param('id', new ParseIntPipe()) id: number) {
    const user = await this.usersService.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException('User not found');
    }
    if (id === 1 && user.role === UserRole.ADMIN) {
      throw new ForbiddenException('Cannot delete the first admin user');
    }
    return user.remove();
  }

  @Auth()
  @ApiBearerAuth()
  @Put('password')
  @ApiOperation({ summary: 'Change password for current user' })
  @ApiResponse({ status: 200, description: 'Password changed successfully' })
  @ApiResponse({ status: 400, description: 'Invalid old password' })
  async changePassword(
    @Req() req: AuthRequest,
    @Body() payload: { oldPassword: string; newPassword: string },
  ) {
    await this.usersService.changePassword(
      req.user.id,
      payload.oldPassword,
      payload.newPassword,
    );
    return { message: 'Password changed successfully' };
  }
}
