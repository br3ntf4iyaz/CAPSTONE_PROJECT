import re

from django.core.exceptions import ValidationError


class MixedCharactersValidator:
    """The password must have a number, an upper case and a lower case letter. The sign-up page shows the same three rules with check marks."""

    def validate(self, password, user=None):
        problems = []
        if not re.search(r'\d', password):
            problems.append(ValidationError('Include one number.', code='password_no_number'))
        if not (re.search(r'[a-z]', password) and re.search(r'[A-Z]', password)):
            problems.append(ValidationError('Include upper and lower case letters.', code='password_no_mixed_case'))
        if problems:
            raise ValidationError(problems)

    def get_help_text(self):
        return 'Your password must include a number, and upper and lower case letters.'
