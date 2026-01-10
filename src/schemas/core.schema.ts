import { Timestamp } from 'firebase-admin/firestore';
import { z } from 'zod';

const TimestampSchema = z.instanceof(Timestamp);

export const UserSchema = z.object({
    id: z.string().optional(), // generated on server
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().optional(), // hashed, might not be needed if using Firebase Auth strictly, but kept for legacy
    companyId: z.string().optional(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

const WorkDaySchema = z.object({
    open: z.boolean(),
    start: z.string().optional(),
    end: z.string().optional(),
});

const WorkingHoursSchema = z.object({
    monday: WorkDaySchema,
    tuesday: WorkDaySchema,
    wednesday: WorkDaySchema,
    thursday: WorkDaySchema,
    friday: WorkDaySchema,
    saturday: WorkDaySchema,
    sunday: WorkDaySchema,
});

export const CompanySchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    industry: z.string().optional(),
    size: z.string().optional(),
    currency: z.string().optional(),
    timezone: z.string().optional(),
    workingHours: WorkingHoursSchema.optional(),
    ownerId: z.string(),
    createdAt: TimestampSchema.optional(),
    updatedAt: TimestampSchema.optional(),
});

export type User = z.infer<typeof UserSchema>;
export type Company = z.infer<typeof CompanySchema>;
