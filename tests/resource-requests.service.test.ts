import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { ResourceRequestsService } from '../src/resources/resource-requests.module';
import { ResourceRequestSchema } from '../src/schemas/hr.schema';

const existingRequest = {
    id: 'request-1',
    company_id: 'company-1',
    employee_id: 'employee-1',
    title: '<Laptop> replacement',
    category: 'Equipment',
    description: 'Current laptop is unreliable',
    goal_alignment: 'Improve delivery speed',
    priority: 'high',
    estimated_cost: 1250,
    product_url: 'https://example.com/laptop?size=15&ram=32',
    attachments: { files: ['quote.pdf', 'specification.pdf'] },
    status: 'pending',
    reviewer_note: null,
    status_history: [],
    employee_name: 'Employee One',
    employee_email: 'employee@example.com',
    created_at: new Date('2026-07-14T10:00:00Z'),
    updated_at: new Date('2026-07-14T10:00:00Z'),
};

function createService(nextStatus: string, currentStatus = 'pending') {
    const request = { ...existingRequest, status: currentStatus, status_history: [] };
    const queries: string[] = [];
    const client = {
        query: async (sql: string) => {
            queries.push(sql);
            if (sql.includes('SELECT * FROM resource_requests')) {
                return { rowCount: 1, rows: [request] };
            }
            if (sql.includes('SELECT name FROM employees')) {
                return { rowCount: 1, rows: [{ name: 'Admin User' }] };
            }
            if (sql.includes('UPDATE resource_requests')) {
                return {
                    rowCount: 1,
                    rows: [{ ...request, status: nextStatus, reviewer_note: 'Status note' }],
                };
            }
            if (sql.includes('AS manager_email')) {
                return {
                    rowCount: 1,
                    rows: [{
                        employee_email: 'employee@example.com',
                        employee_name: 'Employee One',
                        manager_email: 'manager@example.com',
                        manager_name: 'Manager One',
                    }],
                };
            }
            throw new Error(`Unexpected query: ${sql}`);
        },
    };
    const pg = {
        withTransaction: async (callback: (transactionClient: any) => Promise<any>) => callback(client),
    };
    const sent: any[] = [];
    const emailService = {
        sendEmail: async (...args: any[]) => {
            sent.push(args);
            return true;
        },
    };

    return {
        service: new ResourceRequestsService(pg as any, emailService as any),
        queries,
        sent,
    };
}

test('emails employee and manager with the full form for every admin status change', async () => {
    for (const status of ['approved', 'rejected', 'fulfilled', 'cancelled']) {
        const { service, sent } = createService(status);

        const result = await service.patchStatus(
            'company-1',
            'admin-1',
            'request-1',
            status,
            'Status note',
        );

        assert.equal(result.status, status);
        assert.equal(sent.length, 1);
        const [recipients, subject, html] = sent[0];
        assert.deepEqual(recipients, [
            { email: 'employee@example.com', name: 'Employee One' },
            { email: 'manager@example.com', name: 'Manager One' },
        ]);
        assert.match(subject, new RegExp(status, 'i'));
        assert.match(html, /Pending/);
        assert.match(html, new RegExp(status, 'i'));
        assert.match(html, /&lt;Laptop&gt; replacement/);
        assert.match(html, /Equipment/);
        assert.match(html, /Current laptop is unreliable/);
        assert.match(html, /Improve delivery speed/);
        assert.match(html, /High/);
        assert.match(html, /\$1250/);
        assert.match(html, /2 files/);
        assert.match(html, /Status note/);
    }
});

test('does not send an email when the status did not change', async () => {
    const { service, sent, queries } = createService('cancelled', 'cancelled');

    const result = await service.patchStatus(
        'company-1',
        'admin-1',
        'request-1',
        'cancelled',
    );

    assert.equal(result.status, 'cancelled');
    assert.equal(sent.length, 0);
    assert.equal(queries.length, 1);
});

test('notifies admins, owners and the reporting manager when a request is created', async () => {
    const sent: any[] = [];
    let emailResolved = false;

    const client = {
        query: async (sql: string) => {
            if (sql.includes('SELECT name, email FROM employees')) {
                return { rowCount: 1, rows: [{ name: 'Employee One', email: 'employee@example.com' }] };
            }
            if (sql.includes('INSERT INTO resource_requests')) {
                return { rowCount: 1, rows: [{ ...existingRequest, category: 'Hardware' }] };
            }
            throw new Error(`Unexpected transaction query: ${sql}`);
        },
    };

    const pg = {
        withTransaction: async (callback: (transactionClient: any) => Promise<any>) => callback(client),
        query: async (sql: string) => {
            if (sql.includes("role IN ('admin', 'owner')")) {
                return {
                    rowCount: 2,
                    rows: [
                        { email: 'owner@example.com', name: 'Owner One' },
                        { email: 'admin@example.com', name: 'Admin One' },
                    ],
                };
            }
            if (sql.includes('reporting_manager_id')) {
                return { rowCount: 1, rows: [{ email: 'manager@example.com', name: 'Manager One' }] };
            }
            throw new Error(`Unexpected pool query: ${sql}`);
        },
    };

    const emailService = {
        sendEmail: async (...args: any[]) => {
            sent.push(args);
            await new Promise((resolve) => setImmediate(resolve));
            emailResolved = true;
            return true;
        },
    };

    const service = new ResourceRequestsService(pg as any, emailService as any);

    await service.create('company-1', 'employee-1', {
        companyId: 'company-1',
        employeeId: 'employee-1',
        title: 'New laptop',
        category: 'Hardware',
        priority: 'normal',
    } as any);

    assert.equal(emailResolved, true, 'create must await the notification email');
    assert.equal(sent.length, 1);
    const [recipients, subject] = sent[0];
    assert.match(subject, /New resource request/);
    assert.deepEqual(recipients, [
        { email: 'owner@example.com', name: 'Owner One' },
        { email: 'admin@example.com', name: 'Admin One' },
        { email: 'manager@example.com', name: 'Manager One' },
    ]);
});

test('accepts typed staffing request fields', () => {
    const request = ResourceRequestSchema.parse({
        companyId: 'company-1',
        employeeId: 'employee-1',
        title: 'Add backend capacity',
        category: 'Staffing',
        priority: 'high',
        requestType: 'headcount',
        staffingDetails: {
            role: 'Backend Engineer',
            headcount: 2,
            team: 'Engineering',
            startDate: '2026-09-01',
            employmentType: 'permanent',
        },
    });

    assert.equal(request.requestType, 'headcount');
    assert.equal(request.staffingDetails?.headcount, 2);
});