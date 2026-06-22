from django.contrib import admin

from .models import ProgramSubmission, YouthProgram


class ProgramSubmissionInline(admin.TabularInline):
    model = ProgramSubmission
    extra = 0
    readonly_fields = ('submitted_at', 'submitted_by')
    fields = ('title', 'submitter_type', 'submitted_by', 'file', 'status', 'admin_notes', 'submitted_at')


@admin.register(YouthProgram)
class YouthProgramAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'category', 'status', 'submitter_type',
        'organization', 'barangay', 'start_date', 'end_date',
        'is_featured', 'total_participants', 'created_at',
    )
    list_filter = ('category', 'status', 'submitter_type', 'is_featured')
    search_fields = ('title', 'description', 'barangay', 'location', 'organization__name')
    readonly_fields = ('created_at', 'updated_at', 'total_participants')
    date_hierarchy = 'start_date'
    inlines = [ProgramSubmissionInline]
    actions = ['mark_featured', 'mark_completed']

    @admin.action(description='Mark selected programs as featured')
    def mark_featured(self, request, queryset):
        updated = queryset.update(is_featured=True)
        self.message_user(request, f'{updated} program(s) marked as featured.')

    @admin.action(description='Mark selected programs as completed')
    def mark_completed(self, request, queryset):
        updated = queryset.update(status='completed')
        self.message_user(request, f'{updated} program(s) marked as completed.')


@admin.register(ProgramSubmission)
class ProgramSubmissionAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'submitter_type', 'submitted_by',
        'organization', 'program', 'status', 'submitted_at',
    )
    list_filter = ('submitter_type', 'status')
    search_fields = ('title', 'description', 'submitted_by__email', 'organization__name')
    readonly_fields = ('submitted_at', 'submitted_by')
    date_hierarchy = 'submitted_at'
    actions = ['approve_submissions', 'reject_submissions']

    @admin.action(description='Approve selected submissions')
    def approve_submissions(self, request, queryset):
        updated = queryset.update(status='approved')
        self.message_user(request, f'{updated} submission(s) approved.')

    @admin.action(description='Reject selected submissions')
    def reject_submissions(self, request, queryset):
        updated = queryset.update(status='rejected')
        self.message_user(request, f'{updated} submission(s) rejected.')
