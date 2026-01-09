import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { User, UserSchema } from '../schemas/core.schema';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    async create(@Body() userData: User) {
        // Basic validation
        const result = UserSchema.safeParse(userData);
        if (!result.success) {
            throw new Error('Validation failed: ' + JSON.stringify(result.error.issues));
        }
        return this.usersService.create(userData);
    }

    @Get()
    async findAll(@Req() req) {
        // In a real app, strict tenant filtering should happen here or in service
        // For now, listing all users might be restricted to super admin
        const user = req.user;
        // Example: if (user.role !== 'admin') throw new ForbiddenException();
        return this.usersService.findAll();
    }

    @Get('me')
    async getMe(@Req() req) {
        // The auth guard populates req.user with decoded token
        // We should fetch the full user profile from our DB matching the firebase uid or email
        const firebaseUser = req.user;
        // Assuming we link by email
        if (firebaseUser.email) {
            return this.usersService.findByEmail(firebaseUser.email);
        }
        return null;
    }

    @Get(':id')
    async findOne(@Param('id') id: string) {
        return this.usersService.findOne(id);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: Partial<User>) {
        return this.usersService.update(id, updateData);
    }

    @Delete(':id')
    async remove(@Param('id') id: string) {
        return this.usersService.delete(id);
    }
}
