import { z } from 'zod';

// Enums
export const EmploymentTypeEnum = z.enum(['Contract', 'Full-time', 'Intern', 'Part-time']);
export const GenderEnum = z.enum(['Male', 'Female', 'Non-binary', 'Prefer not to say']);

export const EmployeeSchema = z.object({
    id: z.string().optional(),
    employeeId: z.string().min(1),
    companyId: z.string().min(1),
    name: z.string().min(1),
    email: z.string().email(),
    position: z.string().min(1),
    department: z.string().optional(),
    roleId: z.string().optional(),
    startDate: z.string(), // ISO date
    employmentType: EmploymentTypeEnum,
    reportingManager: z.string().optional(),
    gender: GenderEnum,
    salary: z.number().optional(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const DepartmentSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    description: z.string().optional(),
    createdAt: z.string().optional(),
});

export const RoleSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    title: z.string().min(1),
    description: z.string().optional(),
    createdAt: z.string().optional(),
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
    status: z.enum(['open', 'closed']),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
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
    appliedDate: z.string(),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const LeaveTypeSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    name: z.string().min(1),
    code: z.string().optional(),
    unit: LeaveUnitEnum,
    quota: z.number(),
    employmentType: EmploymentTypeEnum.optional(), // Can apply to specific types
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const LeaveRecordSchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    employeeId: z.string().min(1),
    date: z.string(), // or range
    type: z.string(), // leave type name or ID? Schema says type.
    leaveTypeId: z.string().optional(),
    unit: LeaveUnitEnum.optional(),
    amount: z.number().optional(),
    note: z.string().optional(),
    attachments: z.array(z.string()).optional(),
    createdAt: z.string().optional(),
});

export const HolidaySchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    date: z.string(),
    name: z.string().min(1),
    createdAt: z.string().optional(),
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
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const FeedbackEntrySchema = z.object({
    id: z.string().optional(),
    companyId: z.string().min(1),
    type: z.string().optional(), // e.g. 'interview', 'performance'
    cardId: z.string().min(1),
    subjectId: z.string().optional(),
    subjectName: z.string().optional(),
    authorId: z.string().optional(),
    authorName: z.string().optional(),
    answers: z.array(z.any()),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
});

export const EmployeeDocumentSchema = z.object({
    id: z.string().optional(),
    employeeId: z.string().min(1),
    name: z.string().min(1),
    type: DocumentKindEnum,
    dataUrl: z.string().optional(), // Store URL or base64 (better URL)
    uploadedAt: z.string().optional(),
});

export type FeedbackCard = z.infer<typeof FeedbackCardSchema>;
export type FeedbackEntry = z.infer<typeof FeedbackEntrySchema>;
export type EmployeeDocument = z.infer<typeof EmployeeDocumentSchema>;
