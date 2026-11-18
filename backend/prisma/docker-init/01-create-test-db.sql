-- Runs once, when the local Docker Postgres volume is first created.
-- Creates the separate database used by automated integration tests,
-- so tests never touch development data.
CREATE DATABASE campusconnect_test OWNER cc;
