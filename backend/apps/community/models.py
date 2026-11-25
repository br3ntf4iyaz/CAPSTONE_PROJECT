from django.db import models
from django.conf import settings
from django.utils import timezone


class CommunityPost(models.Model):
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name='community_posts',
    )
    content = models.TextField(max_length=2000)
    image = models.ImageField(upload_to='community_posts/', null=True, blank=True)
    is_pinned = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.author} — {self.created_at:%Y-%m-%d}"


class CommunityPostImage(models.Model):
    post = models.ForeignKey(
        CommunityPost, on_delete=models.CASCADE, related_name='images'
    )
    image = models.ImageField(upload_to='community_posts/')
    order = models.PositiveSmallIntegerField(default=0)

    class Meta:
        ordering = ['order']


REACTION_TYPES = [
    ('like', 'Like'), ('love', 'Love'), ('care', 'Care'), ('haha', 'Haha'),
    ('wow', 'Wow'), ('sad', 'Sad'), ('angry', 'Angry'),
]


class PostReaction(models.Model):
    post = models.ForeignKey(
        CommunityPost, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    # One row per user per post; choosing another reaction changes this row, it never adds one
    reaction_type = models.CharField(max_length=10, choices=REACTION_TYPES, default='like')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(default=timezone.now)

    class Meta:
        unique_together = [('post', 'user')]


class CommunityComment(models.Model):
    post = models.ForeignKey(
        CommunityPost, on_delete=models.CASCADE, related_name='comments'
    )
    author = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    content = models.TextField(max_length=1000)
    created_at = models.DateTimeField(auto_now_add=True)
    # A reply points at the comment it answers
    parent = models.ForeignKey('self', null=True, blank=True, on_delete=models.CASCADE, related_name='replies')
    # Moderation: a hidden comment is kept in the database but not shown publicly
    is_hidden = models.BooleanField(default=False)
    hidden_by = models.ForeignKey(settings.AUTH_USER_MODEL, null=True, blank=True, on_delete=models.SET_NULL, related_name='+')
    hidden_at = models.DateTimeField(null=True, blank=True)
    # A deleted comment that still has replies stays as an empty placeholder so the thread is not broken
    is_deleted = models.BooleanField(default=False)

    class Meta:
        ordering = ['created_at']
