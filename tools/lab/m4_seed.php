<?php
// M4 lab seed. Idempotent. Adds a folder and a book (3 chapters) to IEE2630 (course 7), plus a lesson and a choice,
// so the folder / book / generic module skins have something to render.
//   docker cp tools/lab/m4_seed.php moodle-lab-moodle-1:/tmp/m4_seed.php
//   docker exec -u nobody moodle-lab-moodle-1 php /tmp/m4_seed.php
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->dirroot . '/course/lib.php');

\core\session\manager::set_user(get_admin());
$gen = \core\test\phpunit\phpunit_util::get_data_generator();
$c = $DB->get_record('course', ['shortname' => 'IEE2630'], '*', MUST_EXIST);

function has_mod(string $mod, int $courseid, string $name): bool {
    global $DB;
    return $DB->record_exists_sql("SELECT 1 FROM {course_modules} cm JOIN {modules} m ON m.id = cm.module AND m.name = ?
        JOIN {" . $mod . "} i ON i.id = cm.instance WHERE cm.course = ? AND i.name = ? AND cm.deletioninprogress = 0", [$mod, $courseid, $name]);
}

if (!has_mod('folder', $c->id, 'Lecture handouts')) {
    $cm = $gen->create_module('folder', ['course' => $c->id, 'section' => 2, 'name' => 'Lecture handouts', 'intro' => '<p>All handouts in one place.</p>', 'introformat' => FORMAT_HTML, 'showexpanded' => 1]);
    $ctx = context_module::instance($cm->cmid);
    $fs = get_file_storage();
    foreach (['week1-intro.txt' => 'Intro handout', 'week2-circuits.txt' => 'Circuits handout', 'week3-filters.txt' => 'Filters handout'] as $fn => $txt) {
        $fs->create_file_from_string(['contextid' => $ctx->id, 'component' => 'mod_folder', 'filearea' => 'content', 'itemid' => 0, 'filepath' => '/', 'filename' => $fn], $txt . str_repeat(" lorem ipsum", 40));
    }
    $fs->create_file_from_string(['contextid' => $ctx->id, 'component' => 'mod_folder', 'filearea' => 'content', 'itemid' => 0, 'filepath' => '/Exercises/', 'filename' => 'exercise-1.txt'], 'Exercise 1');
    echo "created folder\n";
}
if (!has_mod('book', $c->id, 'Course notes')) {
    $book = $gen->create_module('book', ['course' => $c->id, 'section' => 2, 'name' => 'Course notes', 'intro' => '<p>Read in order.</p>', 'introformat' => FORMAT_HTML, 'numbering' => 1]);
    $bg = $gen->get_plugin_generator('mod_book');
    $bg->create_chapter(['bookid' => $book->id, 'title' => 'Signals', 'content' => '<p>A signal carries information over time.</p><h3>Sampling</h3><p>Nyquist says sample at twice the highest frequency.</p>']);
    $bg->create_chapter(['bookid' => $book->id, 'title' => 'Filters', 'content' => '<p>A filter shapes the spectrum of a signal.</p><pre>y[n] = a * x[n] + (1 - a) * y[n-1]</pre>']);
    $bg->create_chapter(['bookid' => $book->id, 'title' => 'Noise', 'content' => '<p>Noise is what is left once you take the signal away.</p>']);
    echo "created book\n";
}
if (!has_mod('choice', $c->id, 'Which lab slot suits you?')) {
    $gen->create_module('choice', ['course' => $c->id, 'section' => 2, 'name' => 'Which lab slot suits you?', 'intro' => '<p>Pick one.</p>', 'introformat' => FORMAT_HTML,
        'option' => ['Tuesday 10:00', 'Wednesday 14:00', 'Friday 12:00'], 'limitanswers' => 0, 'showresults' => 1]);
    echo "created choice\n";
}
// Resources that render a Moodle page (embedded PDF / click-to-open), unlike the stock ones that redirect to the file.
$pdf = "%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 300 200]/Contents 4 0 R/Resources<</Font<</F1 5 0 R>>>>>>endobj\n4 0 obj<</Length 44>>stream\nBT /F1 18 Tf 40 100 Td (Datasheet) Tj ET\nendstream endobj\n5 0 obj<</Type/Font/Subtype/Type1/BaseFont/Helvetica>>endobj\ntrailer<</Root 1 0 R/Size 6>>\n%%EOF";
foreach ([['Datasheet (embedded PDF)', 'datasheet.pdf', $pdf, 1], ['Spec sheet (click to open)', 'spec.docx', 'PK fake docx ' . str_repeat('x', 600), 3]] as [$name, $fn, $bytes, $display]) {
    if (has_mod('resource', $c->id, $name)) { continue; }
    $cm = $gen->create_module('resource', ['course' => $c->id, 'section' => 2, 'name' => $name, 'intro' => '', 'display' => $display, 'showsize' => 1, 'showtype' => 1, 'files' => 0]);
    $ctx = context_module::instance($cm->cmid);
    get_file_storage()->create_file_from_string(['contextid' => $ctx->id, 'component' => 'mod_resource', 'filearea' => 'content', 'itemid' => 0, 'filepath' => '/', 'filename' => $fn], $bytes);
    echo "created resource $name\n";
}
rebuild_course_cache($c->id, true);
echo "m4 seed done\n";
// Existing seeds from earlier runs: the docx resource opens in a new window (Moodle's "click to open" page).
$DB->set_field('resource', 'display', 3, ['name' => 'Spec sheet (click to open)']);
purge_all_caches();
