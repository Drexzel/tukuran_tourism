-- ============================================================
-- Migration: Beach Owner Update Requests
-- ============================================================
-- Adds the beach_update_requests table used by the "Beach Owner Request
-- to Tourism Personnel" feature: a Beach Owner can send a simple request
-- (update GCash number, add an accommodation/amenity, update the
-- entrance fee, or a general beach info update) which then shows up in
-- Tourism Personnel's "Update Requests" page for review, approval or
-- rejection, and editing. This is purely additive - no existing table,
-- column, or workflow is touched.
--
-- This file is OPTIONAL. The application already self-heals its own
-- schema on every request (see includes/db_connection.php), so this
-- table is created automatically the first time any page loads. This
-- file is provided only for administrators who prefer to run the
-- migration manually in phpMyAdmin / the MySQL CLI.
--
-- Running it more than once is safe (CREATE TABLE IF NOT EXISTS).
-- ============================================================

USE tukuran_tourism;

CREATE TABLE IF NOT EXISTS beach_update_requests (
  request_id      INT AUTO_INCREMENT PRIMARY KEY,
  beach_id        INT NOT NULL,
  owner_id        INT NULL,
  request_type    VARCHAR(50)  NOT NULL DEFAULT 'other',
  title           VARCHAR(200) NOT NULL DEFAULT '',
  details         TEXT NULL,
  requested_value VARCHAR(255) NOT NULL DEFAULT '',
  status          ENUM('Pending', 'Approved', 'Rejected') NOT NULL DEFAULT 'Pending',
  admin_notes     TEXT NULL,
  created_at      TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  reviewed_at     TIMESTAMP NULL,
  FOREIGN KEY (beach_id) REFERENCES beaches(beach_id) ON DELETE CASCADE
) ENGINE=InnoDB;
