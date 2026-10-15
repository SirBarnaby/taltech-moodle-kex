<?php
// M3-M5 lab seed. Idempotent. Adds the data the Workspace, activity pages, grades, notifications, calendar and messages need.
//   docker cp tools/lab/m3_seed.php moodle-lab-moodle-1:/tmp/m3_seed.php
//   docker exec -u nobody moodle-lab-moodle-1 php /tmp/m3_seed.php
//
// Adds (ITI8801 is course 2):
//   - assignments due: Lab 6 stays overdue, Lab 7 in ~6 days, "Report: cloud migration plan" (file + online text) in ~3 days;
//     Lab 5 submitted, Lab 4 submitted + graded
//   - quiz "Quiz: Containers basics" (open now, 30 min limit, 3 questions)
//   - forum discussions with replies (Q&A forum) and announcements
//   - grades in several courses, notifications, one conversation, calendar events
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/mod/quiz/locallib.php');
require_once($CFG->dirroot . '/mod/assign/locallib.php');
require_once($CFG->libdir . '/gradelib.php');
require_once($CFG->dirroot . '/calendar/lib.php');
require_once($CFG->dirroot . '/message/lib.php');

\core\session\manager::set_user(get_admin());
$gen = \core\test\phpunit\phpunit_util::get_data_generator();
$student = $DB->get_record('user', ['username' => 'student'], '*', MUST_EXIST);
$teacher = $DB->get_record('user', ['username' => 'teacher'], '*', MUST_EXIST);
$now = time();
$day = DAYSECS;
$c2 = $DB->get_record('course', ['shortname' => 'ITI8801'], '*', MUST_EXIST);

function cm_of(string $mod, int $courseid, string $name) {
    global $DB;
    return $DB->get_record_sql("SELECT cm.id cmid, i.* FROM {course_modules} cm JOIN {modules} m ON m.id = cm.module AND m.name = ?
        JOIN {" . $mod . "} i ON i.id = cm.instance WHERE cm.course = ? AND i.name = ? AND cm.deletioninprogress = 0", [$mod, $courseid, $name]);
}

// ---- assignments -------------------------------------------------------------
$lab6 = cm_of('assign', $c2->id, 'Lab 6: Kubernetes');
$lab7 = cm_of('assign', $c2->id, 'Lab 7: Observability');
$DB->set_field('assign', 'duedate', $now - 6 * 3600, ['id' => $lab6->id]); // overdue, no submission
$DB->set_field('assign', 'duedate', $now + 6 * $day + 3 * 3600, ['id' => $lab7->id]);
$DB->set_field('assign', 'cutoffdate', 0, ['id' => $lab6->id]);

$report = cm_of('assign', $c2->id, 'Report: cloud migration plan');
if (!$report) {
    $gen->create_module('assign', [
        'course' => $c2->id, 'section' => 3, 'name' => 'Report: cloud migration plan',
        'intro' => '<p>Describe how you would migrate a small web shop to the cloud. Upload a PDF or write it in the editor.</p>', 'introformat' => FORMAT_HTML,
        'duedate' => $now + 3 * $day + 2 * 3600, 'allowsubmissionsfromdate' => $now - 7 * $day,
        'assignsubmission_file_enabled' => 1, 'assignsubmission_file_maxfiles' => 3, 'assignsubmission_file_maxsizebytes' => 2097152,
        'assignsubmission_onlinetext_enabled' => 1, 'completion' => 1,
    ]);
    echo "created report assignment\n";
}

function submit_text(int $courseid, string $name, int $userid, string $text, ?float $grade = null) {
    global $DB;
    $cm = cm_of('assign', $courseid, $name);
    if (!$cm) { return; }
    $context = context_module::instance($cm->cmid);
    $course = get_course($courseid);
    $assign = new assign($context, get_coursemodule_from_id('assign', $cm->cmid), $course);
    $sub = $assign->get_user_submission($userid, true);
    if ($sub->status === 'submitted') { return; }
    \core\session\manager::set_user(core_user::get_user($userid));
    $data = new stdClass();
    $data->onlinetext_editor = ['text' => $text, 'format' => FORMAT_HTML, 'itemid' => file_get_unused_draft_itemid()];
    $assign->save_submission($data, $notices);
    \core\session\manager::set_user(get_admin());
    if ($grade !== null) {
        $assign = new assign($context, get_coursemodule_from_id('assign', $cm->cmid), $course);
        $g = $assign->get_user_grade($userid, true);
        $g->grade = $grade;
        $g->grader = get_admin()->id;
        $assign->update_grade($g);
        $assign->get_user_grade($userid, true);
    }
}
submit_text($c2->id, 'Lab 4: Infrastructure as code', $student->id, '<p>Terraform module attached in the repo.</p>', 92);
submit_text($c2->id, 'Lab 5: Containers & Docker', $student->id, '<p>Dockerfile and compose file are in the group repo.</p>');
submit_text($c2->id, 'Lab 3: Virtual machines', $student->id, '<p>Done with KVM.</p>', 78);

// ---- quiz --------------------------------------------------------------------
$quiz = cm_of('quiz', $c2->id, 'Quiz: Containers basics');
if (!$quiz || !$DB->record_exists('quiz_slots', ['quizid' => $quiz->id])) {
  if (!$quiz) {
    $created = $gen->create_module('quiz', [
        'course' => $c2->id, 'section' => 5, 'name' => 'Quiz: Containers basics',
        'intro' => '<p>Three short questions about containers.</p>', 'introformat' => FORMAT_HTML,
        'timeopen' => $now - $day, 'timeclose' => $now + 30 * $day, 'timelimit' => 1800,
        'preferredbehaviour' => 'deferredfeedback', 'grade' => 10, 'sumgrades' => 3, 'attempts' => 0, 'navmethod' => 'free',
        'questionsperpage' => 1, 'completion' => 1,
    ]);
    $quiz = cm_of('quiz', $c2->id, 'Quiz: Containers basics');
  }
    global $USER;
    $contextid = context_module::instance($quiz->cmid)->id;
    $qcat = question_get_default_category($contextid, true);
    $mk = function (string $qtype, string $name, string $text, array $extra) use ($qcat, $contextid, $USER) {
        $form = new stdClass();
        $form->category = $qcat->id . ',' . $contextid;
        $form->name = $name;
        $form->questiontext = ['text' => '<p>' . $text . '</p>', 'format' => FORMAT_HTML];
        $form->defaultmark = 1;
        $form->generalfeedback = ['text' => '', 'format' => FORMAT_HTML];
        $form->penalty = 0.3333333;
        foreach ($extra as $k => $v) { $form->$k = $v; }
        $question = new stdClass();
        $question->category = $qcat->id;
        $question->qtype = $qtype;
        $question->createdby = $USER->id;
        $question->contextid = $contextid;
        $question->idnumber = null;
        return question_bank::get_qtype($qtype)->save_question($question, $form);
    };
    $fb = fn() => ['text' => '', 'format' => FORMAT_HTML];
    $q1 = $mk('multichoice', 'Container runtime', 'Which of these is a container runtime?', [
        'single' => 1, 'shuffleanswers' => 0, 'answernumbering' => 'abc', 'showstandardinstruction' => 0,
        'correctfeedback' => $fb(), 'partiallycorrectfeedback' => $fb(), 'incorrectfeedback' => $fb(), 'shownumcorrect' => 0,
        'answer' => [['text' => 'containerd', 'format' => FORMAT_HTML], ['text' => 'Apache', 'format' => FORMAT_HTML], ['text' => 'Postgres', 'format' => FORMAT_HTML], ['text' => 'Nginx', 'format' => FORMAT_HTML]],
        'fraction' => [1.0, 0.0, 0.0, 0.0], 'feedback' => [$fb(), $fb(), $fb(), $fb()],
    ]);
    $q2 = $mk('truefalse', 'Containers share the kernel', 'Containers on one host share the host kernel.', [
        'correctanswer' => 1, 'feedbacktrue' => $fb(), 'feedbackfalse' => $fb(), 'penalty' => 1,
    ]);
    $q3 = $mk('shortanswer', 'Image file', 'Which file describes how a Docker image is built?', [
        'usecase' => 0, 'answer' => ['Dockerfile', '*'], 'fraction' => [1.0, 0.0], 'feedback' => [$fb(), $fb()],
    ]);
    foreach ([$q1, $q2, $q3] as $i => $q) {
        quiz_add_quiz_question($q->id, $quiz, $i + 1);
    }
    \mod_quiz\quiz_settings::create($quiz->id)->get_grade_calculator()->recompute_quiz_sumgrades();
    echo "created quiz with 3 questions\n";
}

// ---- forum -------------------------------------------------------------------
$fgen = $gen->get_plugin_generator('mod_forum');
$qa = cm_of('forum', $c2->id, 'Q&A forum');
$news = cm_of('forum', $c2->id, 'Announcements');
if ($qa && !$DB->record_exists('forum_discussions', ['forum' => $qa->id])) {
    $d1 = $fgen->create_discussion(['course' => $c2->id, 'forum' => $qa->id, 'userid' => $student->id,
        'name' => 'How do I expose a service from kind?', 'message' => '<p>I deployed the sample app but cannot reach it from the host. NodePort or Ingress?</p>', 'timemodified' => $now - 2 * $day]);
    $fgen->create_post(['discussion' => $d1->id, 'parent' => $d1->firstpost, 'userid' => $teacher->id,
        'subject' => 'Re: How do I expose a service from kind?', 'message' => '<p>Use <code>extraPortMappings</code> in the kind config and a NodePort service. See the Lab 6 slides, page 14.</p>', 'created' => $now - $day]);
    $d2 = $fgen->create_discussion(['course' => $c2->id, 'forum' => $qa->id, 'userid' => $teacher->id,
        'name' => 'Exam registration is open', 'message' => '<p>Register for the exam in ÕIS by <strong>1 November</strong>.</p>', 'timemodified' => $now - 5 * $day]);
    $d3 = $fgen->create_discussion(['course' => $c2->id, 'forum' => $qa->id, 'userid' => $student->id,
        'name' => 'Group project: choosing a topic', 'message' => '<p>Is it fine to build the project on top of the Terraform lab?</p>', 'timemodified' => $now - 3 * 3600]);
    echo "created forum discussions\n";
}
if ($news && !$DB->record_exists('forum_discussions', ['forum' => $news->id])) {
    $fgen->create_discussion(['course' => $c2->id, 'forum' => $news->id, 'userid' => $teacher->id,
        'name' => 'Lab 7 moved to Thursday', 'message' => '<p>Because of the holiday the observability lab is on Thursday, room ICT-401.</p>', 'timemodified' => $now - 4 * 3600]);
    $fgen->create_discussion(['course' => $c2->id, 'forum' => $news->id, 'userid' => $teacher->id,
        'name' => 'Welcome to Cloud Architectures and DevOps', 'message' => '<p>Lectures are on Tuesday, labs on Thursday. Bring a laptop.</p>', 'timemodified' => $now - 40 * $day]);
    echo "created announcements\n";
}
// A second course gets one announcement too (IAS0230).
$c4 = $DB->get_record('course', ['shortname' => 'IAS0230'], '*', MUST_EXIST);
$news4 = cm_of('forum', $c4->id, 'Announcements');
if ($news4 && !$DB->record_exists('forum_discussions', ['forum' => $news4->id])) {
    $fgen->create_discussion(['course' => $c4->id, 'forum' => $news4->id, 'userid' => $teacher->id,
        'name' => 'Board kits are available', 'message' => '<p>Pick up the Cortex-M boards from the lab assistant on Wednesday.</p>', 'timemodified' => $now - 2 * 3600]);
}

// ---- assignments due soon in other courses -----------------------------------
// (course, nth assignment, days from now; negative = overdue and unsubmitted)
foreach ([['EMT0140', 6, 2], ['IAS0230', 6, 1], ['IAS0230', 5, -1], ['MMO5770', 3, 9], ['ITB8833', 2, 20]] as [$short, $nth, $inDays]) {
    $c = $DB->get_record('course', ['shortname' => $short], '*', MUST_EXIST);
    $a = $DB->get_record_sql("SELECT a.* FROM {assign} a WHERE a.course = ? ORDER BY a.id LIMIT 1 OFFSET " . (int) $nth, [$c->id]);
    if ($a) { $DB->set_field('assign', 'duedate', $now + $inDays * $day + 4 * 3600, ['id' => $a->id]); }
}

// ---- grades ------------------------------------------------------------------
foreach ($DB->get_records('course', null, 'id', 'id, shortname') as $c) {
    if ($c->id == 1) { continue; }
    $assigns = $DB->get_records('assign', ['course' => $c->id], 'id', 'id, name', 0, 3);
    $score = 70;
    foreach ($assigns as $a) {
        $score += 9;
        grade_update('mod/assign', $c->id, 'mod', 'assign', $a->id, 0,
            ['userid' => $student->id, 'rawgrade' => min(100, $score + $c->id)], ['itemname' => $a->name, 'gradetype' => GRADE_TYPE_VALUE, 'grademax' => 100]);
    }
    grade_regrade_final_grades($c->id);
}

// ---- notifications -----------------------------------------------------------
$base = $DB->get_field_select('notifications', 'COUNT(1)', 'useridto = ?', [$student->id]);
if ($base < 8) {
    $notes = [
        ['mod_forum', 'posts', 'Lab 7 moved to Thursday', 'Cloud Architectures and DevOps: Announcements', "/mod/forum/discuss.php?d=%d", 4 * 3600, 0],
        ['mod_forum', 'posts', 'Re: How do I expose a service from kind?', 'Cloud Architectures and DevOps: Q&A forum', "/mod/forum/discuss.php?d=%d", 20 * 3600, 0],
        ['mod_assign', 'assign_notification', 'Grade released: Lab 4: Infrastructure as code', 'You have a new grade: 92 / 100', "/mod/assign/view.php?id=%d", 2 * $day, 0],
        ['mod_forum', 'posts', 'Board kits are available', 'Basics of Embedded Systems: Announcements', "/course/view.php?id=4", 2 * 3600, 0],
        ['moodle', 'instantmessage', 'New message from Mari Tamm', 'Please send me the repo link before Thursday.', "/message/index.php", 5 * 3600, 0],
        ['mod_quiz', 'submission', 'Quiz available: Containers basics', 'The quiz is open until 15 November.', "/mod/quiz/view.php?id=%d", 3 * $day, 1],
        ['mod_assign', 'assign_notification', 'Assignment due soon: Report: cloud migration plan', 'Due in 3 days.', "/mod/assign/view.php?id=%d", 6 * 3600, 0],
        ['mod_forum', 'posts', 'Exam registration is open', 'Register for the exam in ÕIS by 1 November.', "/mod/forum/discuss.php?d=%d", 5 * $day, 1],
    ];
    $disc = $DB->get_records('forum_discussions', ['course' => $c2->id], 'id', 'id', 0, 4);
    $discids = array_values(array_map(fn($d) => (int) $d->id, $disc));
    $lab4 = cm_of('assign', $c2->id, 'Lab 4: Infrastructure as code');
    $quizcm = cm_of('quiz', $c2->id, 'Quiz: Containers basics');
    $repcm = cm_of('assign', $c2->id, 'Report: cloud migration plan');
    foreach ($notes as $i => [$component, $eventtype, $subject, $small, $url, $ago, $read]) {
        $id = [$discids[0] ?? 1, $discids[1] ?? 1, $lab4->cmid ?? 1, 0, 0, $quizcm->cmid ?? 1, $repcm->cmid ?? 1, $discids[2] ?? 1][$i];
        $n = new stdClass();
        $n->useridfrom = $teacher->id;
        $n->useridto = $student->id;
        $n->subject = $subject;
        $n->fullmessage = $small;
        $n->fullmessageformat = FORMAT_HTML;
        $n->fullmessagehtml = '<p>' . s($small) . '</p><p>Open the link to read the full message.</p>';
        $n->smallmessage = $small;
        $n->component = $component;
        $n->eventtype = $eventtype;
        $n->contexturl = $CFG->wwwroot . (strpos($url, '%d') !== false ? sprintf($url, $id) : $url);
        $n->contexturlname = 'Open';
        $n->timeread = $read ? $now - $ago + 3600 : null;
        $n->timecreated = $now - $ago;
        $n->customdata = null;
        $nid = $DB->insert_record('notifications', $n);
        $DB->insert_record('message_popup_notifications', (object) ['notificationid' => $nid], false);
    }
    echo "created notifications\n";
}

// ---- messages ----------------------------------------------------------------
if (!$DB->record_exists_select('messages', 'useridfrom IN (?, ?)', [$student->id, $teacher->id])) {
    $conv = \core_message\api::create_conversation(\core_message\api::MESSAGE_CONVERSATION_TYPE_INDIVIDUAL, [$student->id, $teacher->id]);
    \core_message\api::send_message_to_conversation($student->id, $conv->id, 'Hi, which repo should I link for Lab 6?', FORMAT_PLAIN);
    \core_message\api::send_message_to_conversation($teacher->id, $conv->id, 'Please send me the repo link before Thursday.', FORMAT_PLAIN);
    \core_message\api::send_message_to_conversation($teacher->id, $conv->id, 'Also: the observability lab starts at 10:15.', FORMAT_PLAIN);
    echo "created conversation\n";
}

// ---- calendar ----------------------------------------------------------------
if (!$DB->record_exists('event', ['name' => 'Study group: Kubernetes', 'userid' => $student->id])) {
    \core\session\manager::set_user($student);
    calendar_event::create((object) ['name' => 'Study group: Kubernetes', 'description' => 'Library room 3', 'format' => FORMAT_HTML,
        'eventtype' => 'user', 'userid' => $student->id, 'timestart' => $now + 2 * $day + 12 * 3600, 'timeduration' => 3600, 'courseid' => 0], false);
    calendar_event::create((object) ['name' => 'Revise networking notes', 'description' => '', 'format' => FORMAT_HTML,
        'eventtype' => 'user', 'userid' => $student->id, 'timestart' => $now + 9 * $day + 9 * 3600, 'timeduration' => 0, 'courseid' => 0], false);
    \core\session\manager::set_user(get_admin());
    calendar_event::create((object) ['name' => 'ITI8801 midterm', 'description' => 'Room SOC-201', 'format' => FORMAT_HTML,
        'eventtype' => 'course', 'courseid' => $c2->id, 'timestart' => $now + 5 * $day + 10 * 3600, 'timeduration' => 5400], false);
    echo "created calendar events\n";
}

rebuild_course_cache($c2->id, true);
echo "m3 seed done\n";
