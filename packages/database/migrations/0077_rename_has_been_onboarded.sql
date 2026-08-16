-- Rename onboarding flag to past-tense completed semantics
ALTER TABLE users RENAME COLUMN has_seen_onboarding TO has_been_onboarded;
