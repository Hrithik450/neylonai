-- Add onboarding tracking columns to users table for cross-browser persistence

ALTER TABLE users ADD COLUMN has_been_onboarded BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE users ADD COLUMN onboarding_step INTEGER NOT NULL DEFAULT 1;
