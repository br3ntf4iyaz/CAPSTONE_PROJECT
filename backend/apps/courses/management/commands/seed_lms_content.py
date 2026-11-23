"""
Fills the seed courses with real lesson notes and lesson assessments (4 choices, one correct answer each).

  * Lessons still named "Core Concept" get their real title and notes. Lessons an admin already edited are left alone.
  * A lesson that has no questions gets its questions. A lesson that has questions is never touched.
  * Missing modules and lessons are created, so every course has several modules and lessons.
  * Videos are NEVER invented. Lessons without a configured video show a clear placeholder. The one old test link
    that pointed every lesson to the same unrelated video is removed.

Safe to run again.

    python manage.py seed_lms_content
"""
import random

from django.core.management.base import BaseCommand
from django.db import transaction

from apps.courses.lms_content import CONTENT
from apps.courses import lms_content_org, lms_content_sk
from apps.courses.lms_content_extra import merge
from apps.courses.models import Course, CourseModule, Lesson, Question, QuestionChoice, QuizAttempt

# Who each course is mainly for, and what a learner can do afterwards (used on the certificate).
# The audience only labels a course. It never limits who may enroll.
COURSE_META = {
    'Leadership Fundamentals': ('general_youth', [
        'leadership principles', 'leadership styles', 'self-leadership', 'vision building', 'decision-making under pressure',
        'inspiring and motivating others']),
    'Youth Governance 101': ('general_youth', [
        'youth governance and participation', 'Philippine youth laws and policies', 'the role of youth in local government',
        'participation in barangay governance', 'writing resolutions and ordinances', 'accountability and transparency']),
    'Communication Skills for Leaders': ('general_youth', [
        'effective communication', 'active listening', 'public speaking', 'written communication', 'non-verbal communication',
        'conflict resolution through communication']),
    'Digital Skills for Youth Leaders': ('general_youth', [
        'digital literacy', 'social media use for advocacy', 'online content creation', 'online safety and cybersecurity',
        'digital productivity tools', 'data privacy rights']),
    'Youth Leadership and Communication': ('general_youth', [
        'youth leadership', 'effective communication', 'teamwork and delegation', 'conflict management', 'public speaking']),
    'Financial Literacy for SK': ('sk_officials', [
        'SK financial management', 'budget planning', 'financial documentation', 'public accountability']),
    'SK Governance Fundamentals': ('sk_officials', [
        'SK governance', 'the responsibilities of SK officials', 'SK funds and budgeting', 'youth development planning',
        'SK meetings and youth participation', 'public accountability and transparency']),
    lms_content_org.TITLE: (lms_content_org.AUDIENCE, [
        'the roles and responsibilities of youth organization leaders', 'organizational leadership', 'goal setting and project planning',
        'resource management', 'volunteer coordination', 'community engagement and project evaluation']),
}

UNRELATED_TEST_VIDEO = 'dQw4w9WgXcQ'  # an old placeholder that sent every lesson to the same unrelated video


def is_generic(lesson):
    return 'core concept' in (lesson.title or '').lower()


class Command(BaseCommand):
    help = 'Add lesson notes and assessments to the seed courses (never overwrites admin work).'

    def handle(self, *args, **opts):
        content = merge(CONTENT)
        content[lms_content_org.TITLE] = {'category': lms_content_org.CATEGORY, 'modules': lms_content_org.MODULES}
        for sk in lms_content_sk.COURSES:  # verified SK content replaces the older text for these two courses
            content[sk['title']] = {'category': content.get(sk['title'], {}).get('category', ''), 'modules': sk['modules']}
        stats = dict(courses=0, modules=0, lessons=0, titled=0, questions=0, created_course=0, labelled=0, replaced=0, kept=0)
        with transaction.atomic():
            cleared = Lesson.objects.filter(video_url__icontains=UNRELATED_TEST_VIDEO).update(video_url='')
            if not Course.objects.filter(title=lms_content_org.TITLE, is_active=True).exists():
                Course.objects.create(
                    title=lms_content_org.TITLE, description=lms_content_org.DESCRIPTION, category=lms_content_org.CATEGORY,
                    audience=lms_content_org.AUDIENCE, is_published=True)
                stats['created_course'] = 1
            for title, data in content.items():
                course = Course.objects.filter(title=title, is_active=True, modules__isnull=False).distinct().first() \
                    or Course.objects.filter(title=title, is_active=True).first()
                if course is None:
                    self.stdout.write(self.style.WARNING(f'  skipped (course not found): {title}'))
                    continue
                stats['courses'] += 1
                meta = COURSE_META.get(title)
                if meta:
                    audience, outcomes = meta
                    changed = False
                    if course.audience == 'general_youth' and audience != 'general_youth':
                        course.audience, changed = audience, True  # only when nobody chose a different audience yet
                    if not course.learning_outcomes:
                        course.learning_outcomes, changed = outcomes, True
                    if changed:
                        course.save()
                        stats['labelled'] += 1
                for m in data['modules']:
                    module = course.modules.filter(order=m['order']).first()
                    if module is None:
                        module = CourseModule.objects.create(course=course, order=m['order'], title=m['title'])
                        stats['modules'] += 1
                    if (any(l.get('replace') for l in m['lessons']) and module.title != m['title']
                            and not QuizAttempt.objects.filter(lesson__module=module).exists()):
                        module.title = m['title']
                        module.save(update_fields=['title'])
                    for l in m['lessons']:
                        lesson = module.lessons.filter(order=l['order']).first()
                        if lesson is None:
                            lesson = Lesson.objects.create(
                                module=module, order=l['order'], title=l['title'], content=l['content'],
                                duration_minutes=l.get('duration'))
                            stats['lessons'] += 1
                        elif is_generic(lesson):
                            lesson.title, lesson.content = l['title'], l['content']
                            if l.get('duration') and not lesson.duration_minutes:
                                lesson.duration_minutes = l['duration']
                            lesson.save()
                            stats['titled'] += 1
                        if lesson.questions.exists() and l.get('replace'):
                            if QuizAttempt.objects.filter(lesson=lesson).exists():
                                stats['kept'] += 1  # learners already answered it: never rewrite what they were graded on
                                continue
                            lesson.title, lesson.content = l['title'], l['content']
                            if l.get('duration'):
                                lesson.duration_minutes = l['duration']
                            lesson.save()
                            lesson.questions.all().delete()
                            stats['replaced'] += 1
                        if lesson.questions.exists():
                            continue
                        for qi, q in enumerate(l['questions'], start=1):
                            question = Question.objects.create(lesson=lesson, text=q['text'], order=qi,
                                                               explanation=q.get('explanation', ''))
                            choices = list(q['choices'])
                            if q.get('shuffle'):
                                random.Random(q['text']).shuffle(choices)
                            for ci, (text, ok) in enumerate(choices, start=1):
                                QuestionChoice.objects.create(question=question, text=text, is_correct=ok, order=ci)
                            stats['questions'] += 1
        self.stdout.write(self.style.SUCCESS(
            f"{stats['courses']} courses checked ({stats['created_course']} created, {stats['labelled']} labelled with audience and outcomes) | {stats['modules']} modules, {stats['lessons']} lessons added | "
            f"{stats['titled']} lessons given real titles and notes, {stats['replaced']} replaced with verified text, {stats['kept']} kept (already answered) | {stats['questions']} questions added | "
            f"{cleared} unrelated test video link(s) removed"))
