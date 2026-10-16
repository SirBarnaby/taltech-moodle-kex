<?php
// Puts the lab back to the state the M4 e2e flows start from: no submission on "Report: cloud migration plan", no attempts at
// "Quiz: Containers basics", no replies titled "KEX e2e ...". Idempotent.
//   docker cp tools/lab/m4_reset.php moodle-lab-moodle-1:/tmp/m4_reset.php && docker exec -u nobody moodle-lab-moodle-1 php /tmp/m4_reset.php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/mod/forum/lib.php');

\core\session\manager::set_user(get_admin());
$student = $DB->get_record('user', ['username' => 'student'], '*', MUST_EXIST);

// assignment
$cm = $DB->get_record_sql("SELECT cm.id FROM {course_modules} cm JOIN {modules} m ON m.id = cm.module AND m.name = 'assign' JOIN {assign} a ON a.id = cm.instance WHERE a.name = ?", ['Report: cloud migration plan']);
if ($cm) {
    $cmo = get_coursemodule_from_id('assign', $cm->id);
    $assign = new assign(context_module::instance($cm->id), $cmo, get_course($cmo->course));
    $assign->remove_submission($student->id);
    $DB->delete_records('assign_submission', ['assignment' => $cmo->instance, 'userid' => $student->id]);
    get_file_storage()->delete_area_files(context_module::instance($cm->id)->id, 'assignsubmission_file');
}

// quiz
$quiz = $DB->get_record('quiz', ['name' => 'Quiz: Containers basics']);
if ($quiz) {
    foreach ($DB->get_records('quiz_attempts', ['quiz' => $quiz->id]) as $attempt) {
        quiz_delete_attempt($attempt, $quiz);
    }
}

// forum replies
foreach ($DB->get_records_select('forum_posts', $DB->sql_like('message', '?'), ['%KEX e2e%']) as $post) {
    if (!$DB->record_exists('forum_posts', ['id' => $post->id])) { continue; }
    $disc = $DB->get_record('forum_discussions', ['id' => $post->discussion]);
    $forum = $DB->get_record('forum', ['id' => $disc->forum]);
    $cmf = get_coursemodule_from_instance('forum', $forum->id);
    forum_delete_post($post, true, get_course($forum->course), $cmf, $forum);
}
$DB->delete_records_select('forum_discussions', $DB->sql_like('name', '?'), ['KEX e2e%']);
echo "m4 reset done\n";
