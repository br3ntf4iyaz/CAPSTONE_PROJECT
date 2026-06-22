from django.contrib import admin

from .models import (
    Event,
    EventRegistration,
    Feedback,
    Poll,
    PollOption,
    PollResponse,
    Survey,
    SurveyQuestion,
    SurveyResponse,
)


class PollOptionInline(admin.TabularInline):
    model = PollOption
    extra = 2


class SurveyQuestionInline(admin.TabularInline):
    model = SurveyQuestion
    extra = 2


@admin.register(Event)
class EventAdmin(admin.ModelAdmin):
    list_display = ("title", "event_type", "organizer", "start_datetime", "end_datetime", "is_published", "is_active", "capacity")
    list_filter = ("event_type", "is_published", "is_active")
    search_fields = ("title", "description", "location", "organizer__email")
    date_hierarchy = "start_datetime"
    readonly_fields = ("created_at", "updated_at")


@admin.register(EventRegistration)
class EventRegistrationAdmin(admin.ModelAdmin):
    list_display = ("user", "event", "attended", "registered_at")
    list_filter = ("attended", "event")
    search_fields = ("user__email", "user__first_name", "user__last_name", "event__title")
    date_hierarchy = "registered_at"
    readonly_fields = ("registered_at",)


@admin.register(Poll)
class PollAdmin(admin.ModelAdmin):
    list_display = ("question", "event", "created_by", "is_active", "created_at", "ends_at")
    list_filter = ("is_active",)
    search_fields = ("question", "created_by__email", "event__title")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)
    inlines = [PollOptionInline]


@admin.register(PollOption)
class PollOptionAdmin(admin.ModelAdmin):
    list_display = ("text", "poll", "order")
    search_fields = ("text", "poll__question")


@admin.register(PollResponse)
class PollResponseAdmin(admin.ModelAdmin):
    list_display = ("user", "poll", "option", "responded_at")
    list_filter = ("poll",)
    search_fields = ("user__email", "poll__question", "option__text")
    date_hierarchy = "responded_at"
    readonly_fields = ("responded_at",)


@admin.register(Survey)
class SurveyAdmin(admin.ModelAdmin):
    list_display = ("title", "event", "created_by", "is_active", "created_at")
    list_filter = ("is_active",)
    search_fields = ("title", "description", "created_by__email")
    date_hierarchy = "created_at"
    readonly_fields = ("created_at",)
    inlines = [SurveyQuestionInline]


@admin.register(SurveyQuestion)
class SurveyQuestionAdmin(admin.ModelAdmin):
    list_display = ("survey", "question_type", "order")
    list_filter = ("question_type", "survey")
    search_fields = ("question", "survey__title")


@admin.register(SurveyResponse)
class SurveyResponseAdmin(admin.ModelAdmin):
    list_display = ("user", "survey", "submitted_at")
    list_filter = ("survey",)
    search_fields = ("user__email", "survey__title")
    date_hierarchy = "submitted_at"
    readonly_fields = ("submitted_at",)


@admin.register(Feedback)
class FeedbackAdmin(admin.ModelAdmin):
    list_display = ("user", "event", "rating", "submitted_at")
    list_filter = ("rating", "event")
    search_fields = ("user__email", "comment", "event__title")
    date_hierarchy = "submitted_at"
    readonly_fields = ("submitted_at",)
