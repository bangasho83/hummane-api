import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourcesController, ResourcesService } from '../src/resources/resources.module';
import { ResourceSchema } from '../src/schemas/hr.schema';

function makeResourceRow(overrides: Record<string, any> = {}) {
    return {
        id: 'resource-1',
        company_id: 'company-1',
        vendor_id: null,
        resource_type: 'physical_asset',
        name: 'MacBook Pro 14',
        category: 'Hardware',
        description: null,
        identifier: 'HUM-MBP-1',
        status: 'active',
        assignment_type: 'person',
        assigned_to_employee_id: 'employee-old',
        location: null,
        assigned_at: new Date('2026-02-01T09:00:00Z'),
        assignment_history: [],
        cost_amount: 250000,
        cost_type: 'one_time',
        expense_date: null,
        paid_by_employee_id: null,
        is_settled: true,
        attachments: { files: [] },
        details: {},
        created_by: null,
        created_at: new Date('2026-02-01T09:00:00Z'),
        updated_at: new Date('2026-02-01T09:00:00Z'),
        ...overrides,
    };
}

test('accepts a book resource with book-specific details', () => {
    const parsed = ResourceSchema.safeParse({
        companyId: 'company-1',
        resourceType: 'book',
        name: 'The Pragmatic Programmer',
        category: 'Training & Learning',
        details: { author: 'David Thomas', publicationYear: '1999' },
    });

    assert.equal(parsed.success, true);
});

test('create rejects an invalid category', async () => {
    const pg = { query: async () => ({ rowCount: 0, rows: [] }) };
    const service = new ResourcesService(pg as any);

    await assert.rejects(
        () =>
            service.create({
                companyId: 'company-1',
                resourceType: 'physical_asset',
                name: 'Mystery item',
                category: 'Nonexistent',
            } as any),
        /Invalid category/,
    );
});

test('create explains a duplicate identifier', async () => {
    const pg = {
        query: async () => {
            throw { code: '23505', constraint: 'idx_resources_company_identifier' };
        },
    };
    const service = new ResourcesService(pg as any);

    await assert.rejects(
        () => service.create({
            companyId: 'company-1',
            resourceType: 'subscription',
            name: 'Figma',
            category: 'Software & Subscriptions',
            identifier: 'account@example.com',
        } as any),
        /identifier is already in use/i,
    );
});

test('create explains stale selected records', async () => {
    const pg = {
        query: async () => {
            throw { code: '23503', constraint: 'resources_assigned_employee_fk' };
        },
    };
    const service = new ResourcesService(pg as any);

    await assert.rejects(
        () => service.create({
            companyId: 'company-1',
            resourceType: 'subscription',
            name: 'Figma',
            category: 'Software & Subscriptions',
        } as any),
        /selected employee no longer exists/i,
    );
});

test('create explains missing resource database setup without exposing database details', async () => {
    const pg = {
        query: async () => {
            throw {
                code: '42703',
                message: 'column "resource_template_id" of relation "resources" does not exist',
            };
        },
    };
    const service = new ResourcesService(pg as any);

    await assert.rejects(
        () => service.create({
            companyId: 'company-1',
            resourceType: 'subscription',
            name: 'Figma',
            category: 'Software & Subscriptions',
        } as any),
        /Resources are not configured correctly yet/i,
    );
});

test('create applies active template defaults while allowing resource overrides', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const pg = {
        query: async (sql: string, params: unknown[]) => {
            captured.push({ sql, params });
            if (sql.includes('FROM resource_templates')) {
                return {
                    rowCount: 1,
                    rows: [{
                        name: 'Claude.ai',
                        category: 'Software & Subscriptions',
                        resource_type: 'subscription',
                        vendor_id: 'vendor-1',
                        default_cost_amount: 25,
                        default_cost_type: 'recurring',
                        default_details: { billingInterval: 'monthly' },
                    }],
                };
            }
            return { rowCount: 1, rows: [makeResourceRow()] };
        },
    };
    const service = new ResourcesService(pg as any);

    await service.create({
        companyId: 'company-1',
        resourceTemplateId: 'template-1',
        resourceType: 'subscription',
        name: '',
        category: '',
        costAmount: 30,
        details: { numberOfSeats: 1 },
    } as any);

    const insert = captured.find((item) => item.sql.includes('INSERT INTO resources'));
    assert.ok(insert);
    assert.equal(insert.params[2], 'template-1');
    assert.equal(insert.params[5], 'Claude.ai');
    assert.equal(insert.params[6], 'Software & Subscriptions');
    assert.equal(insert.params[15], 30);
    assert.deepEqual(JSON.parse(insert.params[21] as string), {
        billingInterval: 'monthly',
        numberOfSeats: 1,
    });
});

test('subscription can be updated after initially leaving renewal date blank', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const pg = {
        query: async (sql: string, params: unknown[]) => {
            captured.push({ sql, params });
            return { rowCount: 1, rows: [makeResourceRow({
                resource_type: 'subscription',
                details: { numberOfSeats: 1, renewalDate: '2026-07-01' },
            })] };
        },
    };
    const service = new ResourcesService(pg as any);

    await service.update('resource-1', {
        details: { numberOfSeats: 1, accountEmail: 'owner@example.com', renewalDate: '2026-07-01' },
    }, 'company-1');

    assert.equal(captured.length, 1);
    assert.match(captured[0].sql, /UPDATE resources/);
    assert.deepEqual(JSON.parse(captured[0].params[0] as string), {
        numberOfSeats: 1,
        accountEmail: 'owner@example.com',
        renewalDate: '2026-07-01',
    });
    assert.deepEqual(captured[0].params.slice(1), ['resource-1', 'company-1']);
});

test('update explains a duplicate identifier', async () => {
    const pg = {
        query: async () => {
            throw { code: '23505', constraint: 'idx_resources_company_identifier' };
        },
    };
    const service = new ResourcesService(pg as any);

    await assert.rejects(
        () => service.update('resource-1', { identifier: 'account@example.com' }, 'company-1'),
        /identifier is already in use/i,
    );
});

test('findAll builds filtered query for an employee', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const pg = {
        query: async (sql: string, params: unknown[]) => {
            captured.push({ sql, params });
            return { rowCount: 0, rows: [] };
        },
    };
    const service = new ResourcesService(pg as any);

    await service.findAll('company-1', 25, {
        resourceType: 'physical_asset',
        assignedToEmployeeId: 'employee-1',
    });

    assert.equal(captured.length, 1);
    assert.match(captured[0].sql, /resource_type = \$2/);
    assert.match(captured[0].sql, /assigned_to_employee_id = \$3/);
    assert.deepEqual(captured[0].params, [
        'company-1',
        'physical_asset',
        'employee-1',
        25,
    ]);
});

test('admin resource reads preserve an explicit selected employee filter', async () => {
    let captured: { companyId: string; limit: number; filters: Record<string, unknown> } | null = null;
    const service = {
        findAll: async (companyId: string, limit: number, filters: Record<string, unknown>) => {
            captured = { companyId, limit, filters };
            return [];
        },
    };
    const controller = new ResourcesController(service as any);

    await controller.findAll(
        { user: { role: 'admin', companyId: 'company-1', employeeId: 'admin-employee' } },
        '25',
        'subscription',
        undefined,
        'selected-employee',
    );

    assert.deepEqual(captured, {
        companyId: 'company-1',
        limit: 25,
        filters: {
            resourceType: 'subscription',
            status: undefined,
            assignedToEmployeeId: 'selected-employee',
            vendorId: undefined,
            resourceTemplateId: undefined,
        },
    });
});

test('member resource reads remain scoped to their own employee id', async () => {
    let captured: { filters: Record<string, unknown> } | null = null;
    const service = {
        findAll: async (_companyId: string, _limit: number, filters: Record<string, unknown>) => {
            captured = { filters };
            return [];
        },
    };
    const controller = new ResourcesController(service as any);

    await controller.findAll(
        { user: { role: 'member', companyId: 'company-1', employeeId: 'member-employee' } },
        undefined,
        undefined,
        undefined,
        'another-employee',
    );

    assert.equal(captured?.filters.assignedToEmployeeId, 'member-employee');
});

test('findOne can be scoped to the current employee assignment', async () => {
    let captured: { sql: string; params: unknown[] } | null = null;
    const pg = {
        query: async (sql: string, params: unknown[]) => {
            captured = { sql, params };
            return { rowCount: 1, rows: [makeResourceRow()] };
        },
    };
    const service = new ResourcesService(pg as any);

    await service.findOne('resource-1', 'company-1', 'employee-1');

    assert.match(captured?.sql || '', /assigned_to_employee_id = \$3/);
    assert.deepEqual(captured?.params, ['resource-1', 'company-1', 'employee-1']);
});

test('reassign moves the previous assignment into history', async () => {
    let updateParams: unknown[] = [];
    const client = {
        query: async (sql: string, params: unknown[]) => {
            if (sql.includes('SELECT * FROM resources')) {
                return { rowCount: 1, rows: [makeResourceRow()] };
            }
            if (sql.includes('SELECT name FROM employees') && params[0] === 'admin-1') {
                return { rowCount: 1, rows: [{ name: 'Admin One' }] };
            }
            if (sql.includes('SELECT name FROM employees') && params[0] === 'employee-old') {
                return { rowCount: 1, rows: [{ name: 'Sarah Khan' }] };
            }
            if (sql.includes('UPDATE resources')) {
                updateParams = params;
                return {
                    rowCount: 1,
                    rows: [makeResourceRow({ assigned_to_employee_id: 'employee-new' })],
                };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };
    const pg = {
        withTransaction: async (callback: (transactionClient: any) => Promise<any>) =>
            callback(client),
    };
    const service = new ResourcesService(pg as any);

    await service.reassign('resource-1', 'company-1', 'admin-1', {
        assignmentType: 'person',
        assignedToEmployeeId: 'employee-new',
        note: 'Handed over to John',
    });

    const historyJson = updateParams[4] as string;
    const history = JSON.parse(historyJson);
    assert.equal(history.length, 1);
    assert.equal(history[0].employeeId, 'employee-old');
    assert.equal(history[0].employeeName, 'Sarah Khan');
    assert.equal(history[0].changedByName, 'Admin One');
    assert.equal(history[0].note, 'Handed over to John');
    assert.ok(history[0].unassignedAt);
    assert.equal(updateParams[0], 'person');
    assert.equal(updateParams[1], 'employee-new');
});

test('reassign to unassigned clears the current holder and records history', async () => {
    let updateParams: unknown[] = [];
    const client = {
        query: async (sql: string, params: unknown[]) => {
            if (sql.includes('SELECT * FROM resources')) {
                return { rowCount: 1, rows: [makeResourceRow()] };
            }
            if (sql.includes('SELECT name FROM employees')) {
                return { rowCount: 1, rows: [{ name: 'Someone' }] };
            }
            if (sql.includes('UPDATE resources')) {
                updateParams = params;
                return { rowCount: 1, rows: [makeResourceRow({ assignment_type: 'unassigned' })] };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };
    const pg = {
        withTransaction: async (callback: (transactionClient: any) => Promise<any>) =>
            callback(client),
    };
    const service = new ResourcesService(pg as any);

    await service.reassign('resource-1', 'company-1', 'admin-1', {
        assignmentType: 'unassigned',
    });

    assert.equal(updateParams[0], 'unassigned');
    assert.equal(updateParams[1], null);
    assert.equal(updateParams[3], null, 'assigned_at should be cleared when unassigned');
    const history = JSON.parse(updateParams[4] as string);
    assert.equal(history.length, 1);
});
