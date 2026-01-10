import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

@Injectable()
export class AuthGuard implements CanActivate {
    constructor(private jwtService: JwtService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const authHeader = request.headers.authorization;

        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Missing or invalid Authorization header');
        }

        const token = authHeader.split('Bearer ')[1];
        try {
            const payload = await this.jwtService.verifyAsync(token);
            console.log(`[AuthGuard] [DEBUG] Raw JWT Payload:`, JSON.stringify(payload));

            // Payload has { sub: userId, email, companyId }
            request.user = {
                id: payload.sub,
                email: payload.email,
                companyId: payload.companyId
            };

            console.log(`[AuthGuard] [DEBUG] Populated req.user:`, JSON.stringify(request.user));

            return true;
        } catch (error) {
            console.error(`[AuthGuard] [ERROR] Token Verification Failed:`, error.message);
            throw new UnauthorizedException('Invalid or expired token');
        }
    }
}
