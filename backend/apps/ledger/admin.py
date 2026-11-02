from django.contrib import admin

from .models import Anchor, LedgerEntry


@admin.register(Anchor)
class AnchorAdmin(admin.ModelAdmin):
    list_display = ("kind", "ref", "status", "network", "block", "anchored_at", "created_at")
    list_filter = ("kind", "status", "network")
    search_fields = ("ref", "content_hash", "tx_hash")
    readonly_fields = [f.name for f in Anchor._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(LedgerEntry)
class LedgerEntryAdmin(admin.ModelAdmin):
    list_display = ("index", "payload_hash", "entry_hash", "created_at")
    readonly_fields = [f.name for f in LedgerEntry._meta.fields]

    def has_add_permission(self, request):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
