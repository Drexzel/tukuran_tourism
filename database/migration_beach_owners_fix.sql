-- ============================================================
-- Migration: fix/repair the beach_owners table
-- ============================================================
-- Run this ONCE if you were getting:
--   SQLSTATE[42S22]: Column not found: 1054 Unknown column 'resort_name'
-- when creating a Beach Owner account. This means your "tukuran_tourism"
-- database was created before the beach_owners table had all the columns
-- api/add-beach-owner.php needs.
--
-- NOTE: As of this update, includes/db_connection.php also repairs this
-- table automatically every time the app connects to the database, so
-- running this file by hand is optional/for your own peace of mind - it
-- is safe to run even if the table is already correct.
--
-- HOW TO USE:
-- Open phpMyAdmin (http://localhost/phpmyadmin) or the MySQL CLI, select
-- the tukuran_tourism database, and run this file.
-- ============================================================

USE tukuran_tourism;

CREATE TABLE IF NOT EXISTS beach_owners (
  owner_id      INT AUTO_INCREMENT PRIMARY KEY,
  resort_name   VARCHAR(150) NOT NULL DEFAULT '',
  owner_name    VARCHAR(150) NOT NULL DEFAULT '',
  email         VARCHAR(150) NOT NULL UNIQUE,
  phone_number  VARCHAR(20)  NOT NULL DEFAULT '',
  username      VARCHAR(100) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  beach_id      INT NULL,
  status        ENUM('Active', 'Pending', 'Suspended') NOT NULL DEFAULT 'Active',
  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB;

-- If the table already existed but was missing columns, add them below.
-- These use a small stored procedure so they can be run safely even if
-- some (or all) of the columns already exist.

DELIMITER //
CREATE PROCEDURE tukuran_add_column_if_missing(
  IN tbl VARCHAR(64), IN col VARCHAR(64), IN col_def VARCHAR(255)
)
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = tbl AND COLUMN_NAME = col
  ) THEN
    SET @ddl = CONCAT('ALTER TABLE ', tbl, ' ADD COLUMN ', col, ' ', col_def);
    PREPARE stmt FROM @ddl;
    EXECUTE stmt;
    DEALLOCATE PREPARE stmt;
  END IF;
END //
DELIMITER ;

CALL tukuran_add_column_if_missing('beach_owners', 'resort_name', "VARCHAR(150) NOT NULL DEFAULT ''");
CALL tukuran_add_column_if_missing('beach_owners', 'owner_name', "VARCHAR(150) NOT NULL DEFAULT ''");
CALL tukuran_add_column_if_missing('beach_owners', 'email', "VARCHAR(150) NOT NULL DEFAULT ''");
CALL tukuran_add_column_if_missing('beach_owners', 'phone_number', "VARCHAR(20) NOT NULL DEFAULT ''");
CALL tukuran_add_column_if_missing('beach_owners', 'username', "VARCHAR(100) NULL");
CALL tukuran_add_column_if_missing('beach_owners', 'password_hash', "VARCHAR(255) NULL");
CALL tukuran_add_column_if_missing('beach_owners', 'beach_id', "INT NULL");
CALL tukuran_add_column_if_missing('beach_owners', 'status', "ENUM('Active','Pending','Suspended') NOT NULL DEFAULT 'Active'");
CALL tukuran_add_column_if_missing('beach_owners', 'created_at', "TIMESTAMP DEFAULT CURRENT_TIMESTAMP");

DROP PROCEDURE IF EXISTS tukuran_add_column_if_missing;
