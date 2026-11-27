"""The kinds of documents a scholarship can ask for. Each scholarship chooses its own subset."""

DOCUMENT_TYPES = {
    'valid_id': 'Valid government-issued ID or School ID',
    'residency': 'Certificate of Residency',
    'indigency': 'Certificate of Indigency',
    'enrollment': 'Certificate of Enrollment or Registration Form',
    'grades': 'Latest Report Card or Transcript of Records',
    'income_proof': 'Proof of Income or Parent/Guardian Income Certificate',
    'birth_certificate': 'Birth Certificate',
    'id_picture': 'Recent 2x2 ID Picture',
    'other': 'Other Supporting Documents',
}


# A short, plain explanation shown under each document while a young person applies, so nobody has to guess what to upload.
DOCUMENT_HELP = {
    'valid_id': "Any government-issued ID (for example a UMID, driver's license, passport, PhilSys ID or voter's ID) or your current school ID. Your name and photo must be readable.",
    'residency': 'A certificate from your barangay saying that you live there. You can ask for it at the barangay hall.',
    'indigency': 'A certificate from your barangay saying that your family has a low income. You can ask for it at the barangay hall.',
    'enrollment': 'A certificate of enrollment or your registration form from your school for the current term. It shows that you are officially enrolled.',
    'grades': 'High school or senior high: your latest Report Card. College or graduate: your Transcript of Records (TOR). If your term is not finished yet, your latest certificate of grades from the school registrar.',
    'income_proof': "Anything that shows your family's income, such as a parent's or guardian's payslip, ITR or certificate of employment, or an income certificate from your barangay.",
    'birth_certificate': 'A copy of your birth certificate. A PSA copy is best, or a certified true copy from the local civil registrar.',
    'id_picture': 'A recent passport-style photo, 2 x 2 inches, with your face clearly visible and a plain background.',
    'other': 'Anything else that supports your application, such as a recommendation letter or a certificate. Only upload what the scholarship asks for.',
}


# The kinds of ID a young person may submit as their valid ID. None of them is required in particular: any of these is accepted.
ID_TYPES = {
    'philsys': 'Philippine National ID / PhilSys ID',
    'passport': 'Passport',
    'drivers_license': "Driver's License",
    'umid': 'UMID',
    'postal': 'Postal ID',
    'voters': "Voter's Certification",
    'school_id': 'School ID',
    'other_gov': 'Other Government-Issued ID',
}

# What LYDO decides about one submitted document
DOC_REVIEW = {'pending': 'Waiting for review', 'verified': 'Verified', 'needs_revision': 'Needs revision', 'invalid': 'Invalid'}
