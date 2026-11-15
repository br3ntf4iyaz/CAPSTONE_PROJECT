"""Seed the School Finder with the 22 institutions requested by LYDO.

ACCURACY RULE
-------------
* A program is stored as VERIFIED only when it was read from an official page of the
  school (or the school's own campus page) - the exact URL is saved as its source.
* Anything that came only from news items, directories or search snippets is stored as
  PENDING (hidden from the Youth Portal) so an admin can confirm it.
* Schools with no confirmed programs stay in the list and show
  "Course information currently unavailable - verification required."

Idempotent: safe to run repeatedly. Re-running keeps admin-made edits to schools
but refreshes the verified lists below.
"""
import re

from django.core.management.base import BaseCommand
from django.utils import timezone
from django.utils.text import slugify

from apps.schools.models import Program, School, SchoolProgram

DASH = "–"

# ---------------------------------------------------------------------------
# 1. Schools
# (canonical name, [old names to rename], type, address, description, source_url, note)
# ---------------------------------------------------------------------------
SCHOOLS = [
    (f"Southern Luzon State University (SLSU) {DASH} Lucena Campus", ["Southern Luzon State University - Lucena Campus"],
     "state_university", "Lucena City, Quezon",
     "State university campus in Lucena City, part of the Southern Luzon State University system.",
     "https://slsu.edu.ph",
     "The official SLSU site could not be opened during research. A 2022 news item (thepost.net.ph) mentions Lucena-campus programs "
     "(Midwifery, Radiologic Technology, Elementary Education, Culture and Arts Education, Home Economics, Environmental Science, "
     "Hospitality Management, Psychology) but is not an official or current list. Confirm with SLSU / CHED."),
    (f"Dalubhasaan ng Lungsod ng Lucena (DLL)", ["Dalubhasaan ng Lungsod ng Lucena"],
     "public", "Isabang, Lucena City, Quezon",
     "Local (city) college of the Lucena City government.",
     "",
     "No official or CHED program list could be found. Unofficial sources mention BS Public Administration and BS Entrepreneurship; "
     "none is confirmed. Confirm with DLL / CHED Region IV-A."),
    ("Manuel S. Enverga University Foundation (MSEUF)", [], "private", "Lucena City, Quezon",
     "Private non-sectarian university with its main campus in Lucena City.",
     "https://mseuf.edu.ph/programs/lucena", ""),
    ("Sacred Heart College (SHC)", ["Sacred Heart College"], "private", "Lucena City, Quezon",
     "Private Catholic school in Lucena City with basic education and higher education divisions.",
     "https://shc.edu.ph", ""),
    ("Maryhill College", [], "private", "Lucena City, Quezon",
     "Private school in Lucena City.",
     "https://maryhillcollege.edu.ph",
     "The official website showed only a maintenance notice during research. Confirm programs by phone (042) 373 0165 or "
     "maryhill@maryhillcollege.edu.ph."),
    ("St. Anne College Lucena, Inc. (SACLI)", ["St. Anne College Lucena"], "private", "Diversion Road, Brgy. Gulang-Gulang, Lucena City",
     "Private college in Lucena City that started with paramedical programs.",
     "https://tesda.gov.ph/Tvi/sch?sch=1946",
     "No official degree-program list found. TESDA lists Caregiving NC II (added below as pending)."),
    ("Calayan Educational Foundation, Inc. (CEFI)", [], "private", "Maharlika Highway, Ibabang Dupay, Red-V, Lucena City",
     "Private school in Lucena City with health, business, education and technical-vocational programs.",
     "https://cefi.edu.ph/programs/", ""),
    ("STI College Lucena", [], "private", "STI Academic Center, Quezon Avenue corner Perez Street, Lucena City",
     "STI campus in Lucena City offering tertiary and senior high programs.",
     "https://www.sti.edu/campuses/lucena", ""),
    (f"ABE International Business College {DASH} Lucena", ["ABE International College of Business and Economics"], "private",
     "Rockwell Bldg., Quezon Ave., Brgy. IX, Lucena City",
     "Private college campus in Lucena City.",
     "https://abe.edu.ph",
     "No official Lucena program list found (directories mostly describe other ABE campuses). Confirm with the campus."),
    (f"AMA Computer College {DASH} Lucena Campus", ["AMA Computer College - Lucena"], "private",
     "Tantuco Bldg., 160 ML Tagarao St., Brgy. Iyam, Lucena City",
     "Computer-focused college campus in Lucena City.",
     "https://ama.edu.ph",
     "AMA's website does not show programs per campus. Confirm Lucena offerings with the campus at (042) 373-7130."),
    ("QCRS College, Inc. (Quezon Center for Research and Studies)", [], "private", "Lucena City, Quezon",
     "Private college in Lucena City.",
     "https://www.qcrs.edu.ph",
     "No program list found in reliable sources. Check the school website or contact the school."),
    ("Inter-Global College Foundation, Inc.", [], "private", "Bocohan, Lucena City",
     "Private college in Lucena City.",
     "",
     "Only a third-party directory lists TESDA courses (Cookery NC II, Housekeeping NC II, Food and Beverage Services NC II). Not confirmed."),
    ("Digitech College", [], "private", "Lucena City, Quezon",
     "Private college in Lucena City.",
     "",
     "No reliable record found under this exact name. A similarly named school, Digital Communication and Technological College Inc. "
     "(Ibabang Dupay), is TESDA-registered. Confirm the correct institution before adding programs."),
    # Tech-voc
    ("BWEST College (Boater's Wheel Educational System and Technology College)", [], "technical_vocational",
     "Gomez Extension, Brgy. 1, Lucena City",
     "Technical-vocational school in Lucena City.",
     "https://tesda.gov.ph/Tvi/sch?sch=1985",
     "TESDA registry (read through search results, not opened directly) shows Cookery NC II, Bread and Pastry Production NC II and Housekeeping NC II. Confirm."),
    ("St. Michael TVET Training and Assessment Center Inc.", [], "technical_vocational",
     "3rd Floor Pagkatipunan Bldg., Profugo cor. Merchan Sts., Brgy. 6, Lucena City",
     "TESDA training and assessment center in Lucena City.",
     "",
     "Only a third-party directory lists its courses and it does not show TESDA accreditation. Confirm with TESDA Quezon."),
    ("Profes-Skills Institute Training and Assessment Center, Inc.", [], "technical_vocational",
     "2nd Floor Serv 2, 0067 M.L. Tagarao St., Brgy. 3, Lucena City",
     "TESDA training and assessment center in Lucena City.",
     "",
     "Courses below come from the TESDA registry as reported by search results; the page could not be opened directly. Confirm."),
    ("St. Gabriel College of Technology and Assessment Center Inc.", [], "technical_vocational", "Lucena City, Quezon",
     "Technical-vocational training and assessment center.",
     "",
     "No record of this institution in Lucena was found in TESDA or other searches. Verify that the name and location are correct."),
    ("Technological College of Quezon Inc. (UCC)", [], "technical_vocational", "Lucena City, Quezon",
     "Technical-vocational college.",
     "",
     "No record found under this name. Possibly related to United Computer College (Lucena). Verify the correct institution."),
    ("Lucena Technological Institute Incorporated", [], "technical_vocational", "Lucena City, Quezon",
     "Technical-vocational institute.",
     "",
     "No TESDA or other record found under this name. Verify."),
    ("Hyong Yang Institute of Technology Inc.", [], "technical_vocational", "Lucena City, Quezon",
     "Technical-vocational institute.",
     "",
     "No record found under this name. Verify."),
    ("Ark Technological Institute Education System, Inc.", [], "technical_vocational", "170 Claro M. Recto St., Brgy. 9, Lucena City",
     "TESDA-registered technological institute in Lucena City.",
     "https://tesda.gov.ph/tvi/sch?sch=3517",
     "TESDA lists the institution (phone (042) 717-6510) but the course list could not be read. Confirm with TESDA."),
]

# ---------------------------------------------------------------------------
# 2. Verified programs (read from the school's own official pages)
# ---------------------------------------------------------------------------
MSEUF_SRC = "https://mseuf.edu.ph/programs/lucena/"
MSEUF = [  # (official name, url slug)
    ("Bachelor of Science in Computer Science with specialization in Data Science", "bscs-da"),
    ("Bachelor of Science in Computer Science with specialization in Software Engineering", "bscs-se"),
    ("Bachelor of Science in Information Technology with specialization in Web & Mobile Application", "bsit-wma"),
    ("Bachelor of Science in Information Technology with specialization in CISCO Networking", "bsit-cn"),
    ("Bachelor of Science in Entertainment & Multimedia Computing with specialization in Game Development", "bsemc-gd"),
    ("Bachelor of Science in Entertainment & Multimedia Computing with specialization in Digital Animation Technology", "bsemc-dat"),
    ("Bachelor of Science in Marine Engineering", "bsmare"),
    ("Bachelor of Science in Marine Transportation", "bsmt"),
    ("Bachelor of Science in Tourism Management", "bstm"),
    ("Bachelor of Science in Hospitality Management", "bshm"),
    ("Bachelor of Science in Hospitality Management with specialization in Cruise Management", "bshm-clo"),
    ("Bachelor of Science in Hospitality Management with specialization in Culinary Arts", "bshm-ca"),
    ("Bachelor of Fine Arts with specialization in Visual Communication", "bfa-vc"),
    ("Bachelor of Science in Nursing", "bsn"),
    ("Bachelor of Science in Medical Technology", "bsmedt"),
    ("Bachelor of Science in Civil Engineering", "bsce"),
    ("Bachelor of Science in Computer Engineering", "bscpe"),
    ("Bachelor of Science in Electrical Engineering", "bsee"),
    ("Bachelor of Science in Geodetic Engineering", "bsge"),
    ("Bachelor of Science in Industrial Engineering", "bsie"),
    ("Bachelor of Science in Electronics Engineering", "bsece"),
    ("Bachelor of Science in Mechanical Engineering", "bsme"),
    ("Bachelor of Science in Architecture", "bsarch"),
    ("Bachelor of Science in Accountancy", "bsa"),
    ("Bachelor of Science in Management Accounting", "bsma"),
    ("Bachelor of Science in Office Administration", "bsoa"),
    ("Bachelor of Science in Business Administration major in Marketing Management", "bsba-mm"),
    ("Bachelor of Science in Business Administration major in Human Resource Management", "bsba-hrm"),
    ("Bachelor of Science in Business Administration major in Financial Management", "bsba-fm"),
    ("Bachelor of Science in Business Administration major in Operations Management", "bsba-om"),
    ("Bachelor of Arts in Communication", "abcomm"),
    ("Bachelor of Science in Psychology", "bspsych"),
    ("Bachelor of Arts in Political Science", "abpl"),
    ("Bachelor of Science in Public Administration", "bspa"),
    ("Bachelor of Science in Environmental Science", "bses"),
    ("Bachelor of Arts in English Language", "abel"),
    ("Bachelor of Science in Economics", "bsecon"),
    ("Bachelor of Science in Biology", "bsbio"),
    ("Bachelor of Science in Criminology", "bscrim"),
    ("Bachelor of Elementary Education", "beed"),
    ("Bachelor of Secondary Education major in English", "bsed-en"),
    ("Bachelor of Secondary Education major in Filipino", "bsed-fil"),
    ("Bachelor of Secondary Education major in Mathematics", "bsed-math"),
    ("Bachelor of Secondary Education major in Science", "bsed-sci"),
    ("Bachelor of Secondary Education major in Social Studies", "bsed-soc"),
    ("Bachelor of Culture and Arts Education", "bcaed"),
    ("Bachelor of Physical Education", "bped"),
    ("Bachelor of Library and Information Science", "blis"),
    ("Juris Doctor (Enverga Law School)", "jd"),
    ("Doctor of Education major in Educational Management", "edd-em"),
    ("Doctor of Management", "dm"),
    ("Master of Arts in Education major in Educational Management", "maed-em"),
    ("Master of Arts in Education major in Guidance and Counseling", "maed-gc"),
    ("Master of Arts in Education major in English", "maed-eng"),
    ("Master of Arts in Education major in Filipino", "maed-fil"),
    ("Master of Arts in Education major in Mathematics", "maed-math"),
    ("Master of Arts in Education major in Cultural Education", "maed-ce"),
    ("Master of Arts in English", "maeng"),
    ("Master in Business Administration (Thesis)", "mba"),
    ("Master in Business Administration (Non-Thesis)", "mba-non-thesis"),
    ("Master in Public Administration (Thesis Program)", "mpa"),
    ("Master in Public Administration (Non-Thesis)", "mpa-non-thesis"),
    ("Master of Arts in Physical Education", "mape"),
    ("Master in Management (Non-Thesis Program) major in Engineering Management Non Thesis", "mm-em"),
    ("Master in Management major in Human Resource Management Non Thesis", "mm-hrm"),
    ("Master in Management major in Applied Marketing Non Thesis", "mm-am"),
    ("Master in Management major in Hospitality Management Non Thesis", "mm-hm"),
    ("Master in Information Technology with specialization in Systems Development", "mit"),
    ("Master of Science in Criminal Justice with specialization in Criminology", "msc"),
    ("Master of Arts in Science Education", "mase"),
    ("Master in Library Information Science (Thesis)", "mlis"),
    # ETEEAP (Expanded Tertiary Education Equivalency and Accreditation Program), also listed on the Lucena page
    ("Bachelor in Secondary Education (ETEEAP) major in Filipino", "bsed-fil-eteeap"),
    ("Bachelor in Secondary Education (ETEEAP) major in English", "bsed-e-eteeap"),
    ("Bachelor of Library and Information Science (ETEEAP)", "blis-eteeap"),
    ("Bachelor of Science in Business Administration (ETEEAP) major in Human Resource Management", "bsba-hrm-eteeap"),
    ("Bachelor of Science in Business Administration (ETEEAP) major in Financial Management", "bsba-fm-eteeap"),
    ("Bachelor of Science in Business Administration (ETEEAP) major in Marketing Management", "bsba-mm-eteeap"),
    ("Bachelor of Science in Business Administration (ETEEAP) major in Operations Management", "bsba-om-eteeap"),
    ("Bachelor of Science in Environmental Science (ETEEAP)", "bses-eteeap"),
    ("Bachelor of Science in Public Administration (ETEEAP)", "bspa-eteeap"),
    ("Bachelor of Arts in Psychology (ETEEAP)", "abpsych-eteeap"),
    ("Bachelor of Arts in Communication (ETEEAP)", "abcomm-eteeap"),
    ("Bachelor of Science in Office Administration (ETEEAP)", "bsoa-eteeap"),
    ("Bachelor of Science in Mechanical Engineering (ETEEAP)", "bsme-eteeap"),
    ("Bachelor of Science in Electrical Engineering (ETEEAP)", "bsee-eteeap"),
    ("Bachelor of Science in Electronics Engineering (ETEEAP)", "bsece-eteeap"),
    ("Bachelor of Science in Industrial Engineering (ETEEAP)", "bsie-eteeap"),
    ("Bachelor of Science in Geodetic Engineering (ETEEAP)", "bsge-eteeap"),
    ("Bachelor of Science in Computer Engineering (ETEEAP)", "bscpe-eteeap"),
    ("Bachelor of Science in Civil Engineering (ETEEAP)", "bsce-eteeap"),
    ("Bachelor of Science in Criminology (ETEEAP)", "bscrim-eteeap"),
    ("Bachelor of Science in Hospitality Management (ETEEAP)", "bshm-eteeap"),
    ("Bachelor of Science in Information Technology (ETEEAP)", "bsit-eteeap"),
]

SHC = [  # (name, url)
    ("Bachelor of Science in Business Administration", "https://shc.edu.ph/bachelor-of-science-in-business-administration"),
    ("Bachelor of Science in Education", "https://shc.edu.ph/courses/bachelor-of-science-in-education/"),
    ("Bachelor of Science in Social Work", "https://shc.edu.ph/bachelor-of-science-in-social-work"),
    ("Bachelor of Science in Computer Science", "https://shc.edu.ph/courses/bachelor-of-science-in-computer-science/"),
    ("Bachelor of Science in Pharmacy", "https://shc.edu.ph/bachelor-of-science-in-pharmacy"),
    ("Bachelor of Science in Nursing", "https://shc.edu.ph/bachelor-of-science-in-nursing"),
    ("Bachelor of Science in Psychology", "https://shc.edu.ph/bachelor-of-science-in-psychology/"),
    ("Bachelor of Arts in Communication", "https://shc.edu.ph/bachelor-of-arts-in-communication/"),
    ("Bachelor of Science in Management Accounting", "https://shc.edu.ph/bachelor-of-science-in-management-accounting"),
    ("Master of Arts in Education", "https://shc.edu.ph/courses/master-of-arts-in-education/"),
    ("Master of Science in Nursing", "https://shc.edu.ph/courses/master-of-science-in-nursing/"),
]

CEFI_SRC = "https://cefi.edu.ph/programs/"
CEFI = [  # (name, url)
    ("Bachelor of Science in Nursing", "https://cefi.edu.ph/college-of-nursing/"),
    ("Bachelor of Science in Midwifery", "https://cefi.edu.ph/college-of-midwifery/"),
    ("Bachelor of Science in Medical Technology", "https://cefi.edu.ph/college-of-medical-technology/"),
    ("Bachelor of Science in Radiologic Technology", "https://cefi.edu.ph/college-of-radiologic-technology/"),
    ("Bachelor of Science in Physical Therapy", "https://cefi.edu.ph/college-of-physical-therapy/"),
    ("Bachelor of Science in Psychology", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Arts in Economics", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Arts in Communication", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Science in Hospitality Management", "https://cefi.edu.ph/college-of-htm/"),
    ("Bachelor of Science in Tourism Management", "https://cefi.edu.ph/college-of-htm/"),
    ("Bachelor of Science in Accountancy", "https://cefi.edu.ph/college-of-bsaa/"),
    ("Bachelor of Science in Management Accounting", "https://cefi.edu.ph/college-of-bsaa/"),
    ("Bachelor of Science in Business Administration major in Financial Management", "https://cefi.edu.ph/college-of-bsaa/"),
    ("Bachelor of Science in Business Administration major in Marketing Management", "https://cefi.edu.ph/college-of-bsaa/"),
    ("Bachelor of Science in Business Administration major in Human Resource Management", "https://cefi.edu.ph/college-of-bsaa/"),
    ("Bachelor of Science in Criminology", "https://cefi.edu.ph/college-of-criminology/"),
    ("Bachelor of Science in Information System", "https://cefi.edu.ph/college-of-information-system/"),
    ("Bachelor of Secondary Education major in Science", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Secondary Education major in English", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Secondary Education major in Mathematics", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Elementary Education", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Bachelor of Culture and Arts Education", "https://cefi.edu.ph/college-of-arts-and-sciences/"),
    ("Master in Public Health", CEFI_SRC),
    ("Master of Science in Nursing", CEFI_SRC),
    ("Bachelor of Arts in Economics (ETEEAP)", CEFI_SRC),
    ("Caregiving NC II", "https://cefi.edu.ph/?p=2478"),
    ("Health Care Services NC II", "https://cefi.edu.ph/?p=2478"),
    ("Medical Transcription NC II", "https://cefi.edu.ph/?p=2478"),
    ("Food and Beverage Services NC II", "https://cefi.edu.ph/?p=2478"),
    ("Cookery NC II", "https://cefi.edu.ph/?p=2478"),
]

STI_SRC = "https://www.sti.edu/campuses/lucena"
STI = [
    "Bachelor of Science in Computer Science",
    "Bachelor of Science in Information Technology",
    "Bachelor of Science in Information Systems",
    "Bachelor of Science in Computer Engineering",
    "Bachelor of Science in Business Administration",
    "Bachelor of Science in Accounting Information System",
    "Bachelor of Science in Accountancy",
    "Bachelor of Science in Culinary Management",
    "Bachelor of Multimedia Arts",
    "Bachelor of Science in Tourism Management",
    "Data Collection and Annotation - Data Science-Artificial Intelligence (Level II)",
    "AI Prompting and Automation (Level III)",
]

# Leads kept as PENDING (not shown to the public) - (school name, program, url, note)
PENDING = [
    ("St. Anne College Lucena, Inc. (SACLI)", "Caregiving NC II", "https://tesda.gov.ph/Tvi/sch?sch=1946",
     "Listed on TESDA TVI page; page table could not be opened directly."),
    ("BWEST College (Boater's Wheel Educational System and Technology College)", "Cookery NC II", "https://tesda.gov.ph/Tvi/sch?sch=1985",
     "TESDA registry via search result."),
    ("BWEST College (Boater's Wheel Educational System and Technology College)", "Bread and Pastry Production NC II", "https://tesda.gov.ph/Tvi/sch?sch=1985",
     "TESDA registry via search result."),
    ("BWEST College (Boater's Wheel Educational System and Technology College)", "Housekeeping NC II", "https://tesda.gov.ph/Tvi/sch?sch=1985",
     "TESDA registry via search result; DepEd Quezon also reports BWEST Housekeeping scholarships."),
    ("Profes-Skills Institute Training and Assessment Center, Inc.", "Hilot (Wellness Massage) NC II", "https://tesda.gov.ph/Tvi/Result?page=409",
     "TESDA registry via search result."),
    ("Profes-Skills Institute Training and Assessment Center, Inc.", "Events Management Services NC III", "https://tesda.gov.ph/Tvi/Result?page=409",
     "TESDA registry via search result."),
    ("Profes-Skills Institute Training and Assessment Center, Inc.", "Events Hosting Level II", "https://tesda.gov.ph/Tvi/Result?page=409",
     "TESDA registry via search result."),
    ("St. Michael TVET Training and Assessment Center Inc.", "Food and Beverage Services NC II", "https://tesdatrainingcourses.com/st-michael-tvet-training-and-assessment-center.html",
     "Third-party directory only."),
    ("St. Michael TVET Training and Assessment Center Inc.", "Electronics Products Assembly and Servicing NC II", "https://tesdatrainingcourses.com/st-michael-tvet-training-and-assessment-center.html",
     "Third-party directory only."),
]

# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------

def program_type(name: str) -> str:
    n = name.lower()
    if re.search(r"\bnc (i|ii|iii|iv)\b|level (i|ii|iii|iv)\b", n):
        return "tesda"
    if n.startswith("juris doctor"):
        return "law"
    if n.startswith("doctor"):
        return "doctorate"
    if n.startswith("master"):
        return "graduate"
    if n.startswith("bachelor"):
        return "bachelor"
    return "certificate"


def field_of_study(name: str) -> str:
    n = name.lower()
    if re.search(r"\bnc (i|ii|iii|iv)\b|level (i|ii|iii|iv)\b", n):
        return "techvoc"
    if n.startswith("juris"):
        return "law"
    if "marine" in n:
        return "maritime"
    if "criminolog" in n or "criminal justice" in n:
        return "criminal_justice"
    if "accounting information" in n:
        return "business"
    if "library" in n:
        return "arts_sciences"
    if "engineering" in n and not n.startswith("master in management"):
        return "engineering"
    if "architecture" in n:
        return "engineering"
    if n.startswith("master in management"):
        return "business"
    if any(k in n for k in ("hospitality", "tourism", "culinary")):
        return "hospitality"
    if any(k in n for k in ("nursing", "midwifery", "medical technology", "radiologic", "physical therapy", "pharmacy", "public health")):
        return "health"
    if "education" in n:
        return "education"
    if any(k in n for k in ("computer science", "information technology", "information system", "multimedia computing")):
        return "it_computing"
    if any(k in n for k in ("accountan", "accounting", "business", "management", "office administration", "public administration", "entrepreneur")):
        return "business"
    if any(k in n for k in ("psychology", "communication", "english", "political", "environmental", "biology", "economics", "social work", "fine arts", "multimedia arts")):
        return "arts_sciences"
    return "other"


TYPE_LABEL = {
    "bachelor": "Bachelor's degree program",
    "graduate": "Graduate (master's) program",
    "doctorate": "Doctoral program",
    "law": "Law degree program",
    "tesda": "TESDA qualification",
    "certificate": "Certificate program",
}


def get_program(name: str, code: str = ""):
    ptype = program_type(name)
    prog = Program.objects.filter(name=name).first()
    if prog is None:
        prog = Program(name=name)
    prog.program_type = ptype
    prog.field_of_study = field_of_study(name)
    if not prog.description:
        prog.description = f"{TYPE_LABEL.get(ptype, 'Program')}: {name}."
    if code and not prog.code:
        prog.code = code
    prog.save()
    return prog


def link(school, name, url, status, note="", code=""):
    prog = get_program(name, code)
    sp, _ = SchoolProgram.objects.get_or_create(school=school, program=prog)
    sp.is_active = True
    sp.source_url = url
    sp.verification_status = status
    sp.verified_at = timezone.now() if status == "verified" else None
    if note:
        sp.notes = note
    sp.save()


class Command(BaseCommand):
    help = "Seed the 22 requested schools and their VERIFIED programs (idempotent)."

    def handle(self, *args, **opts):
        keep = []
        by_name = {}
        for name, olds, stype, addr, desc, src, note in SCHOOLS:
            school = School.objects.filter(name=name).first()
            if school is None:
                for old in olds:
                    school = School.objects.filter(name=old).first()
                    if school:
                        school.name = name
                        school.slug = slugify(name)[:250]
                        break
            if school is None:
                school = School(name=name)
            school.school_type = stype
            school.address = addr
            school.municipality = "Lucena City"
            school.province = "Quezon"
            school.region = "Region IV-A (CALABARZON)"
            school.description = desc
            school.source_url = src
            school.verification_note = note
            school.is_active = True
            if not school.slug:
                school.slug = slugify(name)[:250]
            school.save()
            keep.append(school.pk)
            by_name[name] = school

        # Schools that are not part of the requested 22 are hidden (kept in the database)
        hidden = School.objects.exclude(pk__in=keep).filter(is_active=True).update(is_active=False)

        mseuf = by_name["Manuel S. Enverga University Foundation (MSEUF)"]
        for name, slug in MSEUF:
            link(mseuf, name, MSEUF_SRC + slug, "verified", code=slug)
        shc = by_name["Sacred Heart College (SHC)"]
        for name, url in SHC:
            link(shc, name, url, "verified")
        cefi = by_name["Calayan Educational Foundation, Inc. (CEFI)"]
        for name, url in CEFI:
            link(cefi, name, url, "verified")
        sti = by_name["STI College Lucena"]
        for name in STI:
            link(sti, name, STI_SRC, "verified")

        for school_name, prog, url, note in PENDING:
            link(by_name[school_name], prog, url, "pending", note)

        # remove legacy placeholder programs (old sample data) and any program nobody offers
        SchoolProgram.objects.filter(program__program_type__in=['undergraduate', 'vocational', 'short_course']).delete()
        Program.objects.filter(school_programs__isnull=True).delete()

        total_ver = SchoolProgram.objects.filter(verification_status="verified").count()
        total_pen = SchoolProgram.objects.filter(verification_status="pending").count()
        self.stdout.write(self.style.SUCCESS(
            f"{len(keep)} schools; verified program links: {total_ver}; pending: {total_pen}; other schools hidden: {hidden}"
        ))
