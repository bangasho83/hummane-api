import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourceTemplatesService } from '../src/resources/resource-templates.module';

const template = {
    id: 'template-1',
    companyId: 'company-1',
    name: 'Claude.ai',
    resourceType: 'subscription',
    category: 'Software & Subscriptions',
    vendorId: null,
    defaultCostAmount: 25,
    defaultCostType: 'recurring',
    defaultDetails: {},
    isActive: true,
};

test('creates a company-scoped resource template with its defaults', async () => {
    let captured: { sql: string; params: unknown[] } | null = null;
    const pg = {
        query: async (sql: string, params: unknown[]) => {
            captured = { sql, params };
            return { rowCount: 1, rows: [template] };
        },
    };
    const service = new ResourceTemplatesService(pg as any);

    const result = await service.create({
        ...template,
        id: undefined,
        defaultDetails: { billingInterval: 'monthly' },
    } as any);

    assert.equal(result.name, 'Claude.ai');
    assert.match(captured?.sql || '', /INSERT INTO resource_templates/);
    assert.equal(captured?.params[1], 'company-1');
    assert.equal(captured?.params[7], 25);
    assert.equal(captured?.params[9], JSON.stringify({ billingInterval: 'monthly' }));
});

test('archives a template without deleting it', async () => {
    let capturedSql = '';
    const pg = {
        query: async (sql: string) => {
            capturedSql = sql;
            return { rowCount: 1, rows: [template] };
        },
    };
    const service = new ResourceTemplatesService(pg as any);

    await service.archive('template-1', 'company-1');

    assert.match(capturedSql, /UPDATE resource_templates/);
    assert.match(capturedSql, /is_active = \$1/);
});