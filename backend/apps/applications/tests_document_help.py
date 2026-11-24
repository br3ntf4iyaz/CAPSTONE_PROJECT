from django.test import SimpleTestCase

from .documents import DOCUMENT_HELP, DOCUMENT_TYPES
from .scholarship_logic import document_requirements


class FakeScholarship:
    required_documents = ['valid_id', 'grades']
    optional_documents = ['other', 'grades']  # a repeated key must not show twice


class DocumentHelpTests(SimpleTestCase):
    def test_every_document_type_has_a_plain_explanation(self):
        self.assertEqual(set(DOCUMENT_HELP), set(DOCUMENT_TYPES))
        for key, text in DOCUMENT_HELP.items():
            self.assertGreater(len(text), 30, key)

    def test_the_grades_explanation_says_which_one_to_upload(self):
        text = DOCUMENT_HELP['grades']
        self.assertIn('Report Card', text)
        self.assertIn('Transcript of Records', text)

    def test_the_requirements_sent_to_the_form_carry_the_explanation(self):
        reqs = document_requirements(FakeScholarship())
        self.assertEqual([r['key'] for r in reqs], ['valid_id', 'grades', 'other'])
        self.assertEqual([r['required'] for r in reqs], [True, True, False])
        for r in reqs:
            self.assertEqual(r['help'], DOCUMENT_HELP[r['key']])
