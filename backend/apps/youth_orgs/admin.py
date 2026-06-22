from django.contrib import admin

from .models import OrgAccomplishment, OrgRequirement, YouthOrganization


class OrgAccomplishmentInline(admin.TabularInline):
    model = OrgAccomplishment
    extra = 1
    readonly_fields = ('created_at',)


class OrgRequirementInline(admin.TabularInline):
    model = OrgRequirement
    extra = 1
    readonly_fields = ('submitted_at',)


@admin.register(YouthOrganization)
class YouthOrganizationAdmin(admin.ModelAdmin):
    list_display = (
        'name', 'classification', 'sub_classification',
        'registration_category', 'barangay', 'is_compliant', 'is_active', 'created_at',
    )
    list_filter = ('classification', 'sub_classification', 'registration_category', 'is_compliant', 'is_active')
    search_fields = ('name', 'barangay', 'contact_person', 'contact_email')
    readonly_fields = ('created_at', 'updated_at')
    inlines = [OrgAccomplishmentInline, OrgRequirementInline]
    actions = ['mark_compliant']

    @admin.action(description='Mark selected organizations as compliant')
    def mark_compliant(self, request, queryset):
        updated = queryset.update(is_compliant=True)
        self.message_user(request, f'{updated} organization(s) marked as compliant.')


@admin.register(OrgAccomplishment)
class OrgAccomplishmentAdmin(admin.ModelAdmin):
    list_display = ('organization', 'title', 'date_achieved', 'created_at')
    list_filter = ('organization',)
    search_fields = ('title', 'description', 'organization__name')
    date_hierarchy = 'date_achieved'
    readonly_fields = ('created_at',)


@admin.register(OrgRequirement)
class OrgRequirementAdmin(admin.ModelAdmin):
    list_display = ('organization', 'name', 'is_submitted', 'submitted_at')
    list_filter = ('is_submitted', 'organization')
    search_fields = ('name', 'organization__name', 'notes')
    readonly_fields = ('submitted_at',)
