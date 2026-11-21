import re

from django.core.management.base import BaseCommand
from django.db import IntegrityError, transaction

from apps.applications.models import OpportunityApplication
from apps.jobs.models import JobOpportunity
from apps.programs.models import YouthProgram


def norm(value):
    return re.sub(r'[^a-z0-9]+', ' ', (value or '').lower()).strip()


class _Rollback(Exception):
    pass


class Command(BaseCommand):
    help = (
        'Merge duplicate jobs (same title + organisation) and duplicate programs (same title + status). '
        'The oldest record is kept and everything pointing at the duplicates is moved to it. '
        'Dry run by default: pass --apply to save the changes.'
    )

    def add_arguments(self, parser):
        parser.add_argument('--apply', action='store_true', help='Actually merge and delete the duplicates.')

    def handle(self, *args, **opts):
        apply = opts['apply']
        try:
            with transaction.atomic():
                self.stdout.write(self.style.MIGRATE_HEADING('Jobs'))
                self.merge(JobOpportunity.objects.all().order_by('id'), lambda j: (norm(j.title), norm(j.company_or_org)), self.after_job)
                self.stdout.write(self.style.MIGRATE_HEADING('Programs'))
                self.merge(YouthProgram.objects.all().order_by('id'), lambda p: (norm(p.title), p.status), None)
                if not apply:
                    raise _Rollback()
        except _Rollback:
            self.stdout.write(self.style.WARNING('\nDry run only: nothing was changed. Re-run with --apply to merge.'))
            return
        self.stdout.write(self.style.SUCCESS('\nDone. Duplicates merged.'))

    # ------------------------------------------------------------------
    def merge(self, queryset, key, extra):
        groups = {}
        for obj in queryset:
            groups.setdefault(key(obj), []).append(obj)
        dup_groups = [g for g in groups.values() if len(g) > 1]
        if not dup_groups:
            self.stdout.write('  no duplicates')
            return
        for group in dup_groups:
            keeper, dups = group[0], group[1:]
            self.stdout.write(f'  keep #{keeper.pk} "{keeper}"  <- merge {[d.pk for d in dups]}')
            for dup in dups:
                if extra:
                    extra(dup, keeper)
                self.repoint(dup, keeper)
                dup.delete()

    def after_job(self, dup, keeper):
        # Applications store the job id as a plain number, not a foreign key
        for app in OpportunityApplication.objects.filter(kind='job', object_id=dup.pk):
            try:
                with transaction.atomic():
                    app.object_id = keeper.pk
                    app.save(update_fields=['object_id'])
            except IntegrityError:
                # The same person applied to both copies: keep the first application only
                app.delete()

    def repoint(self, dup, keeper):
        for rel in dup._meta.related_objects:
            if rel.many_to_many:
                continue
            model, field = rel.related_model, rel.field.name
            for row in model.objects.filter(**{field: dup}):
                try:
                    with transaction.atomic():
                        setattr(row, field, keeper)
                        row.save(update_fields=[field])
                except IntegrityError:
                    # e.g. the same user saved both copies: the keeper already has this row
                    row.delete()
