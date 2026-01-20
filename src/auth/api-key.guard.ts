import { Injectable, CanActivate, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { PostgresService } from '../postgres/postgres.service';

@Injectable()
export class ApiKeyGuard implements CanActivate {
    constructor(private postgres: PostgresService) { }

    async canActivate(context: ExecutionContext): Promise<boolean> {
        const request = context.switchToHttp().getRequest();
        const apiKey = request.headers['x-api-key'];

        if (!apiKey) {
            throw new UnauthorizedException('API key is missing');
        }

        const result = await this.postgres.query<{ id: string }>(
            'SELECT id FROM companies WHERE api_key = $1 LIMIT 1',
            [apiKey],
        );

        const company = result.rows[0];
        if (!company) {
            throw new UnauthorizedException('Invalid API key');
        }

        // Attach companyId to request for use in controllers
        request.companyId = company.id;

        return true;
    }
}
