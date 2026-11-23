"""Extra lessons so that every course has several modules and lessons, each with its own assessment.

Notes and questions only repeat well-established facts (RA 10742 and the 2025 DBM-DILG-NYC circular for the SK
lessons, and general leadership practice for the leadership lessons). No video links are included.
"""


def q(text, explanation, right, *wrong):
    """One multiple-choice question: the correct choice first here, the order is shuffled by the seed command."""
    return {'text': text, 'explanation': explanation, 'shuffle': True,
            'choices': [(right, True)] + [(w, False) for w in wrong]}


LEADERSHIP_NEW_MODULE = {
    'title': 'Leading Teams', 'order': 2,
    'lessons': [
        {
            'order': 1, 'title': 'Teamwork and Delegation', 'duration': 20,
            'content': (
                'A leader cannot do everything alone, and should not try.\n\n'
                '**Delegation** means giving a task to someone else along with the authority and information to do it.\n\n'
                '**How to delegate well:** choose the right person, explain the goal and the deadline, give the support they '
                'need, and follow up without taking the task back.\n\n'
                '**Why it matters:** delegation develops other leaders and keeps you free to focus on direction.\n\n'
                '**Remember:** you are still responsible for the result, so check progress, not every detail.'
            ),
            'questions': [
                q('What is delegation?', 'Delegation gives a task together with the authority and information needed to do it.',
                  'Giving a task to someone with the authority and information to do it', 'Doing the whole task yourself',
                  'Blaming someone else for a mistake', 'Cancelling the task'),
                q('Which step belongs to good delegation?', 'The person needs a clear goal and deadline.',
                  'Explaining the goal and the deadline clearly', 'Giving no instructions',
                  'Changing the task every hour', 'Hiding the deadline'),
                q('Why should leaders delegate?', 'Delegation develops other people and frees the leader for direction.',
                  'It develops others and frees the leader to focus on direction', 'It removes all responsibility from the leader',
                  'It makes teamwork unnecessary', 'It lowers the quality of the work by design'),
                q('After delegating a task, the leader should:', 'The leader remains responsible and checks progress without taking over.',
                  'Check progress without taking the task back', 'Forget about the task completely',
                  'Do the task again to be safe', 'Punish the person for asking questions'),
            ],
        },
        {
            'order': 2, 'title': 'Managing Conflict in a Team', 'duration': 20,
            'content': (
                'Conflict happens in every team. It becomes a problem only when it is ignored or handled badly.\n\n'
                '**Steps:** 1) Stay calm. 2) Listen to each side without interrupting. 3) Focus on the problem, not on the person. '
                '4) Look for solutions that serve the shared goal. 5) Agree on next steps and follow up.\n\n'
                '**What to avoid:** taking sides too early, shouting, gossiping, and making it personal.\n\n'
                '**Remember:** a respectful disagreement can lead to a better decision.'
            ),
            'questions': [
                q('What is a good first step in handling a conflict?', 'Staying calm helps everyone think clearly.',
                  'Stay calm and listen to each side', 'Take sides immediately',
                  'Shout so everyone obeys', 'Ignore it until it disappears'),
                q('A good leader focuses on:', 'Solving the problem keeps the team working toward the shared goal.',
                  'The problem, not the person', 'Finding someone to blame',
                  'Winning the argument at any cost', 'Who spoke first'),
                q('Which behavior makes a conflict worse?', 'Gossip and personal attacks damage trust.',
                  'Gossiping and making it personal', 'Listening without interrupting',
                  'Agreeing on next steps', 'Looking for a shared goal'),
                q('A respectful disagreement can:', 'Different views can lead to a better decision.',
                  'Lead to a better decision', 'Prove the team has failed',
                  'Mean the leader must resign', 'Make the goal unimportant'),
            ],
        },
        {
            'order': 3, 'title': 'Public Speaking for Youth Leaders', 'duration': 20,
            'content': (
                'Leaders often need to speak: in meetings, assemblies and community events.\n\n'
                '**Prepare:** know your audience and your main message. Keep to two or three key points.\n\n'
                '**Structure:** a clear opening, a body with your key points, and a closing that tells people what to do next.\n\n'
                '**Delivery:** speak clearly, at a steady pace, look at the audience, and use simple words.\n\n'
                '**Practice:** rehearse out loud. Nervousness is normal and gets smaller with practice.'
            ),
            'questions': [
                q('What should you know before you speak?', 'Knowing the audience and message makes the talk clear and useful.',
                  'Your audience and your main message', 'Only how long you can talk',
                  'Nothing, speak without preparing', 'Only the names of the guests'),
                q('How many key points work best in a short talk?', 'Two or three key points are easier to remember.',
                  'Two or three', 'As many as possible', 'None', 'Twenty'),
                q('A good talk usually has:', 'A clear opening, body and closing make a talk easy to follow.',
                  'An opening, a body with key points and a closing', 'Only a long body',
                  'A closing without any message', 'Many unrelated topics'),
                q('What helps with nervousness?', 'Practice out loud makes the talk familiar and reduces nervousness.',
                  'Rehearsing out loud', 'Avoiding practice', 'Speaking as fast as possible', 'Reading every word without looking up'),
            ],
        },
    ],
}


def merge(content):
    """Add the extra lessons to the exported content (in place). The SK courses live in lms_content_sk."""
    lead = content['Youth Leadership and Communication']['modules']
    if not any(m['order'] == LEADERSHIP_NEW_MODULE['order'] for m in lead):
        lead.append(LEADERSHIP_NEW_MODULE)
    return content
