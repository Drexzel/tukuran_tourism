-- ============================================================
-- Migration: Age Bracket / Guest Breakdown
-- ============================================================
-- Adds the columns needed by the Age Bracket / Guest Breakdown
-- feature to two existing tables, WITHOUT touching any existing
-- column, row, or workflow:
--
--   reservations   -> how many guests the lead guest (main booker)
--                     declared in each age bracket on the Reservation
--                     Form (Landing page/reservation-form.html)
--   walk_in_visits -> the same breakdown captured on the Walk-in
--                     Visitor Registration form
--                     (Beach owner page/walk-in-registration.html)
--
-- Instead of asking for every guest's exact birthdate/age, only the
-- per-bracket counts are stored. Their sum is the total number of
-- visitors (num_visitors / total_visitors), which the forms fill in
-- automatically.
--
-- This file is OPTIONAL. The application already self-heals its own
-- schema on every request (see includes/db_connection.php,
-- ensureAgeBracketColumns()), so these columns are created
-- automatically the first time any page loads. This file is provided
-- only for administrators who prefer to run the migration manually in
-- phpMyAdmin / the MySQL CLI.
--
-- Running it more than once is safe: each ADD COLUMN uses IF NOT EXISTS.
-- NOTE ON SYNTAX: "ADD COLUMN IF NOT EXISTS" is supported by MariaDB
-- (which XAMPP ships) but NOT by Oracle MySQL. If your server rejects
-- these ALTER statements, skip this file entirely and just load any page
-- - db_connection.php adds the same columns automatically on either server.
-- ============================================================

USE tukuran_tourism;

-- ----- Reservation Form breakdown (lead guest supplies these) -----
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS age_kids         INT NOT NULL DEFAULT 0 AFTER female_count, -- 0-12
  ADD COLUMN IF NOT EXISTS age_teens        INT NOT NULL DEFAULT 0 AFTER age_kids,     -- 13-17
  ADD COLUMN IF NOT EXISTS age_adults_18_25 INT NOT NULL DEFAULT 0 AFTER age_teens,    -- 18-25
  ADD COLUMN IF NOT EXISTS age_adults_26_40 INT NOT NULL DEFAULT 0 AFTER age_adults_18_25, -- 26-40
  ADD COLUMN IF NOT EXISTS age_adults_41_59 INT NOT NULL DEFAULT 0 AFTER age_adults_26_40, -- 41-59
  ADD COLUMN IF NOT EXISTS age_seniors      INT NOT NULL DEFAULT 0 AFTER age_adults_41_59; -- 60+

-- ----- Walk-in Visitor Registration breakdown (same brackets) -----
ALTER TABLE walk_in_visits
  ADD COLUMN IF NOT EXISTS age_kids         INT NOT NULL DEFAULT 0 AFTER female_count, -- 0-12
  ADD COLUMN IF NOT EXISTS age_teens        INT NOT NULL DEFAULT 0 AFTER age_kids,     -- 13-17
  ADD COLUMN IF NOT EXISTS age_adults_18_25 INT NOT NULL DEFAULT 0 AFTER age_teens,    -- 18-25
  ADD COLUMN IF NOT EXISTS age_adults_26_40 INT NOT NULL DEFAULT 0 AFTER age_adults_18_25, -- 26-40
  ADD COLUMN IF NOT EXISTS age_adults_41_59 INT NOT NULL DEFAULT 0 AFTER age_adults_26_40, -- 41-59
  ADD COLUMN IF NOT EXISTS age_seniors      INT NOT NULL DEFAULT 0 AFTER age_adults_41_59; -- 60+
