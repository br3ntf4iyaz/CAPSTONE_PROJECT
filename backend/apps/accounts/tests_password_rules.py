from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError
from django.test import TestCase


class PasswordRulesTests(TestCase):
    """The sign-up page shows three rules (8 characters, a number, upper and lower case); the server enforces the same three."""

    def messages(self, pw):
        try:
            validate_password(pw)
        except ValidationError as e:
            return ' '.join(e.messages)
        return ''

    def test_a_password_with_all_three_rules_is_accepted(self):
        self.assertEqual(self.messages('Zq7-Lucena-Youth'), '')
        self.assertEqual(self.messages('Nx4Kpm9Tz'), '')

    def test_each_missing_rule_is_named(self):
        self.assertIn('at least 8', self.messages('Ab1'))
        self.assertIn('Include one number', self.messages('Abcdefghij'))
        self.assertIn('upper and lower case', self.messages('abcdefg1'))
        self.assertIn('upper and lower case', self.messages('ABCDEFG1'))
        self.assertIn('Include one number', self.messages('abcdefgH'))
