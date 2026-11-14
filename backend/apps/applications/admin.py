from django.contrib import admin

from .models import OpportunityApplication


@admin.register(OpportunityApplication)
class OpportunityApplicationAdmin(admin.ModelAdmin):
    list_display = ('full_name', 'kind', 'title', 'status', 'submitted_at')
    list_filter = ('kind', 'status')
    search_fields = ('full_name', 'title', 'email')
