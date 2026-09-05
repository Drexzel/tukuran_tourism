<?php
// ========================================
// ===== BEACHES API (alias) =====
// ========================================
// NOTE: This file previously contained a duplicate, out-of-sync copy of the
// beach-listing query (wrong include path, old column names like
// "entrance_fee", and a non-existent "accommodations" table). To avoid two
// copies of the same logic drifting apart again, this now simply delegates
// to get-beaches.php, which is the version actually used by the frontend
// (Beach Management and Browse All Beaches both call get-beaches.php).

require __DIR__ . '/get-beaches.php';
?>
