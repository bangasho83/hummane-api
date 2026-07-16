import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourcesController, ResourcesService } from '../src/resources/resources.module';

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

test('findAll filters reimbursements by the employee who paid', async () => {
    const captured: { sql: string; params: unknown[] }[] = [];
    const pg = {
        query: async (sql: string, params: unknown[]) => {
            captured.push({ sql, params });
            return { rowCount: 0, rows: [] };
        },
    };
    const service = new ResourcesService(pg as any);

    await service.findAll('company-1', 100, {
        resourceType: 'reimbursement',
        paidByEmployeeId: 'employee-1',
    });

    assert.match(captured[0].sql, /resource_type = \$2/);
    assert.match(captured[0].sql, /paid_by_employee_id = \$3/);
    assert.deepEqual(captured[0].params, ['company-1', 'reimbursement', 'employee-1', 100]);
});

test('member reimbursement creation forces employee ownership and pending payment', async () => {
    const companyId = '11111111-1111-4111-8111-111111111111';
    const employeeId = '22222222-2222-4222-8222-222222222222';
    let created: any;
    const service = {
        create: async (data: any) => { created = data; return data; },
    };
    const controller = new ResourcesController(service as any);

    await controller.create({
        companyId: '33333333-3333-4333-8333-333333333333',
        createdBy: '44444444-4444-4444-8444-444444444444',
        resourceType: 'reimbursement',
        name: 'Fuel reimbursement',
        category: 'Other',
        assignmentType: 'person',
        assignedToEmployeeId: '55555555-5555-4555-8555-555555555555',
        paidByEmployeeId: '55555555-5555-4555-8555-555555555555',
        isSettled: true,
        costAmount: 8000,
        costType: 'one_time',
        expenseDate: '2026-07-15',
    } as any, {
        user: { companyId, employeeId, role: 'member' },
    });

    assert.equal(created.companyId, companyId);
    assert.equal(created.createdBy, employeeId);
    assert.equal(created.resourceType, 'reimbursement');
    assert.equal(created.assignmentType, 'not_applicable');
    assert.equal(created.assignedToEmployeeId, undefined);
    assert.equal(created.paidByEmployeeId, employeeId);
    assert.equal(created.isSettled, false);
    assert.equal(created.status, 'active');
});

test('member cannot create a non-reimbursement resource', () => {
    const controller = new ResourcesController({ create: async () => null } as any);
    assert.throws(
        () => controller.create({
            resourceType: 'expense', name: 'Lunch', category: 'Other',
        } as any, {
            user: { companyId: 'company-1', employeeId: 'employee-1', role: 'member' },
        }),
        /Members can only submit reimbursements/,
    );
});

test('member list query is scoped to their reimbursements', async () => {
    let filters: any;
    const service = {
        findAll: async (_companyId: string, _limit: number, value: any) => { filters = value; return []; },
    };
    const controller = new ResourcesController(service as any);

    await controller.findAll(
        { user: { companyId: 'company-1', employeeId: 'employee-1', role: 'member' } },
        '100',
        'reimbursement',
        undefined,
        'other-employee',
        undefined,
        undefined,
    );

    assert.deepEqual(filters, {
        resourceType: 'reimbursement',
        paidByEmployeeId: 'employee-1',
    });
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
