-- Runs automatically the first time the Postgres container initializes its data volume.
-- Creates the separate database used by `npm test` (TEST_DATABASE_URL) so tests never touch real dev data.
CREATE DATABASE preppilot_test OWNER preppilot;
