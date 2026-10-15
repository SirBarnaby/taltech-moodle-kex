<?php
// Puts the lab back to the state the M3 e2e specs expect: every student notification unread.
//   docker cp tools/lab/m3_reset.php moodle-lab-moodle-1:/tmp/m3_reset.php && docker exec -u nobody moodle-lab-moodle-1 php /tmp/m3_reset.php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
$student = $DB->get_record('user', ['username' => 'student'], '*', MUST_EXIST);
$DB->execute('UPDATE {notifications} SET timeread = NULL WHERE useridto = ?', [$student->id]);
echo "notifications reset\n";
