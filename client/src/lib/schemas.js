/** Client-side validation rules (mirrors the server's Zod schemas). */
import { z } from 'zod';

const password = z
  .string()
  .min(8, 'Use at least 8 characters')
  .max(72, 'Use at most 72 characters')
  .regex(/[A-Za-z]/, 'Include at least one letter')
  .regex(/[0-9]/, 'Include at least one number');

const email = z.string().trim().min(1, 'Enter your email address').email('Enter a valid email address');

export const loginSchema = z.object({
  email,
  password: z.string().min(1, 'Enter your password'),
});

export const registerSchema = z
  .object({
    fullName: z.string().trim().min(3, 'Enter your full name'),
    email,
    role: z.enum(['STUDENT', 'STAFF'], { error: 'Choose student or staff' }),
    idNumber: z.string().trim().max(40).optional(),
    department: z.string().trim().max(120).optional(),
    phone: z
      .string()
      .trim()
      .optional()
      .refine((v) => !v || /^[0-9+\s-]{7,20}$/.test(v), 'Enter a valid phone number'),
    password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.password === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const requestSchema = z.object({
  categoryId: z.coerce.number({ error: 'Choose a category' }).int().positive('Choose a category'),
  title: z.string().trim().min(5, 'Use at least 5 characters').max(150, 'Use at most 150 characters'),
  description: z
    .string()
    .trim()
    .min(10, 'Describe the problem in at least 10 characters')
    .max(2000, 'Use at most 2000 characters'),
  location: z.string().trim().min(2, 'Enter the building or hostel').max(120),
  room: z.string().trim().max(60).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).nullish(),
});

export const userSchema = z.object({
  fullName: z.string().trim().min(3, 'Enter the full name'),
  email,
  role: z.enum(['STUDENT', 'STAFF', 'OFFICER', 'ADMIN']),
  password: z.union([z.literal(''), password]).optional(),
  phone: z.string().trim().max(20).optional(),
  department: z.string().trim().max(120).optional(),
  idNumber: z.string().trim().max(40).optional(),
  specialisation: z.string().trim().max(120).optional(),
});

export const passwordSchema = z
  .object({
    currentPassword: z.string().min(1, 'Enter your current password'),
    newPassword: password,
    confirmPassword: z.string(),
  })
  .refine((v) => v.newPassword === v.confirmPassword, {
    path: ['confirmPassword'],
    message: 'Passwords do not match',
  });

export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export const MAX_IMAGE_BYTES = 3 * 1024 * 1024;
export const MAX_IMAGES = 4;

/** Returns an error message for an invalid set of image files, or null. */
export function validateImages(files) {
  if (files.length > MAX_IMAGES) return `You can attach at most ${MAX_IMAGES} photos`;
  const badType = files.find((f) => !IMAGE_TYPES.includes(f.type));
  if (badType) return `${badType.name} is not a JPG, PNG or WEBP image`;
  const tooBig = files.find((f) => f.size > MAX_IMAGE_BYTES);
  if (tooBig) return `${tooBig.name} is larger than 3 MB`;
  return null;
}
