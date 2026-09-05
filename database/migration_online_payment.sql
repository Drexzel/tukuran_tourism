-- ============================================================
-- Migration: Online Down Payment Processing
-- ============================================================
-- Adds the columns needed by the Online Down Payment Processing
-- feature to two existing tables, WITHOUT touching any existing
-- column, row, or workflow:
--
--   beaches      -> the resort's payment details (shown to the tourist
--                   on the Reservation Form, per selected beach)
--   reservations -> the payment the tourist submitted (reference number,
--                   proof of payment file, status, amount, date/time)
--
-- This file is OPTIONAL. The application already self-heals its own
-- schema on every request (see includes/db_connection.php), so these
-- columns are created automatically the first time any page loads.
-- This file is provided only for administrators who prefer to run the
-- migration manually in phpMyAdmin / the MySQL CLI.
--
-- Running it more than once is safe: each ADD COLUMN uses IF NOT EXISTS.
-- NOTE ON SYNTAX: "ADD COLUMN IF NOT EXISTS" is supported by MariaDB
-- (which XAMPP ships) but NOT by Oracle MySQL. If your server rejects
-- these ALTER statements, skip this file entirely and just load any page
-- - db_connection.php adds the same columns automatically on either server.
-- ============================================================

USE tukuran_tourism;

-- ----- Resort payment details (configured in Beach Management) -----
ALTER TABLE beaches
  ADD COLUMN IF NOT EXISTS gcash_number        VARCHAR(30)  NOT NULL DEFAULT '' AFTER website,
  ADD COLUMN IF NOT EXISTS gcash_name          VARCHAR(150) NOT NULL DEFAULT '' AFTER gcash_number,
  ADD COLUMN IF NOT EXISTS gcash_qr            VARCHAR(500) NOT NULL DEFAULT '' AFTER gcash_name,
  ADD COLUMN IF NOT EXISTS bank_name           VARCHAR(150) NOT NULL DEFAULT '' AFTER gcash_qr,
  ADD COLUMN IF NOT EXISTS bank_account_name   VARCHAR(150) NOT NULL DEFAULT '' AFTER bank_name,
  ADD COLUMN IF NOT EXISTS bank_account_number VARCHAR(50)  NOT NULL DEFAULT '' AFTER bank_account_name;

-- ----- Tourist's submitted payment (attached to each reservation) -----
ALTER TABLE reservations
  ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(100)  NOT NULL DEFAULT ''        AFTER special_guest,
  ADD COLUMN IF NOT EXISTS proof_of_payment  VARCHAR(500)  NOT NULL DEFAULT ''        AFTER payment_reference,
  ADD COLUMN IF NOT EXISTS payment_status    VARCHAR(30)   NOT NULL DEFAULT 'Unpaid'  AFTER proof_of_payment,
  ADD COLUMN IF NOT EXISTS amount_paid       DECIMAL(10,2) NULL                       AFTER payment_status,
  ADD COLUMN IF NOT EXISTS payment_date      DATETIME      NULL                       AFTER amount_paid;
