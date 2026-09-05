-- ============================================================
-- Migration: update incident_reports for the Incident Alert / Incident
-- Report modules (adds date/time columns, expands the status enum to
-- match the Tourism Personnel UI: Pending / Investigating / Resolved /
-- Closed).
-- ============================================================
-- Run this ONCE if your "tukuran_tourism" database already exists from an
-- earlier setup. If you are running tukuran_tourism.sql fresh, you already
-- have the updated table and do NOT need to run this file too.
-- ============================================================

USE tukuran_tourism;

ALTER TABLE incident_reports
  MODIFY COLUMN status ENUM('Pending', 'Investigating', 'Resolved', 'Closed') NOT NULL DEFAULT 'Pending';

ALTER TABLE incident_reports
  ADD COLUMN IF NOT EXISTS incident_date DATE NULL AFTER incident_type,
  ADD COLUMN IF NOT EXISTS incident_time TIME NULL AFTER incident_date;

-- Older MySQL/MariaDB versions don't support "ADD COLUMN IF NOT EXISTS".
-- If the statement above fails with a syntax error, run these two lines
-- instead (they'll simply error harmlessly if the columns already exist):
-- ALTER TABLE incident_reports ADD COLUMN incident_date DATE NULL AFTER incident_type;
-- ALTER TABLE incident_reports ADD COLUMN incident_time TIME NULL AFTER incident_date;
