from django.db import models


class Anchor(models.Model):
    """
    One fingerprint written to the ledger. `kind` + `ref` say what it covers
    (e.g. review_log / 12). A record can be anchored more than once when its
    content legitimately changes; the latest anchor is the one that counts.
    Only the SHA-256 fingerprint is stored on the ledger, never the data itself.
    """
    class Status(models.TextChoices):
        PENDING = 'pending', 'Pending'
        ANCHORED = 'anchored', 'Anchored'
        FAILED = 'failed', 'Failed'

    kind = models.CharField(max_length=30)
    ref = models.CharField(max_length=64)
    content_hash = models.CharField(max_length=64)
    status = models.CharField(max_length=10, choices=Status.choices, default=Status.PENDING)
    network = models.CharField(max_length=60, blank=True)
    tx_hash = models.CharField(max_length=80, blank=True)
    block = models.PositiveBigIntegerField(null=True, blank=True)
    anchored_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['-id']
        indexes = [models.Index(fields=['kind', 'ref'])]

    def __str__(self):
        return f'{self.kind}:{self.ref} {self.content_hash[:10]} ({self.status})'


class LedgerEntry(models.Model):
    """
    Local hash-chained ledger used when no public blockchain is configured.
    Each entry commits to the previous entry's hash, so editing or deleting
    any past entry breaks every entry after it.
    """
    index = models.PositiveBigIntegerField(unique=True)
    payload_hash = models.CharField(max_length=64)
    prev_hash = models.CharField(max_length=64)
    entry_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['index']

    def __str__(self):
        return f'#{self.index} {self.entry_hash[:12]}'
