import { z } from 'zod';

export const UserSchema = z.object({
    id: z.string().optional(), // generated on server
    name: z.string().min(1),
    email: z.string().email(),
    password: z.string().optional(), // hashed, might not be needed if using Firebase Auth strictly, but kept for legacy
    companyId: z.string().optional(),
    createdAt: z.string().optional(),
});

export const CompanySchema = z.object({
    id: z.string().optional(),
    name: z.string().min(1),
    industry: z.string().optional(),
    size: z.string().optional(),
    currency: z.string().optional(),
    ownerId: z.string(),
    createdAt: z.string().optional(),
});

export type User = z.infer<typeof UserSchema>;
export type Company = z.infer<typeof CompanySchema>;
