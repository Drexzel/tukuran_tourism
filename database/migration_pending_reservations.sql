-- ============================================================
-- Migration: add "Pending" status to reservations
-- ============================================================
-- Run this ONCE if your "tukuran_tourism" database was created before
-- online reservations required Beach Owner approval (i.e. your
-- `reservations.status` column is currently
-- ENUM('Confirmed','Cancelled','Expired')).
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
  MODIFY COLUMN status ENUM('Pending', 'Confirmed', 'Cancelled', 'Expired')
  NOT NULL DEFAULT 'Pending';

-- Any reservations that were auto-confirmed under the old behavior are left
-- as-is (still Confirmed) so you don't lose track of real bookings already
-- made. Only reservations submitted AFTER this migration will start as
-- "Pending" and need a Beach Owner's approval in Reservation Management.
