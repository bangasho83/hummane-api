import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const TimestampSchema = z.instanceof(Timestamp);
const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const IsoDateRangeSchema = z.union([
    IsoDateSchema,
    z.string().regex(/^\d{4}-\d{2}-\d{2}\/\d{4}-\d{2}-\d{2}$/),
]);

// Enums
export const EmploymentTypeEnum = z.enum(['Contract', 'Full-time', 'Intern', 'Part-time']);
export const GenderEnum = z.enum(['Male', 'Female', 'Non-binary', 'Prefer not to say']);
export const JobStatusEnum = z.enum(['open', 'closed']);
export const FeedbackEntryTypeEnum = z.enum(['interview', 'performance', 'onboarding', 'offboarding', 'general']);

const DocumentItemSchema = z.object({
    name: z.string().min(1),
    url: z.string().min(1),
});

const DocumentLinksSchema = z.object({
    files: z.array(DocumentItemSchema),
});

const DocumentFilesSchema = z.object({
    files: z.array(z.string()),
});

export const EmployeeSchema = z.object({
    id: z.string().optional(),
    employeeId: z.string().min(1),
    companyId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    department: z.string().optional(),
    roleId: z.string().optional(),
    startDate: IsoDateSchema,
    employmentType: EmploymentTypeEnum,
    reportingManager: z.string().optional(),
    gender: GenderEnum,
    salary: z.number().optional(),
    documents: DocumentLinksSchema.optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const DepartmentSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    desc: z.string().optional(),
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
    roleId: z.string().optional(),
    department: z.string().optional(),
    employmentType: EmploymentTypeEnum.optional(),
    location: z.string().optional(),
    salary: z.string().optional(), // Note: schema.json says salary is string/number? User brief says salary. Assuming string (range) or number. Brief says "salary". Let's assume string for range or formatted.
    experience: z.string().optional(),
    status: JobStatusEnum,
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export type Employee = z.infer<typeof EmployeeSchema>;
export type Department = z.infer<typeof DepartmentSchema>;
export type Role = z.infer<typeof RoleSchema>;
export type Job = z.infer<typeof JobSchema>;

// Remaining Enums
export const ApplicantStatusEnum = z.enum(['new', 'screening', 'interview', 'offer', 'rejected', 'hired']);
export const LeaveUnitEnum = z.enum(['Day', 'Hour']);

export const ApplicantSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    jobId: z.string().optional(),
    fullName: z.string().min(1),
    email: z.string().email(),
    phone: z.string().optional(),
    positionApplied: z.string().optional(),
    yearsOfExperience: z.string().or(z.number()).optional(),
    currentSalary: z.string().or(z.number()).optional(),
    expectedSalary: z.string().or(z.number()).optional(),
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
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export const LeaveRecordSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    employeeId: z.string().min(1),
    date: IsoDateRangeSchema,
    leaveTypeId: z.string().optional(),
    unit: LeaveUnitEnum.optional(),
    amount: z.number().optional(),
    note: z.string().optional(),
    documents: DocumentFilesSchema.optional(),
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

// Feedback & Documents
export const FeedbackSubjectEnum = z.enum(['Team Member', 'Applicant']);
export const DocumentKindEnum = z.enum(['Government ID', 'CV (Curriculum Vitae)', 'Educational Documents', 'Experience Letter', 'Salary Slip', 'Personality Test Report', 'Contract']);

export const FeedbackCardSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    title: z.string().min(1),
    subject: FeedbackSubjectEnum,
    questions: z.array(z.any()), // flexible schema for questions
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

const FeedbackEntrySubjectSchema = z.discriminatedUnion('kind', [
    z.object({
        kind: z.literal('Employee'),
        id: z.string().min(1),
        name: z.string().optional(),
    }),
    z.object({
        kind: z.literal('Applicant'),
        id: z.string().min(1),
        name: z.string().optional(),
    }),
]);

export const FeedbackEntrySchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    type: FeedbackEntryTypeEnum.optional(),
    cardId: z.string().min(1),
    subject: FeedbackEntrySubjectSchema,
    authorId: z.string().optional(),
    authorName: z.string().optional(),
    answers: z.array(z.any()),
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
    uploadedAt: TimestampSchema.optional(),
});

export type FeedbackCard = z.infer<typeof FeedbackCardSchema>;
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>;
