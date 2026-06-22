from django.contrib import admin

from .models import Team, TeamMember, VolunteerOpportunity, VolunteerSignup


class TeamMemberInline(admin.TabularInline):
    model = TeamMember
    extra = 1


@admin.register(VolunteerOpportunity)
class VolunteerOpportunityAdmin(admin.ModelAdmin):
    list_display = ("title", "organization", "location", "slots", "is_active", "start_date", "end_date", "created_at")
    list_filter = ("is_active", "organization")
    search_fields = ("title", "description", "organization", "location", "posted_by__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)


@admin.register(VolunteerSignup)
class VolunteerSignupAdmin(admin.ModelAdmin):
    list_display = ("user", "opportunity", "status", "signed_up_at")
    list_filter = ("status", "opportunity")
    search_fields = ("user__email", "user__first_name", "user__last_name", "opportunity__title")
    date_hierarchy = "signed_up_at"
    readonly_fields = ("signed_up_at",)


@admin.register(Team)
class TeamAdmin(admin.ModelAdmin):
    list_display = ("name", "opportunity", "created_by", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("name", "description", "created_by__email", "opportunity__title")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)
    inlines = [TeamMemberInline]


@admin.register(TeamMember)
class TeamMemberAdmin(admin.ModelAdmin):
    list_display = ("user", "team", "role", "joined_at")
    list_filter = ("team",)
    search_fields = ("user__email", "user__first_name", "user__last_name", "team__name", "role")
    readonly_fields = ("joined_at",)
