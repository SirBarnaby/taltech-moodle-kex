<?php
// Lab fixture that makes ITI8801 (course 2) match ai_generated_enhanced_drafts/iteration3.png. Idempotent.
//   docker cp tools/lab/iter3_fixture.php moodle-lab-moodle-1:/tmp/iter3_fixture.php
//   docker exec moodle-lab-moodle-1 php /tmp/iter3_fixture.php
//
// Result: section 6 "Kubernetes" has exactly 3 visible cms with completion off:
//   resource "Kubernetes — lecture slides" (PDF), resource "Practice 6: Deploy a service" (PDF), url "Week 6: Lecture recording".
// Its other cms are hidden, sections 7-8 are hidden, and section 6 is the highlighted (current) section.
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->libdir . '/filelib.php');

\core\session\manager::set_user(get_admin());
$courseid = (int) $DB->get_field('course', 'id', ['shortname' => 'ITI8801'], MUST_EXIST);
$course = get_course($courseid);
$section6 = $DB->get_record('course_sections', ['course' => $courseid, 'section' => 6], '*', MUST_EXIST);

function find_cm_by_name(int $courseid, string $modname, string $name) {
    global $DB;
    return $DB->get_record_sql(
        "SELECT cm.id, cm.instance FROM {course_modules} cm JOIN {modules} m ON m.id = cm.module
           JOIN {" . $modname . "} i ON i.id = cm.instance
          WHERE cm.course = ? AND m.name = ? AND i.name = ? AND cm.deletioninprogress = 0", [$courseid, $modname, $name]);
}

/** The cms of section 6 by module. */
$cms = $DB->get_records_sql(
    "SELECT cm.id, m.name AS modname, cm.instance FROM {course_modules} cm JOIN {modules} m ON m.id = cm.module
      WHERE cm.course = ? AND cm.section = ? AND cm.deletioninprogress = 0 ORDER BY cm.id", [$courseid, $section6->id]);

$slides = null;
$url = null;
$others = [];
$practice = find_cm_by_name($courseid, 'resource', 'Practice 6: Deploy a service');
foreach ($cms as $cm) {
    if ($practice && (int) $cm->id === (int) $practice->id) { continue; }
    if ($cm->modname === 'resource' && $slides === null) { $slides = $cm; }
    else if ($cm->modname === 'url' && $url === null) { $url = $cm; }
    else { $others[] = $cm; }
}

function set_name(string $table, int $id, string $name): void {
    global $DB;
    $DB->set_field($table, 'name', $name, ['id' => $id]);
    $DB->set_field($table, 'timemodified', time(), ['id' => $id]);
}

// 1. Lecture slides (reuse the existing resource of the section).
if ($slides) { set_name('resource', (int) $slides->instance, 'Kubernetes — lecture slides'); }
// 2. Recording url.
if ($url) { set_name('url', (int) $url->instance, 'Week 6: Lecture recording'); }

// 3. Practice resource: create it once, with a copy of the lecture PDF.
if (!$practice && $slides) {
    $fs = get_file_storage();
    $srcctx = context_module::instance((int) $slides->id);
    $files = $fs->get_area_files($srcctx->id, 'mod_resource', 'content', 0, 'id', false);
    $src = reset($files);
    $usercontext = context_user::instance(get_admin()->id);
    $draftid = file_get_unused_draft_itemid();
    $fs->create_file_from_string([
        'contextid' => $usercontext->id, 'component' => 'user', 'filearea' => 'draft', 'itemid' => $draftid,
        'filepath' => '/', 'filename' => 'practice6.pdf',
    ], $src ? $src->get_content() : '%PDF-1.1');
    $info = new stdClass();
    $info->modulename = 'resource';
    $info->module = (int) $DB->get_field('modules', 'id', ['name' => 'resource'], MUST_EXIST);
    $info->course = $courseid;
    $info->section = 6;
    $info->visible = 1;
    $info->visibleoncoursepage = 1;
    $info->name = 'Practice 6: Deploy a service';
    $info->introeditor = ['text' => '', 'format' => FORMAT_HTML, 'itemid' => file_get_unused_draft_itemid()];
    $info->intro = '';
    $info->introformat = FORMAT_HTML;
    $info->showdescription = 0;
    $info->display = 0;
    $info->showsize = 0;
    $info->showtype = 0;
    $info->showdate = 0;
    $info->printintro = 0;
    $info->files = $draftid;
    $info->completion = 0;
    $info->cmidnumber = '';
    $info->groupmode = 0;
    $info->groupingid = 0;
    $info->availabilityconditionsjson = '';
    $created = create_module($info);
    $practice = (object) ['id' => $created->coursemodule, 'instance' => $created->instance];
}

// 4. Visible set, completion off.
$keep = [];
foreach ([$slides, $practice, $url] as $cm) { if ($cm) { $keep[] = (int) $cm->id; } }
foreach ($keep as $cmid) {
    $DB->set_field('course_modules', 'completion', 0, ['id' => $cmid]);
    $DB->set_field('course_modules', 'completionview', 0, ['id' => $cmid]);
    set_coursemodule_visible($cmid, 1);
}
foreach ($others as $cm) { set_coursemodule_visible((int) $cm->id, 0); }
foreach ($DB->get_records_sql(
    "SELECT cm.id FROM {course_modules} cm WHERE cm.course = ? AND cm.section = ? AND cm.deletioninprogress = 0", [$courseid, $section6->id]) as $r) {
    if (!in_array((int) $r->id, $keep, true)) { set_coursemodule_visible((int) $r->id, 0); }
}

// 5. Order inside the section: slides, practice, recording.
$seq = array_values(array_filter(array_unique(array_merge($keep, array_map(fn($c) => (int) $c->id, $others)))));
$seqnow = array_map('intval', explode(',', (string) $DB->get_field('course_sections', 'sequence', ['id' => $section6->id])));
$seq = array_values(array_unique(array_merge($keep, $seqnow)));
$DB->set_field('course_sections', 'sequence', implode(',', $seq), ['id' => $section6->id]);

// 6. Sections 7 and 8 hidden, section 6 current.
foreach ([7, 8] as $n) { set_section_visible($courseid, $n, 0); }
course_set_marker($courseid, 6);
// The weeks format derives "current" from the course start date: make week 6 this week (also harmless for topics format).
$weekstart = strtotime('monday this week 00:00:00');
$DB->set_field('course', 'startdate', $weekstart - 5 * 7 * DAYSECS, ['id' => $courseid]);
$DB->set_field('course', 'enddate', $weekstart + 8 * 7 * DAYSECS, ['id' => $courseid]);

rebuild_course_cache($courseid, true);
echo "iter3 fixture applied to course $courseid; visible cms: " . implode(',', $keep) . "\n";
