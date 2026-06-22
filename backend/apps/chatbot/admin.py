from django.contrib import admin
from .models import ChatSession, ChatMessage


class ChatMessageInline(admin.TabularInline):
    model = ChatMessage
    extra = 0
    readonly_fields = ['role', 'content', 'created_at']


@admin.register(ChatSession)
class ChatSessionAdmin(admin.ModelAdmin):
    list_display = ['session_key', 'user', 'created_at']
    list_filter = ['created_at']
    search_fields = ['session_key', 'user__email']
    readonly_fields = ['created_at']
    inlines = [ChatMessageInline]


@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ['session', 'role', 'content_preview', 'created_at']
    list_filter = ['role', 'created_at']
    search_fields = ['content', 'session__session_key']
    readonly_fields = ['created_at']

    def content_preview(self, obj):
        return obj.content[:80]
    content_preview.short_description = 'Content'
