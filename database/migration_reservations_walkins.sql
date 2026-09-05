-- ============================================================
-- Migration: add reservations + walk_in_visits tables
-- ============================================================
-- Run this ONCE if your "tukuran_tourism" database already exists from an
-- earlier setup and you don't want to drop/recreate it. If you are running
-- tukuran_tourism.sql fresh, you already have these tables and do NOT need
-- to run this file too.
--
-- HOW TO USE:
-- Open phpMyAdmin (http://localhost/phpmyadmin) or the MySQL CLI, select
-- the tukuran_tourism database, and run this file.
-- ============================================================

USE tukuran_tourism;

CREATE TABLE IF NOT EXISTS reservations (
  reservation_id   INT AUTO_INCREMENT PRIMARY KEY,
  beach_id         INT NOT NULL,
  full_name        VARCHAR(150) NOT NULL,
  contact_number   VARCHAR(20)  NOT NULL,
  email            VARCHAR(150) NOT NULL,
  origin           VARCHAR(150) DEFAULT '',
  num_visitors     INT NOT NULL DEFAULT 1,
  male_count       INT NOT NULL DEFAULT 0,
  female_count     INT NOT NULL DEFAULT 0,
  reservation_date DATE NOT NULL,
  eta_time         TIME NULL,
  special_guest    VARCHAR(150) DEFAULT '',
  status           ENUM('Confirmed', 'Cancelled', 'Expired') NOT NULL DEFAULT 'Confirmed',
  created_at       TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (beach_id) REFERENCES beaches(beach_id) ON DELETE CASCADE
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS walk_in_visits (
  walkin_id          INT AUTO_INCREMENT PRIMARY KEY,
  beach_id           INT NOT NULL,
  guest_name         VARCHAR(150) DEFAULT '',
  age                INT NULL,
  total_visitors     INT NOT NULL DEFAULT 1,
  male_count         INT NOT NULL DEFAULT 0,
  female_count       INT NOT NULL DEFAULT 0,
  origin             VARCHAR(150) DEFAULT '',
  local_visitors     INT NOT NULL DEFAULT 0,
  foreign_visitors   INT NOT NULL DEFAULT 0,
  accommodation_type VARCHAR(100) DEFAULT '',
  visit_date         DATE NOT NULL,
  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (beach_id) REFERENCES beaches(beach_id) ON DELETE CASCADE
) ENGINE=InnoDB;
