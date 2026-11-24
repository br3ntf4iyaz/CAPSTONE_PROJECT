"""python -m apps.courses.more_questions._balance <module> : share of questions whose correct choice is the longest, and which ones."""
import importlib
import sys

mod = importlib.import_module(f'apps.courses.more_questions.{sys.argv[1]}')
total = longest = 0
for lesson, qs in mod.MORE.items():
    for i, q in enumerate(qs, 1):
        total += 1
        right = [c for c, ok in q['choices'] if ok][0]
        wrong = [c for c, ok in q['choices'] if not ok]
        flag = len(right) >= max(len(w) for w in wrong)
        longest += flag
        if flag:
            print(f'LONGEST  [{lesson}] #{i}: {q["text"][:70]}  (right {len(right)} vs longest wrong {max(len(w) for w in wrong)})')
print(f'{longest}/{total} = {round(100 * longest / total)}% (target: 30% or lower)')
