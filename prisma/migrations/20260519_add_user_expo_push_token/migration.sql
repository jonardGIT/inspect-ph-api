-- Add expoPushToken field to User model for mobile push notification registration
ALTER TABLE "User" ADD COLUMN "expoPushToken" TEXT;
