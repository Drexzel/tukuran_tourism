<?php
// ========================================
// ===== AUTOMATED REPORTS API =====
// ========================================
// Powers Tourism Personnel/automated-reports.html. Every figure returned
// here is calculated live from the database (reservations + walk_in_visits
// + beaches), the same two source tables every other module in this system
// already reads from (see dashboard-stats.php / dashboard-charts.php) -
// nothing here is static or sample data, and the
// numbers change immediately as new reservations, walk-ins, or beaches are
// added or updated.
//
// Usage: reports.php?period=daily|weekly|monthly|quarterly|annual
//        [&date=YYYY-MM-DD] [&beach_id=#]
//
// - period   Which official report period to build. Defaults to 'daily'.
// - date     Reference date the period is calculated around. Defaults to
//            today (server date), so the report always reflects "right now"
//            unless the user is looking at a past period.
// - beach_id Optional - scopes every figure to a single beach instead of
//            the whole municipality.

// ---- Guarantee JSON-only output -------------------------------------------
// Without this, a stray PHP warning/notice or an uncaught Error would print
// HTML into the response body and the browser would fail with:
//   "Unexpected token '<', "<..." is not valid JSON"
// So we hide inline error HTML and buffer ALL output; only clean JSON is sent.
ini_set('display_errors', '0');
error_reporting(E_ALL);
ob_start();

header('Content-Type: application/json');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET');
header('Access-Control-Allow-Headers: Content-Type');
// Same as dashboard-stats.php: never let a cached copy of a report go
// stale - Tourism Personnel need the true, current numbers every time.
header('Cache-Control: no-store, no-cache, must-revalidate');

try {
    require_once '../includes/db_connection.php';
    $db = getDB();

    if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
        throw new Exception('Method not allowed');
    }

    $period  = isset($_GET['period']) ? trim($_GET['period']) : 'daily';
    $refDate = isset($_GET['date']) && $_GET['date'] !== '' ? $_GET['date'] : date('Y-m-d');
    $beachId = isset($_GET['beach_id']) && $_GET['beach_id'] !== '' ? intval($_GET['beach_id']) : null;

    $range = resolvePeriodRange($period, $refDate);

    $data = [
        'period'             => $range['period_label'],
        'date'               => $range['date_label'],
        'periodKey'          => $range['period_key'],
        'rangeStart'         => $range['start'],
        'rangeEnd'           => $range['end'],
        'totalVisitors'      => getTotalVisitors($db, $range['start'], $range['end'], $beachId),
        'totalReservations'  => getTotalReservations($db, $range['start'], $range['end'], $beachId),
    ];

    $localForeign = getLocalForeign($db, $range['start'], $range['end'], $beachId);
    $data['localVisitors']   = $localForeign['local'];
    $data['foreignVisitors'] = $localForeign['foreign'];

    $data['gender']          = getGenderDistribution($db, $range['start'], $range['end'], $beachId);
    $data['ageDistribution'] = getAgeDistribution($db, $range['start'], $range['end'], $beachId);

    $beachStats           = getBeachStats($db, $range['start'], $range['end'], $beachId);
    $data['mostVisited']  = $beachStats['most_visited'];
    $data['beachData']    = $beachStats['beach_data'];

    $data['occupancy']           = getOccupancy($db, $beachId);
    $data['capacityMonitoring']  = getCapacityMonitoring($db, $beachId);
    $data['reservationStats']    = getReservationStatistics($db, $range['start'], $range['end'], $beachId);
    $data['dailyVisitorCounts']  = getDailyVisitorCounts($db, $range['end'], 7, $beachId);
    $data['monthlyVisitorTotals']= getMonthlyVisitorTotals($db, 12, $beachId);

    // Official LGU "Tourism Attraction Visitors Record" table (per-day, by
    // place of residence). Built for the calendar month of the report's end
    // date so the printed form always matches the month-long LGU layout.
    $data['lguRecord']           = getLguVisitorRecord($db, $range['end'], $beachId);
    $data['beachName']           = getReportBeachName($db, $beachId);

    $data['generatedAt']         = date('c');

    // Drop anything that may have leaked into the buffer (warnings, notices,
    // stray whitespace) so the response is pure JSON.
    if (ob_get_level() > 0) { ob_end_clean(); }
    echo json_encode(['success' => true, 'data' => $data]);
} catch (Throwable $e) {
    // Catch Throwable (not just Exception) so PHP Errors/TypeErrors also come
    // back as readable JSON instead of an HTML error page.
    if (ob_get_level() > 0) { ob_end_clean(); }
    error_log('Error in reports.php: ' . $e->getMessage());
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
        'where'   => basename($e->getFile()) . ':' . $e->getLine()
    ]);
}

// ========================================
// ===== PERIOD RANGE RESOLUTION =====
// ========================================

/**
 * Turns a period keyword + reference date into a concrete [start, end]
 * date range (inclusive) plus the human-readable labels the official
 * report format uses (e.g. "Monthly Report" / "June 2026").
 */
function resolvePeriodRange($period, $refDateStr) {
    $ref = strtotime($refDateStr);
    if ($ref === false) {
        $ref = time();
    }

    switch ($period) {
        case 'weekly':
            $end = date('Y-m-d', $ref);
            $start = date('Y-m-d', strtotime('-6 days', $ref));
            $label = (date('Y', strtotime($start)) === date('Y', strtotime($end)))
                ? date('F j', strtotime($start)) . ' - ' . date('F j, Y', strtotime($end))
                : date('F j, Y', strtotime($start)) . ' - ' . date('F j, Y', strtotime($end));
            return ['start' => $start, 'end' => $end, 'period_label' => 'Weekly Report', 'date_label' => $label, 'period_key' => 'weekly'];

        case 'monthly':
            $start = date('Y-m-01', $ref);
            $end = date('Y-m-t', $ref);
            return ['start' => $start, 'end' => $end, 'period_label' => 'Monthly Report', 'date_label' => date('F Y', $ref), 'period_key' => 'monthly'];

        case 'quarterly':
            $month = (int) date('n', $ref);
            $year = (int) date('Y', $ref);
            $quarter = (int) ceil($month / 3);
            $startMonth = ($quarter - 1) * 3 + 1;
            $endMonth = $startMonth + 2;
            $start = date('Y-m-01', mktime(0, 0, 0, $startMonth, 1, $year));
            $end = date('Y-m-t', mktime(0, 0, 0, $endMonth, 1, $year));
            $label = date('F', strtotime($start)) . ' - ' . date('F Y', strtotime($end));
            return ['start' => $start, 'end' => $end, 'period_label' => 'Quarterly Report (Q' . $quarter . ')', 'date_label' => $label, 'period_key' => 'quarterly'];

        case 'annual':
            $year = date('Y', $ref);
            $start = "$year-01-01";
            $end = "$year-12-31";
            return ['start' => $start, 'end' => $end, 'period_label' => 'Annual Report', 'date_label' => 'Year ' . $year, 'period_key' => 'annual'];

        case 'daily':
        default:
            $day = date('Y-m-d', $ref);
            return ['start' => $day, 'end' => $day, 'period_label' => 'Daily Report', 'date_label' => date('F j, Y', $ref), 'period_key' => 'daily'];
    }
}

// ========================================
// ===== HELPERS SHARED BY MULTIPLE METRICS =====
// ========================================

function beachFilterClause($beachId, $column = 'beach_id') {
    return $beachId ? " AND $column = ?" : "";
}

// ========================================
// ===== TOTAL VISITORS =====
// ========================================
// Same combined-source rule used everywhere else in this system: walk-ins
// (every registration is a realized visit) + reservations that were
// approved by the Beach Owner - status 'Confirmed' (displayed as
// "Approved") or 'Completed' (the Beach Owner later confirmed the visit
// actually happened). Both represent a real, realized visit; only the
// capacity/occupancy-today figures (getBeachOccupancyToday()) exclude
// 'Completed', since that reservation's slot has already been freed.

function getTotalVisitors($db, $start, $end, $beachId) {
    $params = [$start, $end];
    if ($beachId) $params[] = $beachId;

    $walkins = $db->prepare("
        SELECT COALESCE(SUM(total_visitors), 0) AS total
        FROM walk_in_visits
        WHERE visit_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $walkins->execute($params);
    $walkinTotal = (int) $walkins->fetch(PDO::FETCH_ASSOC)['total'];

    $reservations = $db->prepare("
        SELECT COALESCE(SUM(num_visitors), 0) AS total
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $reservations->execute($params);
    $reservationTotal = (int) $reservations->fetch(PDO::FETCH_ASSOC)['total'];

    return $walkinTotal + $reservationTotal;
}

// ========================================
// ===== TOTAL RESERVATIONS =====
// ========================================
// Count of Confirmed (approved) reservations whose reservation_date falls
// inside the report period - scoped to the period, unlike the dashboard's
// all-time "Total Reservations" card, since a report is meant to describe
// that specific period.

function getTotalReservations($db, $start, $end, $beachId) {
    $params = [$start, $end];
    if ($beachId) $params[] = $beachId;

    $stmt = $db->prepare("
        SELECT COUNT(*) AS c
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $stmt->execute($params);
    return (int) $stmt->fetch(PDO::FETCH_ASSOC)['c'];
}

// ========================================
// ===== LOCAL / FOREIGN VISITORS =====
// ========================================
// Both walk_in_visits and reservations now carry a local_visitors /
// foreign_visitors split (walk-ins: filled in on the Walk-in Registration
// form; reservations: filled in by the "Guest Type" field on the
// Reservation Form - see database/migration_guest_type.sql /
// ensureGuestTypeColumns()). Only Confirmed/Completed reservations are
// counted, matching every other "realized visit" figure in this file
// (getTotalVisitors, getTotalReservations, etc.) so nobody is counted here
// who isn't already counted in Total Visitors.

function getLocalForeign($db, $start, $end, $beachId) {
    $params = [$start, $end];
    if ($beachId) $params[] = $beachId;

    $walkins = $db->prepare("
        SELECT COALESCE(SUM(local_visitors), 0) AS local, COALESCE(SUM(foreign_visitors), 0) AS foreign_v
        FROM walk_in_visits
        WHERE visit_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $walkins->execute($params);
    $w = $walkins->fetch(PDO::FETCH_ASSOC);

    $reservations = $db->prepare("
        SELECT COALESCE(SUM(local_visitors), 0) AS local, COALESCE(SUM(foreign_visitors), 0) AS foreign_v
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $reservations->execute($params);
    $r = $reservations->fetch(PDO::FETCH_ASSOC);

    return [
        'local'   => (int) $w['local']   + (int) $r['local'],
        'foreign' => (int) $w['foreign_v'] + (int) $r['foreign_v']
    ];
}

// ========================================
// ===== GENDER DISTRIBUTION =====
// ========================================

function getGenderDistribution($db, $start, $end, $beachId) {
    $params = [$start, $end];
    if ($beachId) $params[] = $beachId;

    $walkin = $db->prepare("
        SELECT COALESCE(SUM(male_count), 0) AS male, COALESCE(SUM(female_count), 0) AS female
        FROM walk_in_visits
        WHERE visit_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $walkin->execute($params);
    $w = $walkin->fetch(PDO::FETCH_ASSOC);

    $reservation = $db->prepare("
        SELECT COALESCE(SUM(male_count), 0) AS male, COALESCE(SUM(female_count), 0) AS female
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $reservation->execute($params);
    $r = $reservation->fetch(PDO::FETCH_ASSOC);

    return [
        'male'   => (int) $w['male'] + (int) $r['male'],
        'female' => (int) $w['female'] + (int) $r['female']
    ];
}

// ========================================
// ===== AGE DISTRIBUTION =====
// ========================================
// Both the Walk-in Registration form and the Reservation form ultimately
// feed the same four age groups shown to staff/guests on those forms -
// Kids (0-12), Teen (13-17), Adult (18-59), Senior (60+) - even though the
// database keeps three finer-grained adult sub-columns internally
// (age_adults_18_25 / age_adults_26_40 / age_adults_41_59, see
// database/migration_age_brackets.sql). Those three sub-columns are summed
// back into ONE "Adult (18-59)" bucket here so the Automated Reports match
// the brackets guests and staff actually see on the forms. Each source
// table (walk-ins, confirmed/completed reservations) is summed exactly
// once, so combining them never double-counts a visitor.
// Percentages are calculated relative to the total bucketed visitors.

function getAgeDistribution($db, $start, $end, $beachId) {
    // Raw database columns feeding each of the four report-facing buckets.
    // The Adult bucket sums all three finer-grained adult sub-columns.
    $bucketCols = [
        'Kids (0-12)'  => ['age_kids'],
        'Teen (13-17)' => ['age_teens'],
        'Adult (18-59)'=> ['age_adults_18_25', 'age_adults_26_40', 'age_adults_41_59'],
        'Senior (60+)' => ['age_seniors']
    ];
    $allCols = array_merge(...array_values($bucketCols));
    $bracketCols = implode(', ', array_map(function ($col) {
        return "COALESCE(SUM($col), 0) AS $col";
    }, $allCols));

    $params = [$start, $end];
    if ($beachId) $params[] = $beachId;

    $walkin = $db->prepare("
        SELECT $bracketCols
        FROM walk_in_visits
        WHERE visit_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $walkin->execute($params);
    $w = $walkin->fetch(PDO::FETCH_ASSOC);

    $reservation = $db->prepare("
        SELECT $bracketCols
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $reservation->execute($params);
    $r = $reservation->fetch(PDO::FETCH_ASSOC);

    $counts = [];
    $total = 0;
    foreach ($bucketCols as $label => $cols) {
        $count = 0;
        foreach ($cols as $col) {
            $count += (int) $w[$col] + (int) $r[$col];
        }
        $counts[$label] = $count;
        $total += $count;
    }

    $result = [];
    foreach ($counts as $label => $count) {
        $percentage = $total > 0 ? round(($count / $total) * 100) : 0;
        $result[] = ['range' => $label, 'count' => $count, 'percentage' => $percentage];
    }
    return $result;
}

// ========================================
// ===== BEACH-LEVEL STATS (Most Visited + Beach Breakdown) =====
// ========================================
// Visitor totals per beach are period-scoped (same combined walk-in +
// confirmed-reservation rule as getTotalVisitors). Occupancy per beach
// comes from getBeachOccupancyToday() (includes/db_connection.php) - the
// same live, database-driven calculation (Confirmed reservations +
// walk-ins for TODAY, against Max Capacity) used everywhere else in the
// system, so it always reflects "right now" and always agrees with the
// Dashboard and the Beach Owner Dashboard.

function getBeachStats($db, $start, $end, $beachId, $limit = 5) {
    $params = [$start, $end, $start, $end];
    $beachClause = "";
    if ($beachId) {
        $beachClause = " AND b.beach_id = ?";
        $params[] = $beachId;
    }

    $sql = "
        SELECT
            b.beach_id,
            b.beach_name,
            (
                COALESCE((SELECT SUM(w.total_visitors) FROM walk_in_visits w
                          WHERE w.beach_id = b.beach_id AND w.visit_date BETWEEN ? AND ?), 0)
                +
                COALESCE((SELECT SUM(r.num_visitors) FROM reservations r
                          WHERE r.beach_id = b.beach_id AND r.status IN ('Confirmed', 'Completed')
                            AND r.reservation_date BETWEEN ? AND ?), 0)
            ) AS period_visitors
        FROM beaches b
        WHERE b.status = 'Active'" . $beachClause . "
        ORDER BY period_visitors DESC, b.beach_name ASC
        LIMIT $limit
    ";

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $occupancyByBeach = getBeachOccupancyToday($db, $beachId);

    $mostVisited = [];
    $beachData = [];
    foreach ($rows as $row) {
        $bId = (int) $row['beach_id'];
        $occupancy = $beachId
            ? ($occupancyByBeach['percentage'] ?? 0)
            : ($occupancyByBeach[$bId]['percentage'] ?? 0);

        if ((int) $row['period_visitors'] > 0) {
            $mostVisited[] = $row['beach_name'];
        }

        $beachData[] = [
            'name'      => $row['beach_name'],
            'visitors'  => (int) $row['period_visitors'],
            'occupancy' => $occupancy
        ];
    }

    // If nothing recorded any visitors this period, still surface the
    // top 3 active beaches by name so the report isn't left blank.
    if (empty($mostVisited)) {
        $mostVisited = array_slice(array_map(fn($r) => $r['beach_name'], $beachData), 0, 3);
    } else {
        $mostVisited = array_slice($mostVisited, 0, 3);
    }

    return ['most_visited' => $mostVisited, 'beach_data' => $beachData];
}

// ========================================
// ===== BEACH OCCUPANCY (average / peak) =====
// ========================================
// Live figure across every active beach, from getBeachOccupancyToday() -
// matches the percentages shown on the Dashboard and the Beach Owner
// Dashboard exactly, since all three read the same calculation.

function getOccupancy($db, $beachId) {
    $occupancyByBeach = getBeachOccupancyToday($db, $beachId);
    $rows = $beachId ? ($occupancyByBeach ? [$occupancyByBeach] : []) : array_values($occupancyByBeach);
    $rows = array_values(array_filter($rows, fn($r) => $r['max_capacity'] > 0));

    if (empty($rows)) {
        return ['average' => 0, 'peak' => 0];
    }

    $percentages = array_map(fn($r) => $r['percentage'], $rows);

    return [
        'average' => (int) round(array_sum($percentages) / count($percentages)),
        'peak'    => (int) max($percentages)
    ];
}

// ========================================
// ===== CAPACITY MONITORING =====
// ========================================
// Per-beach live capacity snapshot plus a municipality-wide summary, using
// the same >=90% / >=60% thresholds already used for the Dashboard's
// occupancy bar colors, so the "status" labels here mean the same thing
// they do everywhere else in the system. Backed by getBeachOccupancyToday()
// so it's always Confirmed Reservations + Walk-ins for TODAY vs Max
// Capacity - never a stale or manually-set number.

function getCapacityMonitoring($db, $beachId) {
    $occupancyByBeach = getBeachOccupancyToday($db, $beachId);
    $rows = $beachId ? ($occupancyByBeach ? [$occupancyByBeach] : []) : array_values($occupancyByBeach);
    usort($rows, fn($a, $b) => strcmp($a['beach_name'], $b['beach_name']));

    $beaches = [];
    $atCapacity = 0;
    $nearCapacity = 0;
    foreach ($rows as $row) {
        $max = $row['max_capacity'];
        $current = $row['occupied'];
        $percentage = $row['percentage'];

        if ($max > 0 && $current >= $max) {
            $status = 'At Capacity';
            $atCapacity++;
        } elseif ($percentage >= 60) {
            $status = 'Near Capacity';
            $nearCapacity++;
        } else {
            $status = 'Available';
        }

        $beaches[] = [
            'name'       => $row['beach_name'],
            'current'    => $current,
            'max'        => $max,
            'percentage' => $percentage,
            'status'     => $status
        ];
    }

    return [
        'beaches'         => $beaches,
        'total_beaches'   => count($beaches),
        'at_capacity'     => $atCapacity,
        'near_capacity'   => $nearCapacity,
        'available'       => count($beaches) - $atCapacity - $nearCapacity
    ];
}

// ========================================
// ===== RESERVATION STATISTICS =====
// ========================================
// Breakdown by status for reservations whose reservation_date falls
// inside the report period (Pending / Confirmed / Completed / Cancelled /
// Expired) - the same statuses used throughout Reservation Management
// ('Confirmed' is displayed there as "Approved").

function getReservationStatistics($db, $start, $end, $beachId) {
    $params = [$start, $end];
    if ($beachId) $params[] = $beachId;

    $stmt = $db->prepare("
        SELECT status, COUNT(*) AS c
        FROM reservations
        WHERE reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
        GROUP BY status
    ");
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $stats = ['Pending' => 0, 'Confirmed' => 0, 'Completed' => 0, 'Cancelled' => 0, 'Expired' => 0];
    foreach ($rows as $row) {
        if (isset($stats[$row['status']])) {
            $stats[$row['status']] = (int) $row['c'];
        }
    }
    $stats['total'] = array_sum([$stats['Pending'], $stats['Confirmed'], $stats['Completed'], $stats['Cancelled'], $stats['Expired']]);

    return [
        'pending'   => $stats['Pending'],
        'confirmed' => $stats['Confirmed'],
        'completed' => $stats['Completed'],
        'cancelled' => $stats['Cancelled'],
        'expired'   => $stats['Expired'],
        'total'     => $stats['total']
    ];
}

// ========================================
// ===== DAILY VISITOR COUNTS =====
// ========================================
// Rolling day-by-day visitor trend for the $days days ending on the
// report's own end date (so a Daily report shows just that day, while a
// Weekly/Monthly/etc. report shows the trend leading up to its end date).

function getDailyVisitorCounts($db, $endDate, $days, $beachId) {
    $startDate = date('Y-m-d', strtotime("-" . ($days - 1) . " days", strtotime($endDate)));

    $params = [$startDate, $endDate];
    if ($beachId) $params[] = $beachId;
    $walkinRows = $db->prepare("
        SELECT visit_date AS d, SUM(total_visitors) AS cnt
        FROM walk_in_visits
        WHERE visit_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
        GROUP BY visit_date
    ");
    $walkinRows->execute($params);
    $walkinByDate = [];
    foreach ($walkinRows->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $walkinByDate[$r['d']] = (int) $r['cnt'];
    }

    $params2 = [$startDate, $endDate];
    if ($beachId) $params2[] = $beachId;
    $resRows = $db->prepare("
        SELECT reservation_date AS d, SUM(num_visitors) AS cnt
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
        GROUP BY reservation_date
    ");
    $resRows->execute($params2);
    $resByDate = [];
    foreach ($resRows->fetchAll(PDO::FETCH_ASSOC) as $r) {
        $resByDate[$r['d']] = (int) $r['cnt'];
    }

    $out = [];
    for ($i = 0; $i < $days; $i++) {
        $d = date('Y-m-d', strtotime("+$i days", strtotime($startDate)));
        $count = ($walkinByDate[$d] ?? 0) + ($resByDate[$d] ?? 0);
        $out[] = ['date' => $d, 'label' => date('M j', strtotime($d)), 'count' => $count];
    }
    return $out;
}

// ========================================
// ===== MONTHLY VISITOR TOTALS =====
// ========================================
// Same combined-source rolling trend as dashboard-charts.php's
// getTrendData('monthly'), for the $months calendar months ending this
// month - included on every report regardless of the selected period so
// Tourism Personnel can always see the bigger monthly picture alongside
// whichever period they're reporting on.

function getMonthlyVisitorTotals($db, $months, $beachId) {
    $params = [];
    $beachClause1 = "";
    $beachClause2 = "";
    if ($beachId) {
        $beachClause1 = " AND beach_id = ?";
        $beachClause2 = " AND beach_id = ?";
    }

    $cutoff = date('Y-m', strtotime('-' . ($months - 1) . ' months'));

    $sql = "
        SELECT period, SUM(cnt) AS total FROM (
            SELECT DATE_FORMAT(visit_date, '%Y-%m') AS period, SUM(total_visitors) AS cnt
            FROM walk_in_visits
            WHERE 1=1 $beachClause1
            GROUP BY period
            UNION ALL
            SELECT DATE_FORMAT(reservation_date, '%Y-%m') AS period, SUM(num_visitors) AS cnt
            FROM reservations
            WHERE status IN ('Confirmed', 'Completed') $beachClause2
            GROUP BY period
        ) combined
        WHERE period >= ?
        GROUP BY period
        ORDER BY period ASC
    ";

    if ($beachId) {
        $params = [$beachId, $beachId, $cutoff];
    } else {
        $params = [$cutoff];
    }

    $stmt = $db->prepare($sql);
    $stmt->execute($params);
    $rows = $stmt->fetchAll(PDO::FETCH_ASSOC);

    $byMonth = [];
    foreach ($rows as $r) {
        $byMonth[$r['period']] = (int) $r['total'];
    }

    $out = [];
    for ($i = $months - 1; $i >= 0; $i--) {
        $period = date('Y-m', strtotime("-$i months"));
        $out[] = [
            'period' => $period,
            'label'  => date('M Y', strtotime($period . '-01')),
            'count'  => $byMonth[$period] ?? 0
        ];
    }
    return $out;
}

// ========================================
// ===== OFFICIAL LGU VISITORS RECORD =====
// ========================================
// Builds the per-day table used by the Municipality of Tukuran's official
// "Tourism Attraction Visitors Record" form. For each day of the calendar
// month that contains the report's end date it splits visitors by PLACE OF
// RESIDENCE into the three groups the LGU form uses:
//
//   - This City/Municipality       (Philippines, hometown = Tukuran)
//   - Other City/Municipality      (Philippines, any other hometown)
//   - Foreign Country Residence    (foreign visitors)
//
// each further split into Male / Female / Total, plus a Grand Total per day
// and a "TOTAL OF THIS MONTH" summary row.
//
// Data notes (why the classification works the way it does):
//   * Both walk_in_visits and reservations carry an explicit local_visitors
//     / foreign_visitors head-count AND a male_count / female_count split
//     (reservations via the "Guest Type" field on the Reservation Form -
//     see ensureGuestTypeColumns()), so each record's gender split is
//     apportioned between local and foreign in the same proportion as its
//     local/foreign head-counts. The local part is then placed under "This
//     Municipality" or "Other Municipality" based on whether the hometown
//     (origin) mentions Tukuran.
//   * Legacy rows saved before the Guest Type field existed default to
//     local_visitors = 0 / foreign_visitors = 0 (no split ever recorded),
//     so - exactly like a walk-in with no split - they're treated as
//     Philippine (local) visitors rather than silently dropped.
//   * Totals stay internally consistent: Male + Female = Total in every
//     cell, and the three residence groups sum to the Grand Total.

function classifyPhilippineOrigin($origin) {
    // Returns 'this' when the hometown clearly refers to Tukuran, otherwise
    // 'other'. Kept deliberately simple/robust to messy free-text input.
    $o = strtolower(trim($origin));
    if ($o !== '' && strpos($o, 'tukuran') !== false) {
        return 'this';
    }
    return 'other';
}

function splitGenderByRatio($male, $female, $partHead, $totalHead) {
    // Apportion a record's male/female counts onto a sub-group (e.g. the
    // foreign portion of a mixed walk-in) proportionally to head-count,
    // keeping the numbers as whole people.
    if ($totalHead <= 0 || $partHead <= 0) {
        return ['m' => 0, 'f' => 0];
    }
    if ($partHead >= $totalHead) {
        return ['m' => $male, 'f' => $female];
    }
    $ratio = $partHead / $totalHead;
    $m = (int) round($male * $ratio);
    $f = (int) round($female * $ratio);
    // Never apportion more than exists in the record.
    $m = max(0, min($m, $male));
    $f = max(0, min($f, $female));
    return ['m' => $m, 'f' => $f];
}

function getLguVisitorRecord($db, $endDate, $beachId) {
    $ref         = strtotime($endDate);
    $monthStart  = date('Y-m-01', $ref);
    $monthEnd    = date('Y-m-t', $ref);
    $daysInMonth = (int) date('t', $ref);

    // Initialise an accumulator for every day of the month.
    $days = [];
    for ($d = 1; $d <= $daysInMonth; $d++) {
        $dateStr = date('Y-m-d', strtotime($monthStart . ' +' . ($d - 1) . ' days'));
        $days[$d] = [
            'day'     => $d,
            'weekday' => date('D', strtotime($dateStr)) . '.', // Sun. Mon. ...
            'this'    => ['male' => 0, 'female' => 0, 'total' => 0],
            'other'   => ['male' => 0, 'female' => 0, 'total' => 0],
            'foreign' => ['male' => 0, 'female' => 0, 'total' => 0],
            'grand'   => ['male' => 0, 'female' => 0, 'total' => 0],
        ];
    }

    $addCell = function (&$cell, $m, $f) {
        $cell['male']   += $m;
        $cell['female'] += $f;
        $cell['total']  += ($m + $f);
    };

    // Splits one record's male/female counts into a Local cell (bucketed
    // "this"/"other" by hometown) and a Foreign cell, apportioned by the
    // record's own local_visitors/foreign_visitors head-count. Shared by
    // both walk-ins and reservations so they're classified identically.
    $applyLocalForeignSplit = function (&$dayRow, $male, $female, $localVisitors, $foreignVisitors, $fallbackTotal, $origin) use ($addCell) {
        $localH   = max(0, (int) $localVisitors);
        $foreignH = max(0, (int) $foreignVisitors);
        $headTotal = $localH + $foreignH;

        // If no local/foreign head-count was recorded, treat everyone as
        // a Philippine (local) visitor so nobody is dropped.
        if ($headTotal <= 0) {
            $localH   = ($male + $female) > 0 ? ($male + $female) : (int) $fallbackTotal;
            $foreignH = 0;
            $headTotal = $localH;
        }

        // Foreign portion of this record's gender split.
        $foreignGender = splitGenderByRatio($male, $female, $foreignH, $headTotal);
        $localGender   = [
            'm' => $male - $foreignGender['m'],
            'f' => $female - $foreignGender['f'],
        ];

        if ($foreignGender['m'] + $foreignGender['f'] > 0 || $foreignH > 0) {
            $addCell($dayRow['foreign'], $foreignGender['m'], $foreignGender['f']);
        }

        if ($localGender['m'] + $localGender['f'] > 0 || $localH > 0) {
            $bucket = classifyPhilippineOrigin($origin); // 'this' | 'other'
            $addCell($dayRow[$bucket], $localGender['m'], $localGender['f']);
        }
    };

    // ---- Walk-in visits ---------------------------------------------------
    $params = [$monthStart, $monthEnd];
    if ($beachId) $params[] = $beachId;
    $stmt = $db->prepare("
        SELECT visit_date, male_count, female_count, total_visitors,
               local_visitors, foreign_visitors, origin
        FROM walk_in_visits
        WHERE visit_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $stmt->execute($params);
    foreach ($stmt->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $day = (int) date('j', strtotime($row['visit_date']));
        if (!isset($days[$day])) continue;

        $applyLocalForeignSplit(
            $days[$day],
            (int) $row['male_count'],
            (int) $row['female_count'],
            $row['local_visitors'],
            $row['foreign_visitors'],
            $row['total_visitors'],
            $row['origin']
        );
    }

    // ---- Confirmed reservations ------------------------------------------
    // Reservations now carry the same local_visitors/foreign_visitors split
    // as walk-ins (filled in by the "Guest Type" field on the Reservation
    // Form), so they're classified with the exact same rule instead of
    // being assumed all-local.
    $params2 = [$monthStart, $monthEnd];
    if ($beachId) $params2[] = $beachId;
    $stmt2 = $db->prepare("
        SELECT reservation_date, male_count, female_count, num_visitors,
               local_visitors, foreign_visitors, origin
        FROM reservations
        WHERE status IN ('Confirmed', 'Completed') AND reservation_date BETWEEN ? AND ?" . beachFilterClause($beachId) . "
    ");
    $stmt2->execute($params2);
    foreach ($stmt2->fetchAll(PDO::FETCH_ASSOC) as $row) {
        $day = (int) date('j', strtotime($row['reservation_date']));
        if (!isset($days[$day])) continue;

        $applyLocalForeignSplit(
            $days[$day],
            (int) $row['male_count'],
            (int) $row['female_count'],
            $row['local_visitors'],
            $row['foreign_visitors'],
            $row['num_visitors'],
            $row['origin']
        );
    }

    // ---- Per-day grand totals + month totals -----------------------------
    $monthTotals = [
        'this'    => ['male' => 0, 'female' => 0, 'total' => 0],
        'other'   => ['male' => 0, 'female' => 0, 'total' => 0],
        'foreign' => ['male' => 0, 'female' => 0, 'total' => 0],
        'grand'   => ['male' => 0, 'female' => 0, 'total' => 0],
    ];

    $rows = [];
    foreach ($days as $d) {
        foreach (['this', 'other', 'foreign'] as $g) {
            $d['grand']['male']   += $d[$g]['male'];
            $d['grand']['female'] += $d[$g]['female'];
            $d['grand']['total']  += $d[$g]['total'];
        }
        foreach (['this', 'other', 'foreign', 'grand'] as $g) {
            $monthTotals[$g]['male']   += $d[$g]['male'];
            $monthTotals[$g]['female'] += $d[$g]['female'];
            $monthTotals[$g]['total']  += $d[$g]['total'];
        }
        $rows[] = $d;
    }

    return [
        'monthYear' => strtoupper(date('F, Y', $ref)),
        'rows'      => $rows,
        'totals'    => $monthTotals,
    ];
}

// ========================================
// ===== REPORT BEACH / SPOT NAME =====
// ========================================
// Name shown on the "Name of Attraction/Spot/Beaches" line of the LGU form.
// When no single beach is selected the report is municipality-wide.

function getReportBeachName($db, $beachId) {
    if (!$beachId) {
        return 'All Registered Beaches';
    }
    $stmt = $db->prepare("SELECT beach_name FROM beaches WHERE beach_id = ? LIMIT 1");
    $stmt->execute([$beachId]);
    $row = $stmt->fetch(PDO::FETCH_ASSOC);
    return $row ? $row['beach_name'] : 'All Registered Beaches';
}
?>
