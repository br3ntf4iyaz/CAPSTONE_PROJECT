from django.urls import path, include
from rest_framework.routers import DefaultRouter
from rest_framework_nested.routers import NestedDefaultRouter

from .views import (
    MilestoneViewSet,
    ProjectCommentViewSet,
    ProjectMemberViewSet,
    ProjectResourceViewSet,
    ProjectViewSet,
    TaskViewSet,
)

# Root router
router = DefaultRouter()
router.register(r'', ProjectViewSet, basename='project')

# Nested routers scoped under /{project_pk}/
projects_router = NestedDefaultRouter(router, r'', lookup='project')
projects_router.register(r'members', ProjectMemberViewSet, basename='project-member')
projects_router.register(r'tasks', TaskViewSet, basename='project-task')
projects_router.register(r'milestones', MilestoneViewSet, basename='project-milestone')
projects_router.register(r'resources', ProjectResourceViewSet, basename='project-resource')
projects_router.register(r'comments', ProjectCommentViewSet, basename='project-comment')

urlpatterns = [
    path('', include(router.urls)),
    path('', include(projects_router.urls)),
]
