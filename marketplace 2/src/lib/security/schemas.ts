import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(8, 'Password must be at least 8 characters').max(128, 'Password too long'),
});

export const RegisterSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .max(128, 'Password too long')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string(),
  userType: z.enum(['creator', 'brand']),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
});

export const CreatePostSchema = z.object({
  content: z.string()
    .min(1, 'Post cannot be empty')
    .max(280, 'Post must be 280 characters or less')
    .transform((val) => val.trim()),
});

export const CreateOpportunitySchema = z.object({
  title: z.string()
    .min(5, 'Title must be at least 5 characters')
    .max(100, 'Title must be 100 characters or less')
    .transform((val) => val.trim()),
  description: z.string()
    .min(20, 'Description must be at least 20 characters')
    .max(1000, 'Description must be 1000 characters or less')
    .transform((val) => val.trim()),
  category: z.string()
    .min(1, 'Category is required')
    .max(50, 'Category name too long'),
  reward: z.string()
    .min(1, 'Reward is required')
    .max(200, 'Reward description too long'),
  deadline: z.enum(['1 week', '2 weeks', '3 weeks', '4 weeks']),
  requiredLevel: z.number().int().min(1).max(5),
});

export const ApplyToOpportunitySchema = z.object({
  opportunityId: z.number().int().positive(),
  pitch: z.string()
    .min(50, 'Pitch must be at least 50 characters')
    .max(500, 'Pitch must be 500 characters or less')
    .transform((val) => val.trim()),
});

export const MessageSchema = z.object({
  recipientId: z.string().uuid('Invalid recipient ID'),
  content: z.string()
    .min(1, 'Message cannot be empty')
    .max(2000, 'Message must be 2000 characters or less')
    .transform((val) => val.trim()),
});

export const UserProfileUpdateSchema = z.object({
  displayName: z.string()
    .min(2, 'Name must be at least 2 characters')
    .max(50, 'Name must be 50 characters or less')
    .transform((val) => val.trim())
    .optional(),
  bio: z.string()
    .max(160, 'Bio must be 160 characters or less')
    .transform((val) => val.trim())
    .optional(),
  profession: z.string()
    .max(100, 'Profession too long')
    .transform((val) => val.trim())
    .optional(),
});

export const WallItemSchema = z.object({
  id: z.string().uuid('Invalid item ID').optional(),
  type: z.enum(['image', 'video', 'voice']),
  url: z.string().url('Invalid media URL'),
  x: z.number().min(0).max(1000),
  y: z.number().min(0).max(1000),
  width: z.number().min(50).max(500),
  height: z.number().min(50).max(500),
  rotation: z.number().min(-180).max(180),
});

export const WallSchema = z.object({
  items: z.array(WallItemSchema).max(50, 'Wall cannot have more than 50 items'),
});

export type LoginInput = z.infer<typeof LoginSchema>;
export type RegisterInput = z.infer<typeof RegisterSchema>;
export type CreatePostInput = z.infer<typeof CreatePostSchema>;
export type CreateOpportunityInput = z.infer<typeof CreateOpportunitySchema>;
export type ApplyToOpportunityInput = z.infer<typeof ApplyToOpportunitySchema>;
export type MessageInput = z.infer<typeof MessageSchema>;
export type UserProfileUpdateInput = z.infer<typeof UserProfileUpdateSchema>;
export type WallInput = z.infer<typeof WallSchema>;

export function validateInput<T>(schema: z.ZodSchema<T>, data: unknown): { success: true; data: T } | { success: false; errors: string[] } {
  const result = schema.safeParse(data);
  
  if (result.success) {
    return { success: true, data: result.data };
  }
  
  const errors = result.error?.issues?.map((err) => {
    const path = err.path.length > 0 ? `${err.path.join('.')}: ` : '';
    return `${path}${err.message}`;
  }) || ['Validation failed'];
  
  return { success: false, errors };
}

export function sanitizeContent(content: string): string {
  return content
    .replace(/[<>]/g, '')
    .replace(/javascript:/gi, '')
    .replace(/on\w+=/gi, '')
    .trim();
}