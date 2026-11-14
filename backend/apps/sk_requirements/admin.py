from django.contrib import admin

from .models import SKBarangay, SKMember, SKRequirement, SKRequirementTemplate


class SKMemberInline(admin.TabularInline):
    model = SKMember
    extra = 0
    fields = ('position', 'name', 'photo', 'order')


class SKRequirementInline(admin.TabularInline):
    model = SKRequirement
    extra = 0
    readonly_fields = ('submitted_at', 'reviewed_at', 'created_at', 'updated_at')
    fields = (
        'requirement_type', 'status', 'file',
        'due_date', 'submitted_at', 'reviewed_by', 'reviewed_at', 'notes',
    )


@admin.register(SKRequirementTemplate)
class SKRequirementTemplateAdmin(admin.ModelAdmin):
    list_display = ('name', 'order')
    search_fields = ('name', 'description')
    ordering = ('order', 'name')


@admin.register(SKBarangay)
class SKBarangayAdmin(admin.ModelAdmin):
    list_display = ('barangay_name', 'sk_chairperson', 'contact_email', 'contact_phone', 'is_active', 'created_at')
    list_filter = ('is_active',)
    search_fields = ('barangay_name', 'sk_chairperson', 'contact_email')
    readonly_fields = ('created_at',)
    inlines = [SKMemberInline, SKRequirementInline]


@admin.register(SKRequirement)
class SKRequirementAdmin(admin.ModelAdmin):
    list_display = (
        'barangay', 'requirement_type', 'status',
        'due_date', 'submitted_at', 'reviewed_by', 'reviewed_at',
    )
    list_filter = ('status', 'requirement_type', 'barangay')
    search_fields = ('barangay__barangay_name', 'notes')
    readonly_fields = ('submitted_at', 'reviewed_at', 'created_at', 'updated_at')
    date_hierarchy = 'due_date'
