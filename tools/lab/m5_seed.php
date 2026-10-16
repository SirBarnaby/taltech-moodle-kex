<?php
// M5 lab seed. Idempotent. Awards two manual site badges to the student (user 3) so the badges page has a grid to render,
// and adds a second conversation message so the messages skin has more than one row.
//   docker cp tools/lab/m5_seed.php moodle-lab-moodle-1:/tmp/m5_seed.php
//   docker exec -u nobody moodle-lab-moodle-1 php /tmp/m5_seed.php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/badgeslib.php');
require_once($CFG->libdir . '/gdlib.php');

\core\session\manager::set_user(get_admin());
set_config('enablebadges', 1);

function png(string $path, int $r, int $g, int $b): void {
    $im = imagecreatetruecolor(200, 200);
    imagealphablending($im, false);
    imagesavealpha($im, true);
    imagefill($im, 0, 0, imagecolorallocatealpha($im, 0, 0, 0, 127));
    imagefilledellipse($im, 100, 100, 190, 190, imagecolorallocate($im, $r, $g, $b));
    imagefilledellipse($im, 100, 100, 120, 120, imagecolorallocate($im, 255, 255, 255));
    imagefilledellipse($im, 100, 100, 70, 70, imagecolorallocate($im, $r, $g, $b));
    imagepng($im, $path);
}

foreach ([['Containers explorer', 'Awarded for finishing the containers basics quiz.', [102, 51, 204]], ['Early bird', 'Submitted a lab a week before the deadline.', [228, 6, 126]]] as [$name, $desc, $rgb]) {
    if ($DB->record_exists('badge', ['name' => $name])) {
        continue;
    }
    $now = time();
    $b = new stdClass();
    $b->name = $name; $b->version = ''; $b->language = 'en'; $b->description = $desc;
    $b->timecreated = $now; $b->timemodified = $now; $b->usercreated = 2; $b->usermodified = 2;
    $b->issuername = 'LabMoodle'; $b->issuerurl = $CFG->wwwroot; $b->issuercontact = 'lab@example.com';
    $b->expiredate = null; $b->expireperiod = null; $b->type = BADGE_TYPE_SITE; $b->courseid = null;
    $b->messagesubject = 'Badge awarded'; $b->message = 'You earned a badge'; $b->attachment = 1; $b->notification = 0;
    $b->status = BADGE_STATUS_INACTIVE; $b->nextcron = null;
    $id = $DB->insert_record('badge', $b, true);
    $badge = new badge($id);
    $tmp = make_temp_directory('badges') . '/' . $id . '.png';
    png($tmp, ...$rgb);
    badges_process_badge_image($badge, $tmp);
    $crit = award_criteria::build(['criteriatype' => BADGE_CRITERIA_TYPE_OVERALL, 'badgeid' => $id]);
    $crit->save(['agg' => BADGE_CRITERIA_AGGREGATION_ANY]);
    $crit = award_criteria::build(['criteriatype' => BADGE_CRITERIA_TYPE_MANUAL, 'badgeid' => $id]);
    $crit->save(['agg' => BADGE_CRITERIA_AGGREGATION_ANY, 'role_1' => 1]);
    $badge = new badge($id);
    $badge->set_status(BADGE_STATUS_ACTIVE);
    $badge->issue(3, true);
    echo "awarded $name\n";
}
echo "done\n";
