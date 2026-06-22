import django.db.models.deletion
from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('courses', '0001_initial'),
    ]

    operations = [
        # 1. Add lesson FK to existing QuizAttempt
        migrations.AddField(
            model_name='quizattempt',
            name='lesson',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='quiz_attempts',
                to='courses.lesson',
            ),
        ),

        # 2. Create Question
        migrations.CreateModel(
            name='Question',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.TextField()),
                ('order', models.PositiveIntegerField(default=0)),
                ('explanation', models.TextField(
                    blank=True,
                    help_text='Shown after answering — explains why the correct answer is right.',
                )),
                ('lesson', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='questions',
                    to='courses.lesson',
                )),
            ],
            options={
                'ordering': ['order'],
            },
        ),

        # 3. Create QuestionChoice
        migrations.CreateModel(
            name='QuestionChoice',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('text', models.CharField(max_length=500)),
                ('is_correct', models.BooleanField(default=False)),
                ('order', models.PositiveIntegerField(default=0)),
                ('question', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='choices',
                    to='courses.question',
                )),
            ],
            options={
                'ordering': ['order'],
            },
        ),

        # 4. Create QuizAttemptAnswer
        migrations.CreateModel(
            name='QuizAttemptAnswer',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('is_correct', models.BooleanField()),
                ('attempt', models.ForeignKey(
                    on_delete=django.db.models.deletion.CASCADE,
                    related_name='answers',
                    to='courses.quizattempt',
                )),
                ('question', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    to='courses.question',
                )),
                ('selected_choice', models.ForeignKey(
                    on_delete=django.db.models.deletion.PROTECT,
                    to='courses.questionchoice',
                )),
            ],
        ),
        migrations.AlterUniqueTogether(
            name='quizattemptanswer',
            unique_together={('attempt', 'question')},
        ),

        # 5. Indexes
        migrations.AddIndex(
            model_name='question',
            index=models.Index(fields=['lesson', 'order'], name='courses_que_lesson_order_idx'),
        ),
        migrations.AddIndex(
            model_name='questionchoice',
            index=models.Index(fields=['question', 'order'], name='courses_que_question_order_idx'),
        ),
    ]
