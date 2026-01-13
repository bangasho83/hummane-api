import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Pool, PoolClient, QueryResult, types } from 'pg';

@Injectable()
export class PostgresService implements OnModuleDestroy {
    private pool: Pool;

    constructor(private configService: ConfigService) {
        const connectionString = this.configService.get<string>('DATABASE_URL');
        if (!connectionString) {
            throw new Error('DATABASE_URL is not set');
        }

        types.setTypeParser(1700, (value) => parseFloat(value));

        const ssl = connectionString.includes('sslmode=require')
            ? { rejectUnauthorized: false }
            : undefined;

        this.pool = new Pool({ connectionString, ssl });
    }

    query<T = unknown>(text: string, params?: unknown[]): Promise<QueryResult<T>> {
        return this.pool.query(text, params);
    }

    async withTransaction<T>(fn: (client: PoolClient) => Promise<T>): Promise<T> {
        const client = await this.pool.connect();
        try {
            await client.query('BEGIN');
            const result = await fn(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK');
            throw error;
        } finally {
            client.release();
        }
    }

    async onModuleDestroy() {
        await this.pool.end();
    }
}
