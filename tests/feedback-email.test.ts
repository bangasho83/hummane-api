import * as assert from 'node:assert/strict';
import { test } from 'node:test';
import { FeedbackEntriesController } from '../src/feedback/feedback.module';

test('new feedback email includes intuitive context and feedback details', async () => {
    const created = {
        id: 'entry-1',
        companyId: 'company-1',
        cardId: 'card-1',
        type: 'performance',
        subjectType: 'Employee',
        subjectId: 'employee-1',
        subjectName: 'John <Smith>',
        authorId: 'employee-2',
        authorName: 'Sarah Khan',
        createdAt: '2026-07-16T10:30:00.000Z',
        card: {
            id: 'card-1',
            companyId: 'company-1',
            title: 'Quarterly Growth Feedback',
            subject: 'Team Member',
            questions: [],
        },
        answers: [
            {
                questionId: 'q1',
                answer: '4',
                question: { id: 'q1', prompt: 'How was the collaboration?', kind: 'score' },
            },
            {
                questionId: 'q2',
                answer: 'Clear communicator <and> supportive',
                question: { id: 'q2', prompt: 'What went well?', kind: 'comment' },
            },
        ],
    };
    const emails: any[][] = [];
    const service = { create: async () => created };
    const employeesService = {
        findOne: async () => ({
            id: 'employee-1',
            name: 'John Smith',
            email: 'john@example.com',
        }),
    };
    const emailService = {
        sendEmail: async (...args: any[]) => {
            emails.push(args);
            return true;
        },
    };
    const configService = {
        get: () => 'https://app.hummane.com',
    };
    const controller = new FeedbackEntriesController(
        service as any,
        {} as any,
        employeesService as any,
        emailService as any,
        configService as any,
    );

    await controller.create(
        {
            companyId: 'company-1',
            cardId: 'card-1',
            type: 'performance',
            subjectType: 'Employee',
            subjectId: 'employee-1',
            subjectName: 'John <Smith>',
            authorId: 'employee-2',
            answers: created.answers,
        } as any,
        { user: { id: 'user-2', companyId: 'company-1' } },
    );

    assert.equal(emails.length, 1);
    const [recipient, subject, html] = emails[0];
    assert.deepEqual(recipient, { email: 'john@example.com', name: 'John Smith' });
    assert.equal(subject, 'New feedback from Sarah Khan: Quarterly Growth Feedback');
    assert.match(html, /Quarterly Growth Feedback/);
    assert.match(html, /Sarah Khan/);
    assert.match(html, /John &lt;Smith&gt;/);
    assert.match(html, /Performance/);
    assert.match(html, /How was the collaboration\?/);
    assert.match(html, /4 \/ 5/);
    assert.match(html, /What went well\?/);
    assert.match(html, /Clear communicator &lt;and&gt; supportive/);
    assert.match(html, /https:\/\/app\.hummane\.com\/feedback\/entries\/entry-1/);
});