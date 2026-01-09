import { Module, Global } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigService, ConfigModule } from '@nestjs/config';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { UsersModule } from '../users/users.module';
import { CompaniesModule } from '../companies/companies.module';
import { AuthGuard } from './auth.guard';

@Global()
@Module({
    imports: [
        UsersModule,
        CompaniesModule,
        ConfigModule,
        JwtModule.registerAsync({
            imports: [ConfigModule],
            useFactory: async (configService: ConfigService) => ({
                secret: configService.get<string>('JWT_SECRET') || 'fallbackSecretKey_CHANGE_IN_PROD',
                signOptions: { expiresIn: '1d' },
            }),
            inject: [ConfigService],
        }),
    ],
    providers: [AuthService, AuthGuard],
    controllers: [AuthController],
    exports: [AuthService, AuthGuard, JwtModule],
})
export class AuthModule { }
