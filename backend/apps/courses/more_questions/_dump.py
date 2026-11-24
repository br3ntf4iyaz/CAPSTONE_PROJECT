"""Helper for authors: python -m apps.courses.more_questions._dump "<course title>" prints each lesson, its notes and its current questions."""
import sys
from apps.courses.lms_content import CONTENT
from apps.courses import lms_content_org as o, lms_content_sk as sk
from apps.courses.lms_content_extra import merge

def all_content():
    c = merge(CONTENT)
    c[o.TITLE] = {'modules': o.MODULES}
    for s in sk.COURSES:
        c[s['title']] = {'modules': s['modules']}
    return c

if __name__ == '__main__':
    d = all_content()[sys.argv[1]]
    for m in d['modules']:
        for l in m['lessons']:
            print('=' * 80); print('LESSON:', l['title']); print(l['content']); print('-- existing questions:')
            for q in l['questions']:
                print('  *', q['text'], '=>', [c for c, ok in q['choices'] if ok][0])
