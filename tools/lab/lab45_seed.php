<?php
// Round 2 lab seed for the Moodle 4.5 lab (:8081, Bootstrap 4). Idempotent. Run after kex_seed.php + m3/m4/m5 seeds.
//   docker cp tools/lab/lab45_seed.php moodle-lab-45-moodle-1:/tmp/lab45_seed.php
//   docker exec -u nobody moodle-lab-45-moodle-1 php /tmp/lab45_seed.php
//
// - Estonian: the language pack download is blocked in the sandbox, so this installs a STUB `et` pack
//   (right language code, parent `en`, ~60 real Estonian strings) in $CFG->dataroot/lang/et. <html lang> becomes "et".
// - ITB8833 is converted to the topics format and its section 0 is titled "House Rules" with a rich summary.
// - SUB0001: topics course with a mod_subsection (nested activities) and a label with a banner image.
// - TIL0001: the format_tiles plugin cannot be downloaded in the sandbox, so this is a plain topics course (noted in findings).
// - Enables guest login, the competency framework, a private file, a glossary and a few extra activities.
define('CLI_SCRIPT', true);
require('/var/www/html/config.php');
require_once($CFG->libdir . '/clilib.php');
require_once($CFG->dirroot . '/course/lib.php');
require_once($CFG->dirroot . '/course/modlib.php');
require_once($CFG->libdir . '/testing/generator/lib.php');
require_once($CFG->libdir . '/phpunit/classes/util.php');

\core\session\manager::set_user(get_admin());
$gen = new testing_data_generator();

// ---- Estonian stub pack ----------------------------------------------------------
$dir = $CFG->dataroot . '/lang/et';
@mkdir($dir, 0777, true);
file_put_contents("$dir/langconfig.php", <<<'PHP'
<?php
$string['decsep'] = ',';
$string['firstdayofweek'] = '1';
$string['iso6391'] = 'et';
$string['iso6392'] = 'est';
$string['labelsep'] = ': ';
$string['listsep'] = ';';
$string['locale'] = 'et_EE.UTF-8';
$string['localewin'] = 'Estonian';
$string['localecldr'] = 'et';
$string['oldcharset'] = 'windows-1257';
$string['parentlanguage'] = 'en';
$string['strftimedate'] = '%d. %B %Y';
$string['strftimedateshort'] = '%d. %B';
$string['strftimedatefullshort'] = '%d.%m.%y';
$string['strftimedatetime'] = '%d. %B %Y, %H:%M';
$string['strftimedatetimeshort'] = '%d.%m.%y, %H:%M';
$string['strftimetime'] = '%H:%M';
$string['strftimedaydate'] = '%A, %d. %B %Y';
$string['strftimedaydatetime'] = '%A, %d. %B %Y, %H:%M';
$string['strftimedayshort'] = '%A, %d. %B';
$string['strftimemonthyear'] = '%B %Y';
$string['strftimerecent'] = '%d. %b, %H:%M';
$string['strftimerecentfull'] = '%a, %d. %b %Y, %H:%M';
$string['thisdirection'] = 'ltr';
$string['thislanguage'] = 'Eesti';
$string['thislanguageint'] = 'Estonian';
$string['whitespace'] = '';
PHP);
file_put_contents("$dir/moodle.php", <<<'PHP'
<?php
$string['login'] = 'Logi sisse';
$string['logout'] = 'Logi välja';
$string['loginguest'] = 'Logi sisse külalisena';
$string['home'] = 'Avaleht';
$string['mycourses'] = 'Minu kursused';
$string['myhome'] = 'Töölaud';
$string['preferences'] = 'Eelistused';
$string['participants'] = 'Osalejad';
$string['settings'] = 'Seaded';
$string['more'] = 'Rohkem';
$string['course'] = 'Kursus';
$string['profile'] = 'Profiil';
$string['privatefiles'] = 'Privaatsed failid';
$string['language'] = 'Keel';
$string['username'] = 'Kasutajanimi';
$string['password'] = 'Parool';
$string['forgotten'] = 'Unustasid kasutajanime või parooli?';
$string['cookiesenabled'] = 'Küpsised peavad olema lubatud';
$string['loggedinnot'] = 'Sa ei ole sisse logitud';
$string['loggedinas'] = 'Sisse logitud kasutajana {$a}';
$string['grades'] = 'Hinded';
$string['edit'] = 'Muuda';
$string['editsettings'] = 'Muuda seadeid';
$string['save'] = 'Salvesta';
$string['cancel'] = 'Loobu';
$string['continue'] = 'Jätka';
$string['search'] = 'Otsi';
$string['searchcourses'] = 'Otsi kursuseid';
$string['availablecourses'] = 'Saadaval kursused';
$string['frontpagecourselist'] = 'Saadaval kursused';
$string['reports'] = 'Aruanded';
$string['badges'] = 'Märgid';
$string['calendar'] = 'Kalender';
$string['messages'] = 'Sõnumid';
$string['notifications'] = 'Teavitused';
$string['enrolme'] = 'Registreeri mind';
$string['showall'] = 'Näita kõiki';
$string['hide'] = 'Peida';
$string['show'] = 'Näita';
$string['delete'] = 'Kustuta';
$string['moveup'] = 'Liiguta üles';
$string['movedown'] = 'Liiguta alla';
$string['duplicate'] = 'Dubleeri';
$string['assignroles'] = 'Määra rollid';
$string['actions'] = 'Tegevused';
$string['topicoutline'] = 'Teemade ülevaade';
$string['expandall'] = 'Laienda kõik';
$string['collapseall'] = 'Ahenda kõik';
$string['viewprofile'] = 'Vaata profiili';
$string['usermenu'] = 'Kasutajamenüü';
$string['close'] = 'Sulge';
$string['yes'] = 'Jah';
$string['no'] = 'Ei';
$string['submit'] = 'Esita';
$string['upload'] = 'Lae üles';
$string['download'] = 'Laadi alla';
PHP);
set_config('lang', 'et');
get_string_manager()->reset_caches();
$DB->set_field('user', 'lang', 'et', ['username' => 'student']);
$DB->set_field('user', 'lang', 'et', ['username' => 'teacher']);
$DB->set_field('user', 'lang', 'et', ['username' => 'admin']);
cli_writeln('et stub installed: ' . implode(',', array_keys(get_string_manager()->get_list_of_translations(true))));

// ---- site settings --------------------------------------------------------------
set_config('autologinguests', 0);
set_config('guestloginbutton', 1);
set_config('forcelogin', 0);
set_config('enableblogs', 1);
set_config('enablecompetencies', 1);
set_config('enablebadges', 1);
set_config('enableportfolios', 1);
set_config('enablenotes', 1);
set_config('usetags', 1);
set_config('defaulthomepage', 1);

// ---- helpers ---------------------------------------------------------------------
function png_dataurl(int $r, int $g, int $b, string $text): string {
    $im = imagecreatetruecolor(960, 240);
    imagefill($im, 0, 0, imagecolorallocate($im, $r, $g, $b));
    for ($i = 0; $i < 12; $i++) {
        imagefilledellipse($im, 80 * $i + 20, 120 + (int)(60 * sin($i)), 160, 160, imagecolorallocatealpha($im, 255, 255, 255, 105));
    }
    imagestring($im, 5, 24, 24, $text, imagecolorallocate($im, 255, 255, 255));
    ob_start();
    imagepng($im);
    return 'data:image/png;base64,' . base64_encode(ob_get_clean());
}
function section_of($courseid, $num) {
    global $DB;
    return $DB->get_record('course_sections', ['course' => $courseid, 'section' => $num], '*', MUST_EXIST);
}
function set_section(int $courseid, int $num, ?string $name, ?string $summary) {
    global $DB;
    $sec = section_of($courseid, $num);
    if ($name !== null) {
        $DB->set_field('course_sections', 'name', $name, ['id' => $sec->id]);
    }
    if ($summary !== null) {
        $DB->set_field('course_sections', 'summary', $summary, ['id' => $sec->id]);
        $DB->set_field('course_sections', 'summaryformat', FORMAT_HTML, ['id' => $sec->id]);
    }
    rebuild_course_cache($courseid, true);
}
$student = $DB->get_record('user', ['username' => 'student'], '*', MUST_EXIST);
$teacher = $DB->get_record('user', ['username' => 'teacher'], '*', MUST_EXIST);
$cat = $DB->get_record('course_categories', ['name' => 'Tarkvarateaduse instituut'], '*', MUST_EXIST);

// ---- ITB8833: topics format, section 0 = "House Rules" ----------------------------
$itb = $DB->get_record('course', ['shortname' => 'ITB8833'], '*', MUST_EXIST);
if ($itb->format !== 'topics') {
    $DB->set_field('course', 'format', 'topics', ['id' => $itb->id]);
}
$rules = '<div class="summary-banner"><img src="' . png_dataurl(179, 0, 245, 'HOUSE RULES') . '" alt="House rules banner" style="max-width:100%"></div>'
    . '<h4>Please read before the first lab</h4><ul><li>Labs start at <strong>10:15</strong> sharp.</li><li>Bring your own laptop and an eID reader.</li>'
    . '<li>Plagiarism means a zero for the lab and a report to the programme director.</li></ul>'
    . '<p>Questions? Use the <a href="#">Q&amp;A forum</a> first, e-mail second.</p>';
set_section($itb->id, 0, 'House Rules', $rules);
$sec1 = section_of($itb->id, 1);
set_section($itb->id, 1, null, '<p>This week we look at <em>X-Road</em>, the data exchange layer behind Estonian e-government.</p>');
if (!$DB->record_exists('label', ['course' => $itb->id])) {
    $gen->create_module('label', ['course' => $itb->id, 'section' => 1,
        'intro' => '<p><img src="' . png_dataurl(228, 6, 126, 'X-Road') . '" alt="" style="max-width:100%"></p><p>Label with a banner image.</p>']);
}
cli_writeln('ITB8833 house rules ok');

// ---- SUB0001: mod_subsection -------------------------------------------------------
// Moodle 4.5 ships mod_subsection disabled; with the module hidden students never see the subsection or what is inside it.
if ((int)$DB->get_field('modules', 'visible', ['name' => 'subsection']) !== 1) {
    $DB->set_field('modules', 'visible', 1, ['name' => 'subsection']);
    core_plugin_manager::reset_caches();
}
$sub = $DB->get_record('course', ['shortname' => 'SUB0001']);
if (!$sub) {
    $sub = $gen->create_course(['fullname' => 'Subsection demo course (SUB0001)', 'shortname' => 'SUB0001', 'idnumber' => 'SUB0001',
        'category' => $cat->id, 'format' => 'topics', 'numsections' => 3, 'enablecompletion' => 1,
        'summary' => 'A course whose weeks contain nested subsections (mod_subsection).']);
    $gen->enrol_user($student->id, $sub->id, 'student');
    $gen->enrol_user($teacher->id, $sub->id, 'editingteacher');
    foreach ([1 => 'Getting started', 2 => 'Project work', 3 => 'Wrap-up'] as $n => $title) {
        set_section($sub->id, $n, $title, null);
    }
    $ss = $gen->create_module('subsection', ['course' => $sub->id, 'section' => 1, 'name' => 'Pre-reading pack']);
    $dsid = $DB->get_field('course_sections', 'id', ['component' => 'mod_subsection', 'itemid' => $ss->id]);
    if ($dsid) {
        $gen->create_module('page', ['course' => $sub->id, 'section' => (int)$DB->get_field('course_sections', 'section', ['id' => $dsid]),
            'name' => 'Nested page: orientation', 'content' => '<p>Inside a subsection.</p>']);
        $gen->create_module('url', ['course' => $sub->id, 'section' => (int)$DB->get_field('course_sections', 'section', ['id' => $dsid]),
            'name' => 'Nested link: handbook', 'externalurl' => 'https://example.com/handbook']);
    }
    $gen->create_module('assign', ['course' => $sub->id, 'section' => 2, 'name' => 'Project milestone 1', 'duedate' => time() + 5 * 86400]);
    $gen->create_module('forum', ['course' => $sub->id, 'section' => 0, 'name' => 'Announcements', 'type' => 'news']);
    rebuild_course_cache($sub->id, true);
}
cli_writeln('SUB0001 ok');

// ---- TIL0001: stand-in for the tiles course ----------------------------------------
$til = $DB->get_record('course', ['shortname' => 'TIL0001']);
if (!$til) {
    $format = is_dir($CFG->dirroot . '/course/format/tiles') ? 'tiles' : 'topics';
    $til = $gen->create_course(['fullname' => "Tiles demo course (TIL0001, $format)", 'shortname' => 'TIL0001', 'idnumber' => 'TIL0001',
        'category' => $cat->id, 'format' => $format, 'numsections' => 6]);
    $gen->enrol_user($student->id, $til->id, 'student');
    foreach (['Introduction', 'Models', 'Methods', 'Practice', 'Review', 'Exam'] as $i => $t) {
        set_section($til->id, $i + 1, $t, '<p>' . $t . ' summary.</p>');
        $gen->create_module('page', ['course' => $til->id, 'section' => $i + 1, 'name' => "$t notes", 'content' => '<p>x</p>']);
    }
}
cli_writeln('TIL0001 ok (' . $til->format . ')');

// ---- extra activities in ITI8801 (course 2) ----------------------------------------
$c2 = $DB->get_record('course', ['shortname' => 'ITI8801'], '*', MUST_EXIST);
foreach ([['glossary', 'Terms glossary'], ['wiki', 'Team wiki'], ['feedback', 'Course feedback']] as [$mod, $name]) {
    if (!$DB->record_exists($mod, ['course' => $c2->id, 'name' => $name])) {
        $gen->create_module($mod, ['course' => $c2->id, 'section' => 1, 'name' => $name]);
    }
}
// Course visible to guests (self enrolment enabled) so the logged-out front page lists courses.
$guestcourse = $DB->get_record('course', ['shortname' => 'EMT0140'], '*', MUST_EXIST);
$DB->set_field('enrol', 'status', 0, ['courseid' => $guestcourse->id, 'enrol' => 'guest']);
$DB->set_field('enrol', 'status', 0, ['courseid' => $guestcourse->id, 'enrol' => 'self']);

// ---- competency framework -----------------------------------------------------------
if (!$DB->record_exists('competency_framework', ['shortname' => 'ICT'])) {
    $cgen = $gen->get_plugin_generator('core_competency');
    $fw = $cgen->create_framework(['shortname' => 'ICT', 'idnumber' => 'ICT', 'visible' => 1]);
    $comp = $cgen->create_competency(['competencyframeworkid' => $fw->get('id'), 'shortname' => 'Cloud basics', 'idnumber' => 'CLOUD1']);
    \core_competency\api::add_competency_to_course($c2->id, $comp->get('id'));
    cli_writeln('competency framework created');
}

// ---- private file ----------------------------------------------------------------
$fs = get_file_storage();
$uctx = context_user::instance($student->id);
if (!$fs->file_exists($uctx->id, 'user', 'private', 0, '/', 'notes.txt')) {
    $fs->create_file_from_string(['contextid' => $uctx->id, 'component' => 'user', 'filearea' => 'private', 'itemid' => 0,
        'filepath' => '/', 'filename' => 'notes.txt', 'userid' => $student->id], "Private notes\n");
}
purge_all_caches();
cli_writeln('lab45 seed done');
