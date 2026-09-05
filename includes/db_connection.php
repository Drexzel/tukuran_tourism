<?php
/**
 * Database Connection Configuration
 * Tukuran Tourism System
 */

function getDB() {
    // ================= XAMPP (localhost) MySQL settings =================
    // ACTIVE settings for running this project locally in XAMPP.
    // Default XAMPP MySQL uses host "localhost", user "root" and an
    // empty password. The database name must match the one created by
    // database/tukuran_tourism.sql (which is "tukuran_tourism").
    $dbhost = "localhost";
    $dbuser = "root";
    $dbpass = "";
    $dbname = "tukuran_tourism";
    // ====================================================================

    // ================= InfinityFree (domain) MySQL settings =============
    // To switch back to the live domain later, comment out the four
    // XAMPP lines above and uncomment the four lines below. Replace the
    // $dbhost placeholder with the exact "MySQL Hostname" shown in your
    // InfinityFree Control Panel -> "MySQL Databases"
    // (it looks like sqlXXX.infinityfree.com).
    // $dbhost = "sqlXXX.infinityfree.com"; // <-- your MySQL Hostname from the panel
    // $dbuser = "if0_42451442";
    // $dbpass = "ICb1g9KTi0";
    // $dbname = "if0_42451442_tukuran";
    // ====================================================================

    try {
        // Establish connection using PDO
        $dbConnection = new PDO("mysql:host=$dbhost;dbname=$dbname;charset=utf8", $dbuser, $dbpass);
        
        // Set error mode to throw exceptions so we can catch bugs instantly
        $dbConnection->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);

        // Make sure the beach_owners table matches what the rest of the
        // app expects (fixes "Unknown column 'resort_name'" on databases
        // that were created before this table's columns were finalized).
        ensureBeachOwnersTable($dbConnection);

        // Make sure reservations/walk_in_visits exist (fixes
        // "Base table or view not found: reservations / walk_in_visits" on
        // databases created before these tables were added - without them,
        // api/dashboard-stats.php's whole response fails, which is why the
        // Total Beaches card - and every other stat - stayed blank).
        ensureReservationAndWalkInTables($dbConnection);

        // Make sure incident_reports has the columns/status values the
        // Incident Alert (Beach Owner) and Incident Report (Tourism
        // Personnel) pages need (fixes both a missing table on older
        // databases and a status enum that predates incident_date/
        // incident_time being tracked).
        ensureIncidentReportsTable($dbConnection);

        // Make sure beaches.owner_name allows being left blank (fixes
        // "Field 'owner_name' doesn't have a default value" on databases
        // created before the Add Beach form stopped collecting this field
        // - the owner name is now looked up from the linked Beach Owner
        // account instead, see api/get-beaches.php).
        ensureBeachesOwnerNameOptional($dbConnection);

        // Make sure the Online Down Payment Processing columns exist on
        // both the beaches table (the resort's GCash/bank details shown on
        // the Reservation Form) and the reservations table (the payment
        // reference, proof-of-payment file, status, amount and date/time
        // the tourist submits). These are purely additive - no existing
        // column, row or workflow is touched - and are created here so the
        // payment feature works without any manual SQL migration step
        // (database/migration_online_payment.sql is the manual equivalent).
        ensurePaymentColumns($dbConnection);

        // Make sure the Age Bracket / Guest Breakdown columns exist on both
        // the reservations table (the lead guest's per-bracket guest counts
        // submitted on the Reservation Form) and the walk_in_visits table
        // (the same breakdown entered on the Walk-in Visitor Registration
        // form). These are purely additive - every column has a safe
        // default, so existing rows and every existing INSERT/SELECT keep
        // working untouched - and are created here so the feature works
        // without any manual SQL migration step
        // (database/migration_age_brackets.sql is the manual equivalent).
        ensureAgeBracketColumns($dbConnection);

        // Make sure the Guest Type (Local / Foreign) columns exist on the
        // reservations table - walk_in_visits already has local_visitors /
        // foreign_visitors, but reservations never did, which is why the
        // Reservation Form's guest type could never be counted correctly in
        // Visitor Demographics / Automated Reports. Purely additive, INT NOT
        // NULL DEFAULT 0, so existing rows and every existing INSERT/SELECT
        // keep working untouched (database/migration_guest_type.sql is the
        // manual equivalent).
        ensureGuestTypeColumns($dbConnection);

        // Make sure the beach_accommodations table has a price_per_unit column
        // (the price per unit Tourism Personnel enter for each accommodation
        // type in the Add New Beach form, alongside the number of units). This
        // is purely additive - the column defaults to 0, so existing rows and
        // every existing INSERT/SELECT keep working untouched - and is created
        // here so the feature works without a manual SQL migration step
        // (database/migration_accommodation_price.sql is the manual equivalent).
        ensureBeachAccommodationPriceColumn($dbConnection);

        // Make sure the Beach Owner -> Tourism Personnel "Update Requests"
        // table exists (Beach Owners submit requests such as updating their
        // GCash number or adding accommodations/amenities; Tourism Personnel
        // review, approve or reject them). Created here so the feature works
        // without a manual SQL migration step
        // (database/migration_update_requests.sql is the manual equivalent).
        ensureBeachUpdateRequestsTable($dbConnection);

        // Make sure the "reviews" table exists and has a reviewer_name
        // column (Beach Details page's tourist review form). This is the
        // same table already defined in database/tukuran_tourism.sql -
        // created here too, self-healing style, so databases set up before
        // the review form was wired to the database don't 404/error out.
        // Purely additive - no existing column, row or workflow is touched
        // (database/migration_reviews.sql is the manual equivalent).
        ensureReviewsTable($dbConnection);

        // Make sure the default Tourism Personnel (Admin) account exists so
        // the system can be logged into immediately after database setup.
        // The password is hashed here with the app's standard
        // password_hash()/bcrypt method - the plain credentials are never
        // stored in, or exposed to, the login page or any frontend file.
        ensureDefaultAdminAccount($dbConnection);

        // Return the active connection object
        return $dbConnection;
        
    } catch (PDOException $e) {
        // If connection fails, output a clean JSON response for your frontend
        header('Content-Type: application/json');
        echo json_encode([
            "success" => false,
            "message" => "Database connection failed: " . $e->getMessage()
        ]);
        exit;
    }
}

/**
 * Self-healing check for the beach_owners table (Beach Owner accounts).
 *
 * Older/partial copies of this project's database may not have the
 * beach_owners table at all, or may be missing columns such as
 * `resort_name` that api/add-beach-owner.php and api/get-beach-owners.php
 * rely on - which is exactly what causes:
 *   "SQLSTATE[42S22]: Column not found: 1054 Unknown column 'resort_name'"
 *
 * Rather than requiring a manual SQL migration step, this runs a quick,
 * cheap check on every request and creates the table / adds any missing
 * column automatically, so Beach Owner account creation always works
 * against the schema the app expects (see database/tukuran_tourism.sql
 * for the canonical/full definition).
 */
function ensureBeachOwnersTable($conn) {
    try {
        $tableExists = $conn->query("SHOW TABLES LIKE 'beach_owners'")->rowCount() > 0;

        if (!$tableExists) {
            $conn->exec("
                CREATE TABLE beach_owners (
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
                ) ENGINE=InnoDB
            ");
            return;
        }

        // Table exists (possibly from an older version) - check for any
        // columns the current app code needs and add whichever are missing.
        $existingColumns = [];
        foreach ($conn->query("SHOW COLUMNS FROM beach_owners")->fetchAll(PDO::FETCH_ASSOC) as $col) {
            $existingColumns[$col['Field']] = true;
        }

        $requiredColumns = [
            'resort_name'   => "ADD COLUMN resort_name VARCHAR(150) NOT NULL DEFAULT '' AFTER owner_id",
            'owner_name'    => "ADD COLUMN owner_name VARCHAR(150) NOT NULL DEFAULT ''",
            'email'         => "ADD COLUMN email VARCHAR(150) NOT NULL DEFAULT ''",
            'phone_number'  => "ADD COLUMN phone_number VARCHAR(20) NOT NULL DEFAULT ''",
            'username'      => "ADD COLUMN username VARCHAR(100) NULL",
            'password_hash' => "ADD COLUMN password_hash VARCHAR(255) NULL",
            'beach_id'      => "ADD COLUMN beach_id INT NULL",
            'status'        => "ADD COLUMN status ENUM('Active','Pending','Suspended') NOT NULL DEFAULT 'Active'",
            'created_at'    => "ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP"
        ];

        foreach ($requiredColumns as $columnName => $alterClause) {
            if (!isset($existingColumns[$columnName])) {
                try {
                    $conn->exec("ALTER TABLE beach_owners {$alterClause}");
                } catch (Exception $colErr) {
                    // Log and continue - one column failing to add (e.g. an
                    // "AFTER owner_id" reference issue on an unusual table)
                    // should not block the rest from being added.
                    error_log('ensureBeachOwnersTable: could not add column ' . $columnName . ': ' . $colErr->getMessage());
                }
            }
        }
    } catch (Exception $e) {
        // Never let a schema-repair issue take down the whole request;
        // the calling script's own try/catch will still surface any real
        // SQL error from the actual query it tries to run.
        error_log('ensureBeachOwnersTable warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for beaches.owner_name.
 *
 * The Add Beach form used to require a manually-typed owner name, so the
 * column was created as NOT NULL with no default. Now that the owner name
 * is always looked up from the linked Beach Owner account (beach_owners
 * table) instead of being entered on the form, api/add-beach.php no
 * longer supplies a value for it - which would otherwise fail on any
 * database still using the original strict column definition. This
 * relaxes it to NOT NULL DEFAULT '' (matching how beaches.phone is
 * already defined) so inserts keep working either way.
 */
function ensureBeachesOwnerNameOptional($conn) {
    try {
        $tableExists = $conn->query("SHOW TABLES LIKE 'beaches'")->rowCount() > 0;
        if (!$tableExists) {
            return;
        }

        $column = $conn->query("SHOW COLUMNS FROM beaches WHERE Field = 'owner_name'")->fetch(PDO::FETCH_ASSOC);

        if (!$column) {
            // The column is missing entirely on this database. api/get-beaches.php
            // selects COALESCE(bo.owner_name, b.owner_name), so without it every
            // beach lookup fails with "Unknown column 'b.owner_name' in 'field
            // list'". Add it (already-blank is fine - the real owner name comes
            // from the linked beach_owners account).
            $conn->exec("ALTER TABLE beaches ADD COLUMN owner_name VARCHAR(150) NOT NULL DEFAULT ''");
            return;
        }

        if ($column['Null'] === 'NO' && ($column['Default'] === null)) {
            $conn->exec("ALTER TABLE beaches MODIFY owner_name VARCHAR(150) NOT NULL DEFAULT ''");
        }
    } catch (Exception $e) {
        error_log('ensureBeachesOwnerNameOptional warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the reservations and walk_in_visits tables.
 *
 * These power the Tourism Personnel Dashboard's visitor/reservation stats
 * (api/dashboard-stats.php) as well as the Beach Owner's Reservation
 * Management and Walk-in Registration pages. A database created before
 * these tables were introduced (see database/migration_reservations_
 * walkins.sql) is missing them entirely, which throws:
 *   "Base table or view not found: 'reservations'" (or 'walk_in_visits')
 * Because dashboard-stats.php runs all of its queries in one request, a
 * single missing table fails the ENTIRE response - which is why every
 * card on the dashboard, including Total Beaches, could stay blank even
 * though the beaches table itself was fine. Creating these tables (only
 * if they don't already exist) up front prevents that.
 */
function ensureReservationAndWalkInTables($conn) {
    try {
        $hasReservations = $conn->query("SHOW TABLES LIKE 'reservations'")->rowCount() > 0;
        if (!$hasReservations) {
    $conn->exec("
        CREATE TABLE reservations (
          reservation_id     INT AUTO_INCREMENT PRIMARY KEY,
          beach_id           INT NOT NULL,
          full_name          VARCHAR(150) NOT NULL,
          contact_number     VARCHAR(20)  NOT NULL,
          email              VARCHAR(150) NOT NULL,
          origin             VARCHAR(150) DEFAULT '',
          num_visitors       INT NOT NULL DEFAULT 1,
          male_count         INT NOT NULL DEFAULT 0,
          female_count       INT NOT NULL DEFAULT 0,
          reservation_date   DATE NOT NULL,
          eta_time           TIME NULL,
          accommodation_type VARCHAR(100) DEFAULT 'none',
          status             ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Expired') NOT NULL DEFAULT 'Pending',
          rejection_reason   TEXT NULL,
          created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
        ) ENGINE=InnoDB
    ");
} else {
    // Table exists but may predate the Pending-approval workflow
    // (see migration_pending_reservations.sql) or the Mark as Completed
    // workflow (see migration_reservation_completed.sql) - make sure the
    // status column can hold 'Pending' and 'Completed' too. 'Confirmed'
    // is displayed to the Beach Owner/Tourist/Tourism Personnel as
    // "Approved"; 'Completed' is only ever set manually by the Beach
    // Owner (Mark as Completed action) after they confirm the tourist
    // actually visited - never inferred automatically from the date/ETA.
    try {
        $conn->exec("
            ALTER TABLE reservations
            MODIFY COLUMN status ENUM('Pending', 'Confirmed', 'Completed', 'Cancelled', 'Expired')
            NOT NULL DEFAULT 'Pending'
        ");
    } catch (Exception $modifyErr) {
        error_log('ensureReservationAndWalkInTables: could not update reservations.status: ' . $modifyErr->getMessage());
    }
    
    // Check if accommodation_type column exists, add if missing
    $hasAccommodation = false;
    try {
        $columns = $conn->query("SHOW COLUMNS FROM reservations LIKE 'accommodation_type'")->fetchAll();
        $hasAccommodation = count($columns) > 0;
    } catch (Exception $colErr) {
        error_log('ensureReservationAndWalkInTables: could not check accommodation_type: ' . $colErr->getMessage());
    }
    
    if (!$hasAccommodation) {
        try {
            $conn->exec("ALTER TABLE reservations ADD COLUMN accommodation_type VARCHAR(100) DEFAULT 'none' AFTER special_guest");
        } catch (Exception $addErr) {
            error_log('ensureReservationAndWalkInTables: could not add accommodation_type: ' . $addErr->getMessage());
        }
    }

    // Check if rejection_reason column exists, add if missing. Stores the
    // optional note a Beach Owner types in when rejecting a reservation, so
    // it can be shown back in the details modal and included in the
    // "Reservation Update" (rejected) email sent to the tourist.
    $hasRejectionReason = false;
    try {
        $columns = $conn->query("SHOW COLUMNS FROM reservations LIKE 'rejection_reason'")->fetchAll();
        $hasRejectionReason = count($columns) > 0;
    } catch (Exception $colErr) {
        error_log('ensureReservationAndWalkInTables: could not check rejection_reason: ' . $colErr->getMessage());
    }

    if (!$hasRejectionReason) {
        try {
            $conn->exec("ALTER TABLE reservations ADD COLUMN rejection_reason TEXT NULL AFTER status");
        } catch (Exception $addErr) {
            error_log('ensureReservationAndWalkInTables: could not add rejection_reason: ' . $addErr->getMessage());
        }
    }
}

        $hasWalkIns = $conn->query("SHOW TABLES LIKE 'walk_in_visits'")->rowCount() > 0;
        if (!$hasWalkIns) {
            $conn->exec("
                CREATE TABLE walk_in_visits (
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
                  created_at         TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            ");
        }
    } catch (Exception $e) {
        error_log('ensureReservationAndWalkInTables warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the incident_reports table (Incident Alert /
 * Incident Report modules).
 *
 * A database created before api/incidents.php was implemented is missing
 * this table entirely, or has an older version of it (no incident_date /
 * incident_time columns, and a status enum of Open/In Progress/Resolved
 * instead of the Pending/Investigating/Resolved/Closed values the
 * Tourism Personnel UI actually uses) - see
 * database/migration_incident_reports.sql for the manual equivalent.
 */
function ensureIncidentReportsTable($conn) {
    try {
        $hasTable = $conn->query("SHOW TABLES LIKE 'incident_reports'")->rowCount() > 0;

        if (!$hasTable) {
            $conn->exec("
                CREATE TABLE incident_reports (
                  incident_id    INT AUTO_INCREMENT PRIMARY KEY,
                  beach_id       INT NOT NULL,
                  reported_by    VARCHAR(150) DEFAULT '',
                  incident_type  VARCHAR(150) NOT NULL,
                  incident_date  DATE NULL,
                  incident_time  TIME NULL,
                  description    TEXT,
                  status         ENUM('Pending', 'Investigating', 'Resolved', 'Closed') NOT NULL DEFAULT 'Pending',
                  created_at     TIMESTAMP DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            ");
            return;
        }

        $existingColumns = [];
        foreach ($conn->query("SHOW COLUMNS FROM incident_reports")->fetchAll(PDO::FETCH_ASSOC) as $col) {
            $existingColumns[$col['Field']] = true;
        }

        if (!isset($existingColumns['incident_date'])) {
            try {
                $conn->exec("ALTER TABLE incident_reports ADD COLUMN incident_date DATE NULL AFTER incident_type");
            } catch (Exception $colErr) {
                error_log('ensureIncidentReportsTable: could not add incident_date: ' . $colErr->getMessage());
            }
        }
        if (!isset($existingColumns['incident_time'])) {
            try {
                $conn->exec("ALTER TABLE incident_reports ADD COLUMN incident_time TIME NULL AFTER incident_date");
            } catch (Exception $colErr) {
                error_log('ensureIncidentReportsTable: could not add incident_time: ' . $colErr->getMessage());
            }
        }

        try {
            $conn->exec("
                ALTER TABLE incident_reports
                MODIFY COLUMN status ENUM('Pending', 'Investigating', 'Resolved', 'Closed')
                NOT NULL DEFAULT 'Pending'
            ");
        } catch (Exception $modifyErr) {
            error_log('ensureIncidentReportsTable: could not update status enum: ' . $modifyErr->getMessage());
        }
    } catch (Exception $e) {
        error_log('ensureIncidentReportsTable warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the Online Down Payment Processing columns.
 *
 * Adds, only if missing:
 *   beaches.gcash_number, gcash_name, gcash_qr,
 *   beaches.bank_name, bank_account_name, bank_account_number
 *     -> the resort's payment details, configured in Beach Management and
 *        shown to the tourist on the Reservation Form (they change with
 *        the selected beach).
 *
 *   reservations.payment_reference, proof_of_payment, payment_status,
 *   reservations.amount_paid, payment_date
 *     -> the payment the tourist submits with the reservation, shown back
 *        to the Beach Owner in Reservation Management for verification.
 *
 * Every column is added with a safe default so existing rows and every
 * existing INSERT/SELECT keep working untouched. A failure to add any one
 * column is logged and skipped rather than breaking the request.
 */
function ensurePaymentColumns($conn) {
    // Small helper: add a column only when it isn't already present.
    $addIfMissing = function ($table, $column, $definition) use ($conn) {
        try {
            $exists = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE " . $conn->quote($column))->rowCount() > 0;
            if (!$exists) {
                $conn->exec("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
            }
        } catch (Exception $colErr) {
            error_log("ensurePaymentColumns: could not add {$table}.{$column}: " . $colErr->getMessage());
        }
    };

    try {
        // --- beaches: resort payment details ---
        if ($conn->query("SHOW TABLES LIKE 'beaches'")->rowCount() > 0) {
            $addIfMissing('beaches', 'gcash_number',        "gcash_number VARCHAR(30) NOT NULL DEFAULT ''");
            $addIfMissing('beaches', 'gcash_name',          "gcash_name VARCHAR(150) NOT NULL DEFAULT ''");
            $addIfMissing('beaches', 'gcash_qr',            "gcash_qr VARCHAR(500) NOT NULL DEFAULT ''");
            $addIfMissing('beaches', 'bank_name',           "bank_name VARCHAR(150) NOT NULL DEFAULT ''");
            $addIfMissing('beaches', 'bank_account_name',   "bank_account_name VARCHAR(150) NOT NULL DEFAULT ''");
            $addIfMissing('beaches', 'bank_account_number', "bank_account_number VARCHAR(50) NOT NULL DEFAULT ''");
        }

        // --- reservations: tourist's submitted payment ---
        if ($conn->query("SHOW TABLES LIKE 'reservations'")->rowCount() > 0) {
            $addIfMissing('reservations', 'payment_reference', "payment_reference VARCHAR(100) NOT NULL DEFAULT ''");
            $addIfMissing('reservations', 'proof_of_payment',  "proof_of_payment VARCHAR(500) NOT NULL DEFAULT ''");
            $addIfMissing('reservations', 'payment_status',    "payment_status VARCHAR(30) NOT NULL DEFAULT 'Unpaid'");
            $addIfMissing('reservations', 'amount_paid',       "amount_paid DECIMAL(10,2) NULL");
            $addIfMissing('reservations', 'payment_date',      "payment_date DATETIME NULL");
        }
    } catch (Exception $e) {
        error_log('ensurePaymentColumns warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the Age Bracket / Guest Breakdown columns.
 *
 * Adds, only if missing, the same six per-bracket guest-count columns to
 * both tables that record visitors:
 *
 *   reservations.age_kids, age_teens, age_adults_18_25,
 *   reservations.age_adults_26_40, age_adults_41_59, age_seniors
 *     -> the breakdown the lead guest enters on the Reservation Form
 *        (Landing page/reservation-form.html) instead of each guest's exact
 *        age/birthdate. Their sum is the total number of visitors.
 *
 *   walk_in_visits.age_kids, age_teens, age_adults_18_25,
 *   walk_in_visits.age_adults_26_40, age_adults_41_59, age_seniors
 *     -> the same breakdown captured on the Walk-in Visitor Registration
 *        form (Beach owner page/walk-in-registration.html).
 *
 * Every column is INT NOT NULL DEFAULT 0, so existing rows and every
 * existing INSERT/SELECT keep working untouched. A failure to add any one
 * column is logged and skipped rather than breaking the request. This
 * mirrors ensurePaymentColumns() exactly (database/migration_age_brackets.sql
 * is the manual equivalent).
 */
function ensureAgeBracketColumns($conn) {
    // Small helper: add a column only when it isn't already present.
    $addIfMissing = function ($table, $column, $definition) use ($conn) {
        try {
            $exists = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE " . $conn->quote($column))->rowCount() > 0;
            if (!$exists) {
                $conn->exec("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
            }
        } catch (Exception $colErr) {
            error_log("ensureAgeBracketColumns: could not add {$table}.{$column}: " . $colErr->getMessage());
        }
    };

    // The same six brackets are added to whichever of the two visitor
    // tables exist. Keeping them in one list guarantees the reservations and
    // walk-in breakdowns stay identical.
    $brackets = [
        'age_kids'         => "age_kids INT NOT NULL DEFAULT 0",           // 0-12
        'age_teens'        => "age_teens INT NOT NULL DEFAULT 0",          // 13-17
        'age_adults_18_25' => "age_adults_18_25 INT NOT NULL DEFAULT 0",   // 18-25
        'age_adults_26_40' => "age_adults_26_40 INT NOT NULL DEFAULT 0",   // 26-40
        'age_adults_41_59' => "age_adults_41_59 INT NOT NULL DEFAULT 0",   // 41-59
        'age_seniors'      => "age_seniors INT NOT NULL DEFAULT 0"         // 60+
    ];

    try {
        foreach (['reservations', 'walk_in_visits'] as $table) {
            if ($conn->query("SHOW TABLES LIKE " . $conn->quote($table))->rowCount() > 0) {
                foreach ($brackets as $column => $definition) {
                    $addIfMissing($table, $column, $definition);
                }
            }
        }
    } catch (Exception $e) {
        error_log('ensureAgeBracketColumns warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the Guest Type (Local / Foreign) columns.
 *
 *   reservations.local_visitors, foreign_visitors
 *     -> the Guest Type breakdown collected on the Reservation Form
 *        (Landing page/reservation-form.html). Previously missing entirely,
 *        which is why reservations could never be classified as Local or
 *        Foreign anywhere in the system.
 *
 *   walk_in_visits.local_visitors, foreign_visitors
 *     -> already exist on every installation (see
 *        ensureReservationAndWalkInTables()); included here too so both
 *        tables are guaranteed to have the same two columns, the same way
 *        ensureAgeBracketColumns() guarantees the age brackets match.
 *
 * Every column is INT NOT NULL DEFAULT 0, so existing rows and every
 * existing INSERT/SELECT keep working untouched. A failure to add any one
 * column is logged and skipped rather than breaking the request. Mirrors
 * ensureAgeBracketColumns() exactly (database/migration_guest_type.sql is
 * the manual equivalent).
 */
function ensureGuestTypeColumns($conn) {
    $addIfMissing = function ($table, $column, $definition) use ($conn) {
        try {
            $exists = $conn->query("SHOW COLUMNS FROM `{$table}` LIKE " . $conn->quote($column))->rowCount() > 0;
            if (!$exists) {
                $conn->exec("ALTER TABLE `{$table}` ADD COLUMN {$definition}");
            }
        } catch (Exception $colErr) {
            error_log("ensureGuestTypeColumns: could not add {$table}.{$column}: " . $colErr->getMessage());
        }
    };

    $columns = [
        'local_visitors'   => "local_visitors INT NOT NULL DEFAULT 0",
        'foreign_visitors' => "foreign_visitors INT NOT NULL DEFAULT 0"
    ];

    try {
        foreach (['reservations', 'walk_in_visits'] as $table) {
            if ($conn->query("SHOW TABLES LIKE " . $conn->quote($table))->rowCount() > 0) {
                foreach ($columns as $column => $definition) {
                    $addIfMissing($table, $column, $definition);
                }
            }
        }
    } catch (Exception $e) {
        error_log('ensureGuestTypeColumns warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the beach_accommodations.price_per_unit column.
 *
 * Adds, only if missing, a price_per_unit column to beach_accommodations so
 * each accommodation type on a beach can carry its price per unit (entered
 * next to the number of units in the Add New Beach form). The column is
 * DECIMAL(10,2) NOT NULL DEFAULT 0, so existing rows and every existing
 * INSERT/SELECT keep working untouched. Mirrors ensurePaymentColumns()
 * (database/migration_accommodation_price.sql is the manual equivalent).
 */
function ensureBeachAccommodationPriceColumn($conn) {
    try {
        if ($conn->query("SHOW TABLES LIKE 'beach_accommodations'")->rowCount() > 0) {
            $exists = $conn->query("SHOW COLUMNS FROM beach_accommodations LIKE 'price_per_unit'")->rowCount() > 0;
            if (!$exists) {
                $conn->exec("ALTER TABLE beach_accommodations ADD COLUMN price_per_unit DECIMAL(10,2) NOT NULL DEFAULT 0 AFTER total_units");
            }
        }
    } catch (Exception $e) {
        error_log('ensureBeachAccommodationPriceColumn warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the beach_update_requests table.
 *
 * Stores the "Update Requests" a Beach Owner sends to Tourism Personnel
 * (e.g. update GCash number, add an accommodation/amenity, update the
 * entrance fee, or a general beach-info update). Tourism Personnel review
 * them in their Update Requests page and approve/reject each one. Created
 * automatically so the feature works without a manual SQL migration step
 * (database/migration_update_requests.sql is the manual equivalent).
 */
function ensureBeachUpdateRequestsTable($conn) {
    try {
        $exists = $conn->query("SHOW TABLES LIKE 'beach_update_requests'")->rowCount() > 0;
        if (!$exists) {
            $conn->exec("
                CREATE TABLE beach_update_requests (
                  request_id   INT AUTO_INCREMENT PRIMARY KEY,
                  beach_id     INT NULL,
                  owner_id     INT NULL,
                  owner_name   VARCHAR(150) NOT NULL DEFAULT '',
                  beach_name   VARCHAR(150) NOT NULL DEFAULT '',
                  request_type VARCHAR(100) NOT NULL DEFAULT '',
                  details      TEXT,
                  status       ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending',
                  admin_note   TEXT NULL,
                  created_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  updated_at   TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
                ) ENGINE=InnoDB
            ");
            return;
        }

        // The table already exists - it may predate this feature or have been
        // created from an older/partial definition. Add whichever columns the
        // current app code needs but the table is missing, the same way
        // ensureBeachOwnersTable() repairs beach_owners. This fixes
        // "Unknown column 'owner_name' in 'field list'" (and the equivalent
        // error for any other column) when submitting an update request.
        $existingColumns = [];
        foreach ($conn->query("SHOW COLUMNS FROM beach_update_requests")->fetchAll(PDO::FETCH_ASSOC) as $col) {
            $existingColumns[$col['Field']] = true;
        }

        $requiredColumns = [
            'beach_id'     => "ADD COLUMN beach_id INT NULL",
            'owner_id'     => "ADD COLUMN owner_id INT NULL",
            'owner_name'   => "ADD COLUMN owner_name VARCHAR(150) NOT NULL DEFAULT ''",
            'beach_name'   => "ADD COLUMN beach_name VARCHAR(150) NOT NULL DEFAULT ''",
            'request_type' => "ADD COLUMN request_type VARCHAR(100) NOT NULL DEFAULT ''",
            'details'      => "ADD COLUMN details TEXT",
            'status'       => "ADD COLUMN status ENUM('Pending','Approved','Rejected') NOT NULL DEFAULT 'Pending'",
            'admin_note'   => "ADD COLUMN admin_note TEXT NULL",
            'created_at'   => "ADD COLUMN created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP",
            'updated_at'   => "ADD COLUMN updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
        ];

        foreach ($requiredColumns as $columnName => $alterClause) {
            if (!isset($existingColumns[$columnName])) {
                try {
                    $conn->exec("ALTER TABLE beach_update_requests {$alterClause}");
                } catch (Exception $colErr) {
                    // Log and continue - one column failing to add should not
                    // block the rest from being added.
                    error_log('ensureBeachUpdateRequestsTable: could not add column ' . $columnName . ': ' . $colErr->getMessage());
                }
            }
        }
    } catch (Exception $e) {
        error_log('ensureBeachUpdateRequestsTable warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the "reviews" table (Beach Details page - real
 * tourist ratings/reviews, replacing the old hardcoded sample reviews).
 *
 * Creates the table if it's missing (older databases only ran the base
 * schema before this feature existed) and adds the reviewer_name column if
 * an older copy of the table predates it. Both are purely additive - no
 * existing column, row or workflow is touched - mirroring
 * ensureBeachOwnersTable()/ensureBeachUpdateRequestsTable() above.
 * api/get-reviews.php and api/submit-review.php are the only readers/
 * writers of this table; api/submit-review.php keeps beaches.rating and
 * beaches.total_reviews (already used by Browse Beaches, Beach Management
 * and the beach ranking) in sync every time a review is submitted.
 */
function ensureReviewsTable($conn) {
    try {
        $exists = $conn->query("SHOW TABLES LIKE 'reviews'")->rowCount() > 0;
        if (!$exists) {
            $conn->exec("
                CREATE TABLE reviews (
                  review_id     INT AUTO_INCREMENT PRIMARY KEY,
                  beach_id      INT NOT NULL,
                  tourist_id    INT NULL,
                  reviewer_name VARCHAR(150) NOT NULL DEFAULT '',
                  rating        TINYINT NOT NULL,
                  comment       TEXT,
                  created_at    TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                  FOREIGN KEY (beach_id) REFERENCES beaches(beach_id) ON DELETE CASCADE,
                  FOREIGN KEY (tourist_id) REFERENCES tourists(tourist_id) ON DELETE SET NULL
                ) ENGINE=InnoDB
            ");
            return;
        }

        // Table already existed (e.g. from the base schema, which predates
        // reviewer_name) - add the column if it's not there yet.
        $hasReviewerName = $conn->query("SHOW COLUMNS FROM reviews LIKE 'reviewer_name'")->rowCount() > 0;
        if (!$hasReviewerName) {
            $conn->exec("ALTER TABLE reviews ADD COLUMN reviewer_name VARCHAR(150) NOT NULL DEFAULT '' AFTER tourist_id");
        }
    } catch (Exception $e) {
        error_log('ensureReviewsTable warning: ' . $e->getMessage());
    }
}

/**
 * Self-healing check for the default Tourism Personnel (Admin) account.
 *
 * Guarantees that a working Tourism Personnel/Admin login always exists
 * after database setup or initialization, on both fresh databases and any
 * older/partial copy that never had it (or had it removed):
 *
 *   Email:    admin@tukuran.gov.ph
 *   Password: admin123
 *   Role:     admin  (Tourism Personnel)
 *
 * The password is stored using the app's standard hashing method
 * (password_hash() with PASSWORD_DEFAULT / bcrypt - the same call used by
 * api/add-beach-owner.php), so it verifies correctly via password_verify()
 * in api/login.php. The plain-text credentials only ever exist here on the
 * server side to seed the hash; they are never written to, or read by, the
 * login page or any other frontend file.
 *
 * Purely additive and idempotent: if the account already exists it is left
 * untouched, so a real admin who later changed the password is never reset.
 */
function ensureDefaultAdminAccount($conn) {
    try {
        // Default Tourism Personnel (Admin) account lives in the
        // `tourism_personnel` table (personnelID, fullName, username,
        // password, email, contactNumber, position, status, createdAt).
        // Create the table if a partial database is missing it, then seed
        // the default admin only if it isn't already present - so a real
        // admin who later changes the password is never reset.
        $exists = $conn->query("SHOW TABLES LIKE 'tourism_personnel'")->rowCount() > 0;
        if (!$exists) {
            $conn->exec("
                CREATE TABLE tourism_personnel (
                  personnelID   INT AUTO_INCREMENT PRIMARY KEY,
                  fullName      VARCHAR(150) NOT NULL,
                  username      VARCHAR(100) NOT NULL,
                  password      VARCHAR(255) NOT NULL,
                  email         VARCHAR(150) DEFAULT NULL,
                  contactNumber VARCHAR(20)  DEFAULT NULL,
                  position      VARCHAR(100) DEFAULT NULL,
                  status        ENUM('Active','Inactive') DEFAULT 'Active',
                  createdAt     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
                ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4
            ");
        }

        $defaultEmail    = 'admin@tukuran.gov.ph';
        $defaultUsername = 'admin';

        // Present already? (match on either the email or the username)
        $check = $conn->prepare(
            "SELECT personnelID FROM tourism_personnel WHERE email = :email OR username = :username LIMIT 1"
        );
        $check->execute([':email' => $defaultEmail, ':username' => $defaultUsername]);
        if ($check->fetch(PDO::FETCH_ASSOC)) {
            return; // Already exists - nothing to do.
        }

        // Hash with the app's standard method (bcrypt) - the plain
        // credentials are never stored in, or exposed to, any frontend file.
        $passwordHash = password_hash('admin123', PASSWORD_DEFAULT);

        $insert = $conn->prepare("
            INSERT INTO tourism_personnel (fullName, username, password, email, position, status)
            VALUES (:fullName, :username, :password, :email, 'Tourism Personnel', 'Active')
        ");
        $insert->execute([
            ':fullName' => 'Tourism Office Admin',
            ':username' => $defaultUsername,
            ':password' => $passwordHash,
            ':email'    => $defaultEmail
        ]);
    } catch (Exception $e) {
        // Never let seeding take down the request; login.php's own error
        // handling will still surface any genuine query error.
        error_log('ensureDefaultAdminAccount warning: ' . $e->getMessage());
    }
}

// ========================================
// ===== LIVE BEACH OCCUPANCY (single source of truth) =====
// ========================================
// Used by the Tourism Personnel Dashboard, Automated Reports, and the
// Beach Owner Dashboard, so all three always agree on "Beach Occupancy".
//
// Unlike beaches.current_capacity (a running counter that only ever goes
// up when a reservation is confirmed or a walk-in is registered, and
// never comes back down as the day ends), this is computed fresh, for
// TODAY only, directly from Approved (Confirmed) Reservations + Walk-in
// Visitors against the beach's registered Max Capacity. Because it is
// calculated live from those two tables on every call, it automatically
// updates the moment a visitor record changes and can never drift out of
// sync or show a stale/hardcoded number.
//
// Pass $beachId to get a single beach's figures, or omit it to get every
// Active beach (used for municipality-wide averages/peaks/at-capacity
// counts). Pass $date to check a past day; defaults to today.
function getBeachOccupancyToday($db, $beachId = null, $date = null) {
    $date = $date ?: date('Y-m-d');

    $clause = "WHERE status = 'Active'";
    $params = [];
    if ($beachId) {
        $clause .= " AND beach_id = ?";
        $params[] = $beachId;
    }

    $stmt = $db->prepare("SELECT beach_id, beach_name, max_capacity FROM beaches $clause");
    $stmt->execute($params);
    $beaches = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $result = [];
    foreach ($beaches as $b) {
        $w = $db->prepare("
            SELECT COALESCE(SUM(total_visitors), 0) AS t
            FROM walk_in_visits WHERE beach_id = ? AND visit_date = ?
        ");
        $w->execute([$b['beach_id'], $date]);
        $walkins = (int) $w->fetch(PDO::FETCH_ASSOC)['t'];

        $r = $db->prepare("
            SELECT COALESCE(SUM(num_visitors), 0) AS t
            FROM reservations WHERE beach_id = ? AND status = 'Confirmed' AND reservation_date = ?
        ");
        $r->execute([$b['beach_id'], $date]);
        $reservations = (int) $r->fetch(PDO::FETCH_ASSOC)['t'];

        $occupied   = $walkins + $reservations;
        $max        = (int) $b['max_capacity'];
        $percentage = $max > 0 ? min(100, (int) round(($occupied / $max) * 100)) : 0;

        $result[(int) $b['beach_id']] = [
            'beach_id'     => (int) $b['beach_id'],
            'beach_name'   => $b['beach_name'],
            'max_capacity' => $max,
            'occupied'     => $occupied,
            'percentage'   => $percentage
        ];
    }

    if ($beachId) {
        return $result ? reset($result) : null;
    }
    return $result;
}

// ========================================
// ===== LIVE ACCOMMODATION AVAILABILITY (single source of truth) =====
// ========================================
// Used by get-beaches.php (feeds the Tourist Reservation Form, the Beach
// Operator's Walk-in Guests form, and Tourism Personnel's Beach
// Management "View Details" panel) and owner-dashboard-stats.php (the
// Beach Operator Dashboard's Accommodation Availability cards) - so all
// of them always agree on how many units of each accommodation type are
// actually free right now.
//
// beach_accommodations.available_units (set when Tourism Personnel add
// or edit a beach in Beach Management) still records the *configured*
// capacity and is left untouched here. The number actually shown to
// tourists and Beach Operators is computed fresh on every call instead,
// directly from real records - never a stored counter someone forgot to
// update. Defaults to TODAY (same convention as getBeachOccupancyToday
// above) when no $date is passed, which is correct for the Walk-in
// Guests form (always today's occupancy) and the live dashboard cards.
// The Reservation Form books a specific date, so get-beaches.php passes
// that date through here (via its optional ?date= parameter) instead of
// letting it default to today - otherwise a unit taken today would
// wrongly block an unrelated future date, and a unit free today could
// wrongly show as available on a date that's actually already full:
//   - "Reserved" = Confirmed reservations for the target date ($date,
//     defaulting to today) whose stored accommodation_type text names
//     this type. The Reservation Form writes a short descriptor such as
//     "Cottage – Units 1, 3 ×2 – ₱2,000"; the quantity after "×" is read
//     back out here.
//   - "Occupied" = that same target date's walk-in registrations whose
//     accommodation_type names this type. The Walk-in Guests form writes
//     the same kind of descriptor as the Reservation Form (type name,
//     optionally followed by " – Units ..." and "×N"), parsed with the
//     same rule below, so a
//     multi-unit walk-in correctly occupies more than one unit.
// Available = Total - Reserved - Occupied (clamped between 0 and Total).
// taken_units additionally lists the EXACT unit numbers (not just a count)
// that are unavailable, read from that same "Units 1, 3, 5" text - see
// extractTakenUnitNumbersByDescriptor() below - so if a tourist picks Unit
// 2 specifically, Unit 2 (not just "some unit") is what shows unavailable
// everywhere and can't be picked again by anyone else.

// Counts how many units of each known accommodation type are implied by a
// list of stored accommodation_type descriptors (from either reservations
// or walk-in visits). A descriptor is just the type name for a plain
// selection, or "TypeName – Units 1, 3 ×2 – ₱2,000" when specific units
// were picked (the Reservation/Walk-in forms write an en dash "–" and a
// multiplication sign "×"; plain "-"/"x" are also accepted for safety).
// The quantity after that × (defaulting to 1 when absent) is the number of
// units that descriptor accounts for. Shared by both reservations and
// walk-ins so the two modules always agree on what is taken.
function countAccommodationUnitsByDescriptor($descriptors, $typeNames) {
    $counts = array_fill_keys($typeNames, 0);
    foreach ($descriptors as $descriptor) {
        foreach ($typeNames as $typeName) {
            $len = mb_strlen($typeName);
            if (strncasecmp($descriptor, $typeName, $len) === 0) {
                $rest = mb_substr($descriptor, mb_strlen($typeName));
                // Must be followed by end-of-string or the " –"/" -"/" ×"/
                // " x" separators the Reservation/Walk-in forms write - not
                // by more letters, so "Room" can't match a stored "Rooftop".
                if ($rest === '' || preg_match('/^\s*(-|\x{2013}|x|\x{00D7})/iu', $rest)) {
                    if (preg_match('/(?:x|\x{00D7})\s*(\d+)/iu', $descriptor, $m)) {
                        $counts[$typeName] += max(1, (int) $m[1]);
                    } else {
                        $counts[$typeName] += 1;
                    }
                    break;
                }
            }
        }
    }
    return $counts;
}

// Extracts the SPECIFIC unit numbers (e.g. [1, 3, 5], not just how many)
// that stored accommodation_type descriptors reserved/occupied for each
// known type, by reading the "Units 1, 3, 5" (or "Unit 2") portion the
// Reservation and Walk-in forms both write when a tourist/operator taps
// actual numbered units in the picker grid. This is what lets the grid
// grey out the true taken numbers - e.g. Unit 2 specifically, if that's
// what was picked - instead of always greying out the highest-numbered
// units by position regardless of which one was actually selected.
// Descriptors with no "Units ..." portion (the plain fallback dropdown,
// used only when a beach has no priced accommodations configured) still
// count toward the overall reserved/occupied total via
// countAccommodationUnitsByDescriptor() above, but can't be pinned to a
// specific number - getBeachAccommodationAvailability() below fills those
// in afterwards so the taken-count the grid shows always still matches.
function extractTakenUnitNumbersByDescriptor($descriptors, $typeNames) {
    $taken = array_fill_keys($typeNames, []);
    foreach ($descriptors as $descriptor) {
        foreach ($typeNames as $typeName) {
            $len = mb_strlen($typeName);
            if (strncasecmp($descriptor, $typeName, $len) === 0) {
                $rest = mb_substr($descriptor, mb_strlen($typeName));
                if ($rest === '' || preg_match('/^\s*(-|\x{2013}|x|\x{00D7})/iu', $rest)) {
                    if (preg_match('/Units?\s+([\d,\s]+?)\s*(?:x|\x{00D7})/iu', $rest, $unitMatch)) {
                        foreach (explode(',', $unitMatch[1]) as $num) {
                            $num = (int) trim($num);
                            if ($num > 0) $taken[$typeName][] = $num;
                        }
                    }
                    break;
                }
            }
        }
    }
    foreach ($taken as &$nums) {
        $nums = array_values(array_unique($nums));
        sort($nums);
    }
    unset($nums);
    return $taken;
}

function getBeachAccommodationAvailability($db, $beachId, $date = null) {
    $date = $date ?: date('Y-m-d');

    $stmt = $db->prepare("
        SELECT ba.type_id, at.type_name, ba.total_units, ba.price_per_unit
        FROM beach_accommodations ba
        JOIN accommodation_types at ON ba.type_id = at.type_id
        WHERE ba.beach_id = ?
        ORDER BY at.type_name
    ");
    $stmt->execute([$beachId]);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    if (!$rows) {
        return [];
    }

    // Confirmed reservations for this beach on the target date.
    $resStmt = $db->prepare("
        SELECT accommodation_type
        FROM reservations
        WHERE beach_id = ? AND status = 'Confirmed' AND reservation_date = ?
              AND accommodation_type IS NOT NULL AND accommodation_type <> '' AND accommodation_type <> 'none'
    ");
    $resStmt->execute([$beachId, $date]);
    $reservationDescriptors = $resStmt->fetchAll(PDO::FETCH_COLUMN);

    // Walk-in registrations for this beach on the target date (walk-ins
    // are always same-day, so this is today's unless $date was overridden).
    $walkStmt = $db->prepare("
        SELECT accommodation_type
        FROM walk_in_visits
        WHERE beach_id = ? AND visit_date = ?
              AND accommodation_type IS NOT NULL AND accommodation_type <> ''
    ");
    $walkStmt->execute([$beachId, $date]);
    $walkinTypes = $walkStmt->fetchAll(PDO::FETCH_COLUMN);

    // Match the longest type names first so e.g. a configured "Deluxe
    // Room" isn't shadowed by a shorter "Room" also on the same beach.
    $typeNames = array_column($rows, 'type_name');
    usort($typeNames, function ($a, $b) { return mb_strlen($b) - mb_strlen($a); });

    $reserved = countAccommodationUnitsByDescriptor($reservationDescriptors, $typeNames);
    $occupied = countAccommodationUnitsByDescriptor($walkinTypes, $typeNames);
    $reservedUnitNumbers = extractTakenUnitNumbersByDescriptor($reservationDescriptors, $typeNames);
    $occupiedUnitNumbers = extractTakenUnitNumbersByDescriptor($walkinTypes, $typeNames);

    foreach ($rows as &$row) {
        $typeName = $row['type_name'];
        $total = (int) $row['total_units'];
        $res = $reserved[$typeName] ?? 0;
        $occ = $occupied[$typeName] ?? 0;

        // The exact unit numbers actually picked (e.g. [2]) come first;
        // any remaining reserved/occupied count that couldn't be matched
        // to a specific number (older records, or the plain fallback
        // dropdown) is filled in with the lowest-numbered units not
        // already known-taken, purely so the COUNT of gray chips still
        // equals $res + $occ - it never overrides a real, known number.
        $takenUnits = array_values(array_unique(array_merge(
            $reservedUnitNumbers[$typeName] ?? [],
            $occupiedUnitNumbers[$typeName] ?? []
        )));
        $anonymousCount = max(0, ($res + $occ) - count($takenUnits));
        for ($n = 1; $n <= $total && $anonymousCount > 0; $n++) {
            if (!in_array($n, $takenUnits, true)) {
                $takenUnits[] = $n;
                $anonymousCount--;
            }
        }
        sort($takenUnits);

        $row['total_units'] = $total;
        $row['reserved_units'] = $res;
        $row['occupied_units'] = $occ;
        $row['available_units'] = max(0, $total - $res - $occ);
        // Exact unit numbers currently unavailable for this beach/type/date
        // - the Reservation Form, Walk-in Guests form and Beach Operator
        // pages all grey out precisely these numbers, so a unit picked by
        // one tourist can never be picked again by another.
        $row['taken_units'] = $takenUnits;
    }
    unset($row);

    return $rows;
}
?>