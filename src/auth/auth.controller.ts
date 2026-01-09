import { Controller, Post, Body, UnauthorizedException } from '@nestjs/common';
import { AuthService } from './auth.service';
import { LoginDto, LoginDtoSchema } from './auth.dto';

@Controller('auth')
export class AuthController {
    constructor(private authService: AuthService) { }

    @Post('login')
    async login(@Body() body: LoginDto) {
        const validation = LoginDtoSchema.safeParse(body);
        if (!validation.success) {
            throw new UnauthorizedException('Invalid payload');
        }
        return this.authService.login(body.firebaseToken);
    }
}
