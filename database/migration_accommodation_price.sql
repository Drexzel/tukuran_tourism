-- ============================================================
-- Migration: Accommodation Price per Unit
-- ============================================================
-- Adds a price_per_unit column to beach_accommodations so each
-- accommodation type on a beach can store its price per unit
-- (entered next to the number of units in the Add New Beach form
-- by Tourism Personnel). Purely additive - no existing column,
-- row, or workflow is changed.
--
-- This file is OPTIONAL. The application self-heals its own schema
-- on every request (see includes/db_connection.php,
-- ensureBeachAccommodationPriceColumn()), so this column is created
-- automatically the first time any page loads. This file is provided
-- only for administrators who prefer to run the migration manually.
--
-- Running it more than once is safe (ADD COLUMN IF NOT EXISTS).
-- NOTE: "ADD COLUMN IF NOT EXISTS" is supported by MariaDB (which
-- XAMPP ships). If your MySQL server rejects it, skip this file - the
-- self-heal in db_connection.php adds the same column automatically.
-- ============================================================

USE tukuran_tourism;

ALTER TABLE beach_accommodations
  ADD COLUMN IF NOT EXISTS price_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_units;
