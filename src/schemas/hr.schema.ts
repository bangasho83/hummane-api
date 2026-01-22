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
    employmentType: EmploymentTypeEnum.optional(),
    employmentMode: EmploymentModeEnum.optional(),
    city: z.string().optional(),
    country: z.string().optional(),
    salaryFrom: z.number().int().optional(),
    salaryTo: z.number().int().optional(),
    experience: z.string().optional(),
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
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
    leaveTypeId: z.string().optional(),
    leaveTypeName: z.string().optional(),
    leaveTypeCode: z.string().optional(),
    leaveTypeQuota: z.number().optional(),
    leaveTypeColor: z.string().optional(),
    unit: LeaveUnitEnum,
    amount: TwoDecimalNumberSchema.optional(),
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
