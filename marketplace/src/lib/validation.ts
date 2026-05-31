import { z } from 'zod';

export const EmailSchema = z.string().email().max(255);
export const PasswordSchema = z.string().min(8).max(128);
export const UsernameSchema = z.string().min(3).max(50).regex(/^[a-zA-Z0-9_-]+$/);
export const IDSchema = z.number().int().positive();
export const UUIDSchema = z.string().uuid();

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { data?: T; error?: string } {
  try {
    const result = schema.parse(data);
    return { data: result };
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { error: err.errors[0].message };
    }
    return { error: 'Validation failed' };
  }
}

export const CreateAccountSchema = z.object({
  email: EmailSchema,
  password: PasswordSchema,
  display_name: z.string().min(1).max(255),
});

export const UpdateAccountSchema = z.object({
  display_name: z.string().min(1).max(255).optional(),
  avatar_url: z.string().url().optional(),
});

export const LoginSchema = z.object({
  email: EmailSchema,
  password: z.string(),
});
