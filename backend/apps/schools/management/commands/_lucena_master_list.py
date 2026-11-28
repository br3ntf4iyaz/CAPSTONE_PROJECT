"""The LYDO master list of schools in Lucena City: the level(s) each teaches and the categories it is listed under.

Levels:  college, shs (Senior High School), tvet (TESDA / post-secondary technical-vocational training)
Tags:    tvl (Tech-Voc: the Technical-Vocational-Livelihood track of Senior High), tesda (a TESDA training provider)
The kind (public / private / suc) decides the Public, Private and State University filters.

This is the project list given by LYDO. It is used to set levels and categories and to add schools that are missing. It is NOT proof: the
categories of a school are marked as coming from the LYDO list until they are checked against DepEd and TESDA records. A school with no
address in the list gets none. Items cut off at the end of the list (a 41st entry with no details) are not added.

(name, phrases that find an existing record, kind, address or None, levels, tags)
"""
DASH = '–'

MASTER = [
    ('Dalubhasaan ng Lungsod ng Lucena (DLL)', ['Dalubhasaan'], 'public', 'City Hall Annex Bldg., Brgy. Isabang, Lucena City', {'college', 'tvet'}, {'tesda'}),
    ('Quezon National High School (QNHS)', ['Quezon National High School'], 'public', None, {'shs'}, {'tvl'}),
    ('Lucena City National High School (LCNHS)', ['Lucena City National High School'], 'public', None, {'shs'}, {'tvl'}),
    ('Gulang-Gulang National High School', ['Gulang-gulang National High School'], 'public', None, {'shs'}, {'tvl'}),
    ('Lucena Dalahican National High School', ['Lucena Dalahican National High School', 'Dalahican National High School'], 'public', None, {'shs'}, {'tvl'}),
    ('Cotta National High School', ['Cotta National High School'], 'public', None, {'shs'}, {'tvl'}),
    ('Ibabang Talim Integrated High School', ['Ibabang Talim Integrated High School'], 'public', None, {'shs'}, {'tvl'}),
    ('Mayao Parada Agricultural Integrated School', ['Mayao Parada'], 'public', 'Brgy. Mayao Parada, Lucena City', {'shs'}, {'tvl'}),
    ('Ransohan Integrated High School', ['Ransohan'], 'public', None, {'shs'}, set()),

    ('Manuel S. Enverga University Foundation (MSEUF)', ['Enverga'], 'private', None, {'shs', 'college'}, {'tvl'}),
    ('Sacred Heart College of Lucena City, Inc.', ['Sacred Heart College'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('Maryhill College, Inc.', ['Maryhill'], 'private', None, {'shs', 'college'}, {'tvl'}),
    ('Calayan Educational Foundation, Inc. (CEFI)', ['Calayan', 'CEFI'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('St. Anne College Lucena, Inc. (SACLI)', ['St. Anne College', 'Saint Anne College'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('College of Sciences, Technology and Communications, Inc. (CSTC)', ['CSTC', 'College of Sciences, Technology and Communications'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('STI College Lucena', ['STI College', 'STI Education'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('AMA Computer College ' + DASH + ' Lucena City', ['AMA Computer College'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('ABE International Business College ' + DASH + ' Quezon Province, Inc.', ['ABE International'], 'private', 'Quezon Ave., Brgy. 5, Lucena City', {'shs', 'college'}, {'tvl'}),
    ('Inter-Global College Foundation, Inc.', ['Inter-Global'], 'private', None, {'shs', 'college'}, {'tvl'}),
    ('Digitech College (Digital Communication and Technological College, Inc.)', ['Digitech', 'Digital Communication and Technological'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ("Boater's Wheel Educational System and Technology (BWEST) College", ['Boater', 'BWEST'], 'private', None, {'shs', 'college', 'tvet'}, {'tvl', 'tesda'}),
    ('QCRS College, Inc. (Quezon Center for Research and Studies)', ['QCRS'], 'private', 'Allarey St. cor. Magallanes St., Brgy. 4, Lucena City', {'shs', 'college'}, {'tvl'}),
    ('Alpha Centauri Educational System (ACES), Inc.', ['Alpha Centauri'], 'private', 'Diversion Rd., Brgy. Ilayang Dupay, Lucena City', {'shs', 'college'}, {'tvl'}),
    ('St. Alphonsus Regional Seminary / School of Theology', ['Alphonsus'], 'private', 'Brgy. Isabang, Lucena City', {'college'}, set()),

    ('Philippine Tong Ho Institute', ['Tong Ho'], 'private', '71 Merchan St., Brgy. 9, Lucena City', {'shs'}, set()),
    ('International School for Better Beginnings (ISBB)', ['International School for Better Beginnings'], 'private', None, {'shs'}, set()),
    ('Christ the Lord Institute Foundation Lucena City, Inc.', ['Christ the Lord Institute'], 'private', 'Maharlika Hwy, Brgy. Ibabang Iyam, Lucena City', {'shs'}, set()),
    ('Bristol Integrated School, Inc.', ['Bristol Integrated'], 'private', None, {'shs'}, set()),
    ('Holy Rosary Catholic School', ['Holy Rosary'], 'private', None, {'shs'}, set()),
    ('The Bearer of Light and Wisdom Colleges', ['Bearer of Light'], 'private', 'Brgy. Bocohan, Lucena City', {'shs'}, set()),
    ('St. Augustine School of Nursing ' + DASH + ' Lucena City', ['Augustine School of Nursing'], 'private', None, {'shs', 'tvet'}, {'tvl', 'tesda'}),
    ('Baptist Voice Bible College', ['Baptist Voice'], 'private', 'Lot 1, Blk. 41, Citta Grande III, Brgy. Ibabang Iyam, Lucena City', {'college'}, set()),

    ('St. Michael TVET Training and Assessment Center, Inc.', ['St. Michael TVET'], 'private', None, {'shs', 'tvet'}, {'tvl', 'tesda'}),
    ('PROFES-SKILLS INSTITUTE Training and Assessment Center, Inc.', ['Profes-Skills', 'PROFES-SKILLS'], 'private', '0067 M. L. Tagarao St., Brgy. 3, Lucena City', {'tvet'}, {'tesda'}),
    ('St. Gabriel College of Technology and Assessment Center, Inc.', ['St. Gabriel College of Technology'], 'private', 'Quezon Ave. cor. P. Gomez St., Lucena City', {'tvet'}, {'tesda'}),
    ('Success Technical and Professional School, Inc. (Main)', ['Success Technical and Professional'], 'private', '52 Old Manila South Rd., Lucena City', {'tvet'}, {'tesda'}),
    ('Success Technical and Vocational School ' + DASH + ' Lucena (Domoit Campus)', ['Success Technical and Vocational'], 'private', 'Purok Dama de Noche, Brgy. Domoit, Lucena City', {'tvet'}, {'tesda'}),
    ('Lucena Technological Institute, Inc.', ['Lucena Technological Institute'], 'private', 'Lucena Grand Central Terminal, Diversion Rd., Brgy. Ilayang Dupay, Lucena City', {'tvet'}, {'tesda'}),
    ('Lucena Security Training Center, Inc.', ['Lucena Security Training'], 'private', 'Quezon Ave., Lucena City', {'tvet'}, {'tesda'}),
]

# These annexes and extensions are Junior High School only, according to the LYDO list: they are left out of the Senior High results.
JHS_ONLY = ['Mayao Crossing Extension', 'Ilayang Dupay Extension', 'Mayao Castillo Annex', 'Silangang Mayao Annex', 'Barra Annex']
