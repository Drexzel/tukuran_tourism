-- ============================================================
-- Migration: add "Completed" status to reservations
-- ============================================================
-- Run this ONCE if your "tukuran_tourism" database predates the
-- Beach Owner's "Mark as Completed" action (i.e. your
-- `reservations.status` column does not yet accept 'Completed').
--
-- Note: this same change is also applied automatically and safely by
-- includes/db_connection.php on every request (self-healing), so running
-- this file by hand is optional - it's provided for anyone who prefers to
-- apply schema changes manually via phpMyAdmin/MySQL CLI.
--
-- If you are running tukuran_tourism.sql fresh, you already have the
-- updated column and do NOT need to run this file.
--
-- HOW TO USE:
-- Open phpMyAdmin (http://localhost/phpmyadmin) or the MySQL CLI, select
-- the tukuran_tourism database, and run this file.
-- ============================================================

USE tukuran_tourism;

ALTER TABLE reservations
  MODIFY COLUMN status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Expired')
  NOT NULL DEFAULT 'Pending';

-- Existing reservations are left as-is (still whatever status they already
-- had). 'Completed' is never set automatically by any date/ETA check - the
-- Beach Owner sets it manually, from Reservation Management, only after an
-- Approved (Confirmed) reservation's visit has actually happened.
