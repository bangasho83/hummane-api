import { Controller, Get, Post, Body, Param, Put, Delete, UseGuards, Req } from '@nestjs/common';
import { UsersService } from './users.service';
import { AuthGuard } from '../auth/auth.guard';
import { User, UserSchema } from '../schemas/core.schema';

@Controller('users')
@UseGuards(AuthGuard)
export class UsersController {
    constructor(private readonly usersService: UsersService) { }

    @Post()
    async create(@Body() userData: User, @Req() req) {
        const user = req.user;
        // Force current user's company if applicable? (Maybe only admin creates users)
        if (user.companyId) userData.companyId = user.companyId;

        const result = UserSchema.safeParse(userData);
        if (!result.success) {
            throw new Error('Validation failed: ' + JSON.stringify(result.error.issues));
        }
        return this.usersService.create(result.data as User);
    }

    @Get()
    async findAll(@Req() req) {
        const user = req.user;
        if (!user.companyId) return []; // or return this.usersService.findAll() if superadmin
        return this.usersService.findAll(user.companyId);
    }

    @Get('me')
    async getMe(@Req() req) {
        const firebaseUser = req.user;
        if (firebaseUser.email) {
            return this.usersService.findByEmail(firebaseUser.email);
        }
        return null;
    }

    @Get(':id')
    async findOne(@Param('id') id: string, @Req() req) {
        const user = req.user;
        const target = await this.usersService.findOne(id);
        if (!target) return null;
        if (user.companyId && target.companyId !== user.companyId) {
            throw new Error('Forbidden');
        }
        return target;
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateData: Partial<User>, @Req() req) {
        const user = req.user;
        const target = await this.usersService.findOne(id);
        if (!target) return null;
        if (user.companyId && target.companyId !== user.companyId) {
            throw new Error('Forbidden');
        }
        return this.usersService.update(id, updateData);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Req() req) {
        const user = req.user;
        const target = await this.usersService.findOne(id);
        if (!target) return;
        if (user.companyId && target.companyId !== user.companyId) {
            throw new Error('Forbidden');
        }
        return this.usersService.delete(id);
    }
}
