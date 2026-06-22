from django.db import models
from django.conf import settings


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


class PostReaction(models.Model):
    post = models.ForeignKey(
        CommunityPost, on_delete=models.CASCADE, related_name='reactions'
    )
    user = models.ForeignKey(
        settings.AUTH_USER_MODEL, on_delete=models.CASCADE
    )
    created_at = models.DateTimeField(auto_now_add=True)

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

    class Meta:
        ordering = ['created_at']
