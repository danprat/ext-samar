-- Script to Grant Subscription to User
-- Run this in Supabase SQL Editor

-- Check current users and their subscription status
SELECT 
  id,
  email,
  subscription_expires_at,
  usage_count,
  CASE 
    WHEN subscription_expires_at IS NULL THEN 'NO_SUBSCRIPTION'
    WHEN subscription_expires_at > NOW() THEN 'ACTIVE'
    ELSE 'EXPIRED'
  END as status
FROM profiles
ORDER BY created_at DESC;

-- Grant LIFETIME subscription (expires in 50 years) to specific user
-- Replace 'user@example.com' with actual user email

UPDATE profiles 
SET subscription_expires_at = NOW() + INTERVAL '50 years'
WHERE email = 'user@example.com';

-- OR: Grant 3-month TRIAL subscription
-- UPDATE profiles 
-- SET subscription_expires_at = NOW() + INTERVAL '3 months'
-- WHERE email = 'user@example.com';

-- OR: Grant 1-month subscription
-- UPDATE profiles 
-- SET subscription_expires_at = NOW() + INTERVAL '1 month'
-- WHERE email = 'user@example.com';

-- Verify the update
SELECT 
  id,
  email,
  subscription_expires_at,
  usage_count,
  CASE 
    WHEN subscription_expires_at IS NULL THEN 'NO_SUBSCRIPTION'
    WHEN subscription_expires_at > NOW() THEN 'ACTIVE'
    ELSE 'EXPIRED'
  END as status
FROM profiles
WHERE email = 'user@example.com';
