from django.conf import settings
from django.db import models

SLUG_CHOICES = [
    ('terms', 'Terms of Use'),
    ('privacy', 'Privacy Policy'),
    ('cookies', 'Cookie Policy'),
]


class PolicyDocument(models.Model):
    """One editable public policy page. The text is written in simple markup: '## Heading', '- bullet', **bold**."""
    slug = models.CharField(max_length=20, choices=SLUG_CHOICES, unique=True)
    title = models.CharField(max_length=200)
    content = models.TextField()
    version = models.PositiveIntegerField(default=1)
    # True until an administrator confirms the text was reviewed by the responsible LYDO / LGU authority.
    needs_review = models.BooleanField(default=True)
    updated_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['slug']

    def __str__(self):
        return f'{self.get_slug_display()} v{self.version}'


class PolicyRevision(models.Model):
    """Every saved version is kept, so it is always possible to see what a policy said at a given time."""
    policy = models.ForeignKey(PolicyDocument, on_delete=models.CASCADE, related_name='revisions')
    version = models.PositiveIntegerField()
    title = models.CharField(max_length=200)
    content = models.TextField()
    edited_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-version']
        unique_together = ('policy', 'version')
