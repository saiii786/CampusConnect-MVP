/**
 * Phrases typical of job/gig scams in India, refused in listings, quotes and messages (FR-603).
 * Matching is case-insensitive on whole phrases. Keep this list SHORT and specific — it blocks
 * honest users too if it is too broad. The founder/admin may edit it (each change → DEV_LOG).
 */
export const BLOCKED_PHRASES: readonly string[] = [
  'registration fee',
  'registration charges',
  'joining fee',
  'security deposit for job',
  'pay to get the job',
  'send me the otp',
  'share your otp',
  'tell me your otp',
  'upi pin',
  'atm pin',
  'investment double',
  'double your money',
];
