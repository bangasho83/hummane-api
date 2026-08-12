import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const TimestampSchema = z.union([z.instanceof(Timestamp), z.date(), z.string()]);
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

const TwoDecimalNumberSchema = z.number().refine(
    (value) => Number.isFinite(value) && Math.round(value * 100) === value * 100,
    { message: 'Value must have at most 2 decimal places' }
);
const OneDecimalNumberSchema = z.number().refine(
    (value) => Number.isFinite(value) && Math.round(value * 10) === value * 10,
    { message: 'Value must have at most 1 decimal place' }
);

// String fields (enum values documented in documentation/enums.json)
export const EmploymentTypeEnum = z.string().min(1);
export const EmploymentModeEnum = z.string().min(1);
export const GenderEnum = z.string().min(1);
export const JobStatusEnum = z.string().min(1);
export const FeedbackEntryTypeEnum = z.string().min(1);

const DocumentFilesSchema = z.object({
    files: z.array(z.string()),
});

export const EmployeePersonalDetailsSchema = z.object({
    personalInfo: z.object({
        email: z.string().email().optional(),
        number: z.string().optional(),
    }).optional(),
    nationalId: z.string().optional(),
    address: z.object({
        permanentAddress: z.string().optional(),
        temporaryAddress: z.string().optional(),
    }).optional(),
    emergencyContact: z.object({
        relation: z.string().optional(),
        name: z.string().optional(),
        number: z.string().optional(),
    }).optional(),
    bloodGroup: z.string().optional(),
    bankAccount: z.object({
        title: z.string().optional(),
        bankName: z.string().optional(),
        accountNumber: z.string().optional(),
    }).optional(),
});

export const EmployeeStatusHistoryEntrySchema = z.object({
    employmentType: z.string().min(1),
    roleId: z.string().uuid().optional().or(z.string().length(0)),
    roleName: z.string().optional(),
    salary: TwoDecimalNumberSchema.optional(),
    date: IsoDateSchema,
});

export const EmployeeSchema = z.object({
    id: z.string().optional(),
    employeeId: z.string().min(1),
    companyId: z.string().min(1),
    userId: z.string().optional(),
    name: z.string().min(1),
    email: z.string().email(),
    departmentId: z.string().optional(),
    departmentName: z.string().optional(),
    roleId: z.string().optional(),
    roleName: z.string().optional(),
    startDate: IsoDateSchema,
    employmentType: EmploymentTypeEnum,
    employmentMode: EmploymentModeEnum.optional(),
    reportingManagerId: z.string().optional(),
    reportingManagerName: z.string().optional(),
    reportingManagerEmail: z.string().optional(),
    gender: GenderEnum,
    salary: TwoDecimalNumberSchema.optional(),
    photoUrl: z.string().url().optional().or(z.string().length(0)),
    dob: IsoDateSchema.optional().or(z.string().length(0)),
    personalDetails: EmployeePersonalDetailsSchema.optional(),
    statusHistory: z.array(EmployeeStatusHistoryEntrySchema).optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DepartmentSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const RoleSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const JobSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    title: z.string().min(1),
    departmentId: z.string().optional(),
    departmentName: z.string().optional(),
    roleId: z.string().optional(),
    roleName: z.string().optional(),
    roleDescription: z.string().optional(),
    employmentType: EmploymentTypeEnum.optional(),
    employmentMode: EmploymentModeEnum.optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    salaryFrom: z.number().int().optional(),
    salaryTo: z.number().int().optional(),
    experience: z.string().optional(),
    requirement: z.string().optional(),
    companyAbout: z.string().optional(),
    status: JobStatusEnum,


    applicantCount: z.number().int().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Job = z.infer<typeof JobSchema>;

// Status/unit strings
export const ApplicantStatusEnum = z.string().min(1);
export const LeaveUnitEnum = z.string().min(1);
export const WeekdayEnum = z.string().min(1);

const WorkDaySchema = z.object({
    open: z.boolean(),
    start: z.string().optional(),
    end: z.string().optional(),
});

export const ApplicantAssignmentSchema = z.object({
    status: z.string().min(1),
    employeeId: z.string().uuid(),
    assignedAt: TimestampSchema.optional(),
});

export const ApplicantSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    jobId: z.string().optional(),
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    positionApplied: z.string().optional(),
    yearsOfExperience: OneDecimalNumberSchema.optional(),
    currentSalary: z.number().int().optional(),
    expectedSalary: z.number().int().optional(),
    noticePeriod: z.string().optional(),
    resumeFile: z.string().optional(), // URL
    linkedinUrl: z.string().optional(),
    status: ApplicantStatusEnum,
    appliedDate: IsoDateSchema,
    assignments: z.array(ApplicantAssignmentSchema).optional(),
    documents: DocumentFilesSchema.optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const LeaveTypeSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    code: z.string().optional(),
    unit: LeaveUnitEnum,
    quota: z.number(),
    employmentType: EmploymentTypeEnum.optional(), // Can apply to specific types
    color: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const LeaveRecordSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    employeeId: z.string().min(1),
    employeeName: z.string().optional(),
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
    leaveTypeId: z.string().optional(),
    leaveTypeName: z.string().optional(),
    leaveTypeCode: z.string().optional(),
    leaveTypeQuota: z.number().optional(),
    leaveTypeColor: z.string().optional(),
    unit: LeaveUnitEnum,
    amount: TwoDecimalNumberSchema.optional(),
    startTime: z.string().optional(),
    endTime: z.string().optional(),
    note: z.string().optional(),

    documents: DocumentFilesSchema.optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
}).superRefine((data, ctx) => {
    if (data.startDate > data.endDate) {
        ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['startDate'],
            message: 'startDate must be on or before endDate',
        });
    }
    if (data.unit === 'Hour') {
        if (data.startDate !== data.endDate) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['endDate'],
                message: 'Hourly leave must be within a single day',
            });
        }
        if (data.amount === undefined) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ['amount'],
                message: 'Hourly leave requires amount (hours)',
            });
        }
    }
});

export const LeaveDaySchema = z.object({
    id: z.string().optional(),
    leaveRecordId: z.string().min(1),
    companyId: z.string().min(1),
    employeeId: z.string().min(1),
    leaveTypeId: z.string().optional(),
    leaveTypeColor: z.string().optional(),
    date: IsoDateSchema,
    dayOfWeek: WeekdayEnum,
    unit: LeaveUnitEnum,
    amount: TwoDecimalNumberSchema,
    isWorkingDay: z.boolean(),
    isHoliday: z.boolean(),
    isClosed: z.boolean(),
    countsTowardQuota: z.boolean(),
    workingHours: WorkDaySchema.optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const HolidaySchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    date: IsoDateSchema,
    name: z.string().min(1),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export type Applicant = z.infer<typeof ApplicantSchema>;
export type LeaveType = z.infer<typeof LeaveTypeSchema>;
export type LeaveRecord = z.infer<typeof LeaveRecordSchema>;
export type Holiday = z.infer<typeof HolidaySchema>;
export type LeaveDay = z.infer<typeof LeaveDaySchema>;

// Feedback & Documents
export const FeedbackSubjectEnum = z.string().min(1);
export const DocumentKindEnum = z.string().min(1);

export const FeedbackCardSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    title: z.string().min(1),
    subject: FeedbackSubjectEnum,
    questions: z.array(z.any()), // flexible schema for questions
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const FeedbackEntrySchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    type: FeedbackEntryTypeEnum.optional(),
    cardId: z.string().min(1),
    subjectType: z.string().min(1),
    subjectId: z.string().min(1),
    subjectName: z.string().optional(),
    authorId: z.string().optional(),
    answers: z.array(z.any()),
    card: FeedbackCardSchema.optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const EmployeeDocumentSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    employeeId: z.string().min(1),
    name: z.string().min(1),
    type: DocumentKindEnum,
    dataUrl: z.string().optional(), // Store URL or base64 (better URL)
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export type FeedbackCard = z.infer<typeof FeedbackCardSchema>;
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>;

// Resource Requests
export const ResourceRequestTypeSchema = z.enum(['resource', 'headcount', 'team_allocation']);

export const StaffingDetailsSchema = z.object({
    role: z.string().trim().min(2).max(120).optional(),
    headcount: z.number().int().min(1).max(100).optional(),
    skills: z.string().trim().max(1000).optional(),
    team: z.string().trim().min(2).max(120).optional(),
    startDate: z.string().date().optional(),
    employmentType: z.enum(['permanent', 'temporary']).optional(),
    teamMember: z.string().trim().min(2).max(120).optional(),
    allocationPercentage: z.number().int().min(1).max(100).optional(),
});

export const ResourceRequestSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    employeeId: z.string().min(1),
    title: z.string().min(1),
    category: z.string().min(1),
    description: z.string().optional(),
    goalAlignment: z.string().optional(),
    priority: z.enum(['low', 'normal', 'high', 'urgent']).default('normal'),
    estimatedCost: TwoDecimalNumberSchema.optional(),
    productUrl: z.string().url().optional().or(z.string().length(0)),
    status: z.string().optional(),
    reviewerNote: z.string().optional(),
    statusHistory: z.array(z.any()).optional(), // Store as generic jsonb in db
    attachments: DocumentFilesSchema.optional(),
    requestType: ResourceRequestTypeSchema.default('resource'),
    staffingDetails: StaffingDetailsSchema.optional(),
    employeeName: z.string().optional(),
    employeeEmail: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const ResourceRequestStatusPatchSchema = z.object({
    status: z.enum(['approved', 'rejected', 'fulfilled', 'cancelled']),
    reviewerNote: z.string().optional(),
});

export type ResourceRequest = z.infer<typeof ResourceRequestSchema>;

// Vendors
export const VendorSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    contactName: z.string().optional(),
    email: z.string().email().optional().or(z.string().length(0)),
    phone: z.string().optional(),
    isActive: z.boolean().default(true),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export type Vendor = z.infer<typeof VendorSchema>;

// Resources (assets, subscriptions, services, expenses, events, reimbursements)
export const ResourceTypeEnum = z.enum([
    'physical_asset',
    'book',
    'subscription',
    'service',
    'expense',
    'event',
    'reimbursement',
]);

export const ResourceStatusEnum = z.enum([
    'active',
    'inactive',
    'maintenance',
    'lost',
    'retired',
]);

export const ResourceAssignmentTypeEnum = z.enum([
    'person',
    'shared',
    'company',
    'unassigned',
    'not_applicable',
]);

export const ResourceCostTypeEnum = z.enum(['one_time', 'recurring']);

export const ResourceTemplateSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    resourceType: ResourceTypeEnum.default('subscription'),
    category: z.string().min(1),
    description: z.string().optional(),
    vendorId: z.string().uuid().optional().or(z.string().length(0)),
    defaultCostAmount: TwoDecimalNumberSchema.optional(),
    defaultCostType: ResourceCostTypeEnum.default('recurring'),
    defaultDetails: z.record(z.string(), z.any()).optional(),
    isActive: z.boolean().default(true),
    createdBy: z.string().uuid().optional().or(z.string().length(0)),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const ResourceTemplateUpdateSchema = ResourceTemplateSchema.pick({
    name: true,
    resourceType: true,
    category: true,
    description: true,
    vendorId: true,
    defaultCostAmount: true,
    defaultCostType: true,
    defaultDetails: true,
    isActive: true,
}).partial();

export type ResourceTemplate = z.infer<typeof ResourceTemplateSchema>;

export const ResourceSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    resourceTemplateId: z.string().uuid().optional().or(z.string().length(0)),
    vendorId: z.string().uuid().optional().or(z.string().length(0)),
    resourceType: ResourceTypeEnum.default('subscription'),
    name: z.string().min(1).default(''),
    category: z.string().min(1).default(''),
    description: z.string().optional(),
    identifier: z.string().optional(),
    status: ResourceStatusEnum.default('active'),
    assignmentType: ResourceAssignmentTypeEnum.default('not_applicable'),
    assignedToEmployeeId: z.string().uuid().optional().or(z.string().length(0)),
    location: z.string().optional(),
    assignedAt: TimestampSchema.optional(),
    assignmentHistory: z.array(z.any()).optional(),
    costAmount: TwoDecimalNumberSchema.optional(),
    costType: ResourceCostTypeEnum.optional(),
    expenseDate: IsoDateSchema.optional().or(z.string().length(0)),
    paidByEmployeeId: z.string().uuid().optional().or(z.string().length(0)),
    isSettled: z.boolean().default(true),
    attachments: DocumentFilesSchema.optional(),
    details: z.record(z.string(), z.any()).optional(),
    createdBy: z.string().uuid().optional().or(z.string().length(0)),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
}).superRefine((data, context) => {
    if (!data.resourceTemplateId && !data.name.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['name'], message: 'Name is required without a template' });
    }
    if (!data.resourceTemplateId && !data.category.trim()) {
        context.addIssue({ code: z.ZodIssueCode.custom, path: ['category'], message: 'Category is required without a template' });
    }
});

export const ResourceAssignmentPatchSchema = z.object({
    assignmentType: ResourceAssignmentTypeEnum,
    assignedToEmployeeId: z.string().uuid().optional().or(z.string().length(0)),
    location: z.string().optional(),
    note: z.string().optional(),
});

export type Resource = z.infer<typeof ResourceSchema>;
