-- ============================================================
-- Migration: Guest Type (Local / Foreign)
-- ============================================================
-- Adds the two columns needed to record each reservation's Guest Type
-- breakdown, WITHOUT touching any existing column, row, or workflow:
--
--   reservations   -> local_visitors / foreign_visitors, filled in from
--                     the new "Guest Type" field on the Reservation Form
--                     (Landing page/reservation-form.html). Previously
--                     missing entirely, so reservations could never be
--                     classified as Local or Foreign.
--   walk_in_visits -> local_visitors / foreign_visitors already exist on
--                     every installation (see database/tukuran_tourism.sql
--                     / migration_reservations_walkins.sql) and are left
--                     unchanged here.
--
-- In both tables, local_visitors + foreign_visitors always equals the
-- record's total guest count (num_visitors / total_visitors) - Local is
-- simply "everyone who isn't Foreign", so no guest is ever double-counted.
--
-- This file is OPTIONAL. The application already self-heals its own
-- schema on every request (see includes/db_connection.php,
-- ensureGuestTypeColumns()), so this column is created automatically the
-- first time any page loads. This file is provided only for administrators
-- who prefer to run the migration manually in phpMyAdmin / the MySQL CLI.
--
-- Running it more than once is safe: each ADD COLUMN uses IF NOT EXISTS.
-- NOTE ON SYNTAX: "ADD COLUMN IF NOT EXISTS" is supported by MariaDB
-- (which XAMPP ships) but NOT by Oracle MySQL. If your server rejects
-- these ALTER statements, skip this file entirely and just load any page
-- - db_connection.php adds the same columns automatically on either server.
-- ============================================================

USE tukuran_tourism;

ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS local_visitors   INT NOT NULL DEFAULT 0 AFTER age_seniors,
  ADD COLUMN IF NOT EXISTS foreign_visitors INT NOT NULL DEFAULT 0 AFTER local_visitors;

-- walk_in_visits.local_visitors / foreign_visitors already exist (see
-- migration_reservations_walkins.sql / tukuran_tourism.sql). Included here
-- only as a safety net for older/partial databases.
ALTER TABLE walk_in_visits
  ADD COLUMN IF NOT EXISTS local_visitors   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS foreign_visitors INT NOT NULL DEFAULT 0;
