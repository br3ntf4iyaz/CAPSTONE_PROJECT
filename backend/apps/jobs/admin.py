from django.contrib import admin

from .models import JobOpportunity


@admin.register(JobOpportunity)
class JobOpportunityAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'company_or_org', 'location',
        'job_type', 'industry', 'application_deadline',
        'is_active', 'is_featured', 'posted_by', 'created_at',
    )
    list_filter = ('job_type', 'industry', 'is_active', 'is_featured')
    search_fields = ('title', 'company_or_org', 'location', 'contact_email', 'posted_by__email')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'application_deadline'
    actions = ['mark_featured', 'mark_inactive']

    @admin.action(description='Mark selected jobs as featured')
    def mark_featured(self, request, queryset):
        updated = queryset.update(is_featured=True)
        self.message_user(request, f'{updated} job(s) marked as featured.')

    @admin.action(description='Mark selected jobs as inactive')
    def mark_inactive(self, request, queryset):
        updated = queryset.update(is_active=False)
        self.message_user(request, f'{updated} job(s) marked as inactive.')
