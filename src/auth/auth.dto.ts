import { z } from 'zod';

export const LoginDtoSchema = z.object({
    firebaseToken: z.string().min(1),
});

export type LoginDto = z.infer<typeof LoginDtoSchema>;

export interface JwtPayload {
    sub: string; // User ID (Hummane ID)
    email: string;
    companyId?: string;
}
