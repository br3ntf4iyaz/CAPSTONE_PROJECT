"""
seed_quiz_questions.py
======================
Run from the /backend directory:
    python seed_quiz_questions.py

What it does
------------
1. Renames the generic "Lesson X.X: Core Concept Y" lessons in Courses 1-5
   with real titles and proper content.
2. Adds 4 multiple-choice questions per lesson (with explanations).
3. Skips lessons that already have questions (idempotent).
"""

import os, sys, django

sys.path.insert(0, ".")
os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")
django.setup()

from apps.courses.models import Lesson, CourseModule, Question, QuestionChoice  # noqa

# ---------------------------------------------------------------------------
# Lesson data: keyed by lesson DB id
# ---------------------------------------------------------------------------
# Format:
#   lesson_id: {
#       "title": str,
#       "content": str,
#       "questions": [
#           {
#               "text": str,
#               "explanation": str,
#               "choices": [{"text": str, "is_correct": bool}, ...]
#           }
#       ]
#   }

LESSON_DATA = {

    # ── Course 1: Leadership Fundamentals ──────────────────────────────────────
    1: {
        "title": "What Is Leadership?",
        "content": (
            "Leadership is the ability to guide, inspire, and influence others toward a shared goal. "
            "It is not a position or title — it is a choice to act with purpose and serve others.\n\n"
            "**Why leadership matters for youth:**\n"
            "Young people in the Philippines are at the forefront of social change. "
            "Whether you are an SK official, a student council officer, or an active community member, "
            "understanding the core of leadership will shape how you serve your barangay and your peers.\n\n"
            "**Key characteristics of effective leaders:**\n"
            "Great leaders share common traits: integrity (doing what is right even when no one is watching), "
            "empathy (understanding the needs of others), accountability (owning both successes and failures), "
            "and vision (seeing opportunities where others see obstacles).\n\n"
            "Remember: A leader without followers is just a person taking a walk. "
            "True leadership is earned through consistent action and genuine care for the people you serve."
        ),
    },
    2: {
        "title": "Types of Leadership Styles",
        "content": (
            "There is no single 'correct' way to lead. Different situations call for different approaches. "
            "Understanding the major leadership styles will help you choose the right one for the right moment.\n\n"
            "**Transformational Leadership:** Inspires change by painting a compelling vision of the future. "
            "Best when the group needs motivation and a new direction.\n\n"
            "**Servant Leadership:** Puts the needs of the team first. "
            "The leader's job is to remove obstacles and empower others. "
            "This style is especially valued in community service and barangay governance.\n\n"
            "**Democratic Leadership:** Makes decisions through group participation. "
            "Builds ownership and buy-in but can be slow when quick decisions are needed.\n\n"
            "**Situational Leadership:** Adapts the leadership style to the readiness and skill level of the team. "
            "This is considered the most flexible and practical model for real-world use.\n\n"
            "The best leaders are not locked into one style — they read the room and adapt."
        ),
    },
    3: {
        "title": "Self-Leadership: Leading Yourself First",
        "content": (
            "Before you can lead others, you must be able to lead yourself. "
            "Self-leadership is the practice of managing your own mindset, habits, and actions.\n\n"
            "**Key principles of self-leadership:**\n\n"
            "**1. Self-awareness** — Know your strengths, weaknesses, values, and triggers. "
            "Leaders who lack self-awareness make decisions based on ego rather than reality.\n\n"
            "**2. Self-discipline** — Doing what needs to be done even when you don't feel like it. "
            "Meetings, deadlines, and commitments must be honored.\n\n"
            "**3. Growth mindset** — Believing that abilities can be developed through effort and learning. "
            "Challenges are opportunities, not threats.\n\n"
            "**4. Time management** — Prioritizing tasks by importance, not just urgency. "
            "Use tools like to-do lists, calendars, and the Eisenhower Matrix.\n\n"
            "Practice: Start a 'wins journal' — write down one thing you did well and one thing you can improve each day."
        ),
    },
    4: {
        "title": "Building a Vision",
        "content": (
            "A vision is a clear and inspiring picture of the future you want to create. "
            "It answers the question: 'Where are we going?'\n\n"
            "**Why vision matters:**\n"
            "Teams without vision drift. They complete tasks but lose sight of the bigger purpose. "
            "A compelling vision aligns energy, motivates people through hardship, and provides a framework for decisions.\n\n"
            "**Characteristics of a strong vision:**\n"
            "- **Clear** — Easy to understand and communicate in one sentence\n"
            "- **Inspiring** — Creates genuine excitement and hope\n"
            "- **Challenging but achievable** — Stretches the team without being impossible\n"
            "- **Long-term** — Points to a future state, not just next week\n\n"
            "**How to craft your vision:**\n"
            "Ask: 'What will be different in our barangay / school / organization in 3 years because of our work?' "
            "Write a draft. Share it. Refine it with your team until it resonates with everyone.\n\n"
            "Example: 'A Lucena City where every young person has the skills, confidence, and opportunities to lead and succeed.'"
        ),
    },
    5: {
        "title": "Decision-Making Under Pressure",
        "content": (
            "Leaders face hard decisions constantly — often with incomplete information and time pressure. "
            "Learning to decide well under stress is one of the most valuable skills you can develop.\n\n"
            "**Common decision-making pitfalls:**\n"
            "- **Analysis paralysis** — Overthinking until the moment passes\n"
            "- **Groupthink** — Going along with the crowd to avoid conflict\n"
            "- **Recency bias** — Giving too much weight to recent events\n"
            "- **Sunk cost fallacy** — Continuing a failing plan because of past investment\n\n"
            "**A simple decision framework:**\n"
            "1. Define the decision clearly — What exactly needs to be decided?\n"
            "2. Gather key facts — What do you know? What don't you know?\n"
            "3. Identify your options — List at least 3 alternatives\n"
            "4. Consider consequences — Short-term and long-term for each option\n"
            "5. Decide and commit — Make the call and stand behind it\n"
            "6. Review — After the outcome, assess what you would do differently\n\n"
            "Remember: A good decision made quickly is often better than a perfect decision made too late."
        ),
    },
    6: {
        "title": "Inspiring and Motivating Others",
        "content": (
            "A leader's most powerful tool is the ability to move people — to turn 'I have to' into 'I want to.'\n\n"
            "**Intrinsic vs. Extrinsic Motivation:**\n"
            "Extrinsic motivation uses rewards (certificates, money, recognition) to drive behavior. "
            "It works in the short term but fades. "
            "Intrinsic motivation comes from within — purpose, mastery, autonomy. "
            "Great leaders tap into intrinsic motivation by connecting work to meaning.\n\n"
            "**Practical motivation strategies:**\n"
            "- **Connect to purpose** — Remind your team WHY the work matters\n"
            "- **Celebrate wins** — Small victories build momentum; acknowledge effort publicly\n"
            "- **Give autonomy** — Trust people with real responsibility; micromanagement kills motivation\n"
            "- **Invest in growth** — Offer learning opportunities; people stay when they grow\n"
            "- **Model the behavior** — Be the hardest worker, the most positive voice, the most reliable person\n\n"
            "Quote to remember: 'People don't care how much you know until they know how much you care.' — Theodore Roosevelt"
        ),
    },

    # ── Course 2: Youth Governance 101 ─────────────────────────────────────────
    7: {
        "title": "What Is Youth Governance?",
        "content": (
            "Youth governance refers to the formal and informal ways young people participate in decision-making "
            "processes that affect their lives and communities.\n\n"
            "**Why it matters in the Philippines:**\n"
            "The Philippines has one of the youngest populations in Southeast Asia. "
            "Youth between 15 and 30 years old make up roughly 30% of the total population. "
            "The government recognizes this through legislation like the National Youth Commission (NYC) Act "
            "and the Sangguniang Kabataan Reform Act (RA 10742).\n\n"
            "**Levels of youth participation:**\n"
            "- **Barangay level** — SK Barangay councils and barangay assemblies\n"
            "- **City/Municipal level** — SK Federation councils and local youth development programs\n"
            "- **National level** — National Youth Commission, youth representatives in Congress\n\n"
            "**Key principle:** Good governance requires participation, transparency, and accountability — "
            "and youth must be active participants, not passive recipients."
        ),
    },
    8: {
        "title": "Philippine Youth Laws and Policies",
        "content": (
            "Understanding the laws that protect and empower young Filipinos is essential for any youth leader.\n\n"
            "**Key legislation:**\n\n"
            "**Republic Act 8044 — Youth in Nation-Building Act:**\n"
            "Created the National Youth Commission (NYC). Mandates the formulation of a National Youth Policy "
            "and the establishment of comprehensive youth development programs.\n\n"
            "**Republic Act 10742 — SK Reform Act of 2015:**\n"
            "Revived the Sangguniang Kabataan and reformed its structure. "
            "Sets qualifications, terms of office, and mandates for SK officials. "
            "Mandates an Annual SK Plan and Budget.\n\n"
            "**Republic Act 7610 — Special Protection of Children Act:**\n"
            "Protects children from abuse, exploitation, and discrimination. "
            "Every SK official must know this law.\n\n"
            "**Republic Act 9262 — Anti-Violence Against Women and Children Act:**\n"
            "Addresses gender-based violence. Youth leaders have a role in awareness and referral.\n\n"
            "Tip: Download the full text of RA 10742 from the NYC website. "
            "Read at least the first 20 sections — they directly affect your duties."
        ),
    },
    9: {
        "title": "The Role of Youth in Local Government",
        "content": (
            "Young people are not just future leaders — they are leaders right now. "
            "The local government structure in the Philippines provides formal roles for youth participation.\n\n"
            "**The SK in the LGU structure:**\n"
            "The SK Chairperson is an ex-officio member of the Sangguniang Barangay (SB). "
            "This means you have a seat at the table — a vote in barangay legislation. "
            "This is a significant responsibility that must be taken seriously.\n\n"
            "**Rights of the SK in barangay governance:**\n"
            "- Propose ordinances and resolutions\n"
            "- Access barangay financial records\n"
            "- Participate in barangay planning and budgeting\n"
            "- Implement youth-focused programs with the SK fund\n\n"
            "**Common challenges:**\n"
            "Many young officials face skepticism from older barangay officials or struggle to be heard. "
            "The key is preparation: come to every meeting with data, well-researched proposals, and professional conduct. "
            "Credibility is earned through competence and consistency."
        ),
    },
    10: {
        "title": "Participating in Barangay Governance",
        "content": (
            "Effective participation in barangay governance goes beyond showing up for meetings. "
            "It requires preparation, collaboration, and follow-through.\n\n"
            "**The Barangay Development Council (BDC):**\n"
            "The BDC is the planning body of the barangay. It formulates the Annual Investment Plan (AIP) "
            "and the Barangay Development Plan (BDP). The SK Chairperson is a member and should actively contribute.\n\n"
            "**How to maximize your participation:**\n"
            "1. **Attend all meetings** — Absences weaken your voice and your credibility\n"
            "2. **Come prepared** — Read the agenda, do research, bring proposals\n"
            "3. **Represent youth** — Your job is to bring the youth perspective; consult your constituents\n"
            "4. **Form alliances** — Build relationships with other officials to advance shared goals\n"
            "5. **Document everything** — Keep records of resolutions, minutes, and decisions\n\n"
            "**Barangay Assembly participation:**\n"
            "Barangay assemblies are public forums where all residents can voice concerns. "
            "Encourage youth in your barangay to attend and speak up."
        ),
    },
    11: {
        "title": "Writing Resolutions and Ordinances",
        "content": (
            "One of the most powerful tools of a barangay official is the ability to create law at the local level. "
            "Resolutions and ordinances give your decisions legal force.\n\n"
            "**Resolution vs. Ordinance:**\n"
            "A **resolution** expresses the sense or position of the council on a specific matter. "
            "It does not require a public hearing and is passed by majority vote. "
            "An **ordinance** has the force of law in the barangay. "
            "It requires a public hearing before passage and must be posted for public information.\n\n"
            "**Structure of a basic resolution:**\n"
            "1. Header: Council name, resolution number, title\n"
            "2. Whereas clauses: Background and justification (state the facts)\n"
            "3. Resolved clause: What the council decides\n"
            "4. Signatures: All voting members\n\n"
            "**Common topics for SK resolutions:**\n"
            "- Approving the Annual SK Plan and Budget\n"
            "- Endorsing scholarship applications\n"
            "- Requesting barangay support for youth programs\n"
            "- Expressing support for national or city youth initiatives\n\n"
            "Always have a barangay secretary or legal counsel review drafts before formal submission."
        ),
    },
    12: {
        "title": "Accountability and Transparency in Governance",
        "content": (
            "Accountability and transparency are the foundations of good governance. "
            "Without them, public trust erodes and resources are wasted.\n\n"
            "**What accountability means for SK officials:**\n"
            "You are stewards of public funds and public trust. "
            "Every peso of the SK fund must be accounted for. "
            "Every decision must be documented. Every promise must be either kept or formally revisited.\n\n"
            "**Tools for transparency:**\n"
            "- **Public posting** — Post the SK Annual Budget and financial reports in visible barangay locations\n"
            "- **Open meetings** — Invite youth constituents to observe council sessions\n"
            "- **Regular reporting** — Provide quarterly updates to the barangay assembly\n"
            "- **Social media** — Use your official SK social media to share updates, expenses, and activities\n\n"
            "**Anti-corruption principles:**\n"
            "Corruption can occur even without intent — improper procurement, undocumented cash advances, "
            "ghost beneficiaries. Learn the Commission on Audit (COA) rules applicable to SK. "
            "When in doubt, ask the barangay treasurer or DILG office.\n\n"
            "Remember: Public office is a public trust (Philippine Constitution, Article XI)."
        ),
    },

    # ── Course 3: Communication Skills for Leaders ─────────────────────────────
    13: {
        "title": "The Fundamentals of Effective Communication",
        "content": (
            "Communication is the process of sharing information, ideas, or feelings between people. "
            "For leaders, it is the single most important skill for building trust, alignment, and results.\n\n"
            "**The communication process:**\n"
            "Sender → Message → Channel → Receiver → Feedback\n\n"
            "Every step can introduce a breakdown. The sender may be unclear. "
            "The message may be poorly worded. The channel (text, in person, email) may be wrong for the context. "
            "The receiver may misinterpret. Feedback may be absent.\n\n"
            "**Barriers to effective communication:**\n"
            "- **Language differences** — Jargon, dialect, or vocabulary gaps\n"
            "- **Emotional state** — Anger, anxiety, or distraction\n"
            "- **Cultural differences** — Different norms around directness, hierarchy, and non-verbal cues\n"
            "- **Physical noise** — Distractions in the environment\n"
            "- **Assumptions** — Thinking you know what the other person means without checking\n\n"
            "**The antidote:** Clarity + confirmation. Say what you mean, check that it landed, and invite questions."
        ),
    },
    14: {
        "title": "Active Listening",
        "content": (
            "Most people listen to respond — not to understand. Active listening is the discipline of genuinely "
            "absorbing what the other person is saying before formulating your response.\n\n"
            "**Why active listening is rare:**\n"
            "We think about 4 times faster than we speak. "
            "That spare mental capacity gets filled with our own thoughts, rebuttals, and distractions. "
            "True active listening requires redirecting that mental energy back to the speaker.\n\n"
            "**Active listening techniques:**\n"
            "- **Give full attention** — Put down your phone; make appropriate eye contact\n"
            "- **Don't interrupt** — Let the speaker finish, especially in emotional conversations\n"
            "- **Reflect back** — 'So what you're saying is...' — paraphrase to confirm understanding\n"
            "- **Ask clarifying questions** — 'Can you tell me more about...?' or 'What do you mean by...?'\n"
            "- **Acknowledge emotions** — 'I can hear that this is frustrating for you.'\n"
            "- **Avoid judgment** — Suspend evaluation until you have the full picture\n\n"
            "Practice: In your next conversation, challenge yourself to ask two follow-up questions before sharing your own opinion."
        ),
    },
    15: {
        "title": "Public Speaking Basics",
        "content": (
            "Public speaking ranks as one of the most common fears — but it is also one of the most learnable skills. "
            "As a youth leader, you will regularly need to address groups, facilitate meetings, and represent your community.\n\n"
            "**Preparation is 80% of the work:**\n"
            "Know your audience, know your material, and know your purpose. "
            "What do you want the audience to feel, think, or do after you speak?\n\n"
            "**Structure every speech:**\n"
            "- **Opening** — Grab attention (story, question, striking fact)\n"
            "- **Body** — 2-3 clear main points with supporting evidence\n"
            "- **Closing** — Summarize and give a clear call to action\n\n"
            "**Delivery tips:**\n"
            "- **Speak slowly** — Nervousness speeds you up; consciously slow down\n"
            "- **Pause intentionally** — Silence emphasizes key points\n"
            "- **Use your body** — Stand tall, move purposefully, use gestures that match your words\n"
            "- **Make eye contact** — Look at individuals, not the crowd as a blur\n"
            "- **Record yourself** — The fastest way to improve is to watch your own delivery\n\n"
            "Remember: Perfect delivery is less important than genuine conviction. Audiences forgive stumbles but they reward passion."
        ),
    },
    16: {
        "title": "Written Communication: Emails and Reports",
        "content": (
            "In governance and community work, your writing represents you even when you are not in the room. "
            "Clear, professional written communication builds credibility.\n\n"
            "**The BLUF principle (Bottom Line Up Front):**\n"
            "Start with the most important information. Do not bury the ask or the conclusion at the end. "
            "Busy readers skim — put what matters first.\n\n"
            "**Writing effective emails:**\n"
            "- **Subject line** — Specific and informative: 'Request for Attendance — SK Planning Meeting June 15'\n"
            "- **Greeting** — Match the formality to the relationship\n"
            "- **Opening sentence** — State the purpose immediately\n"
            "- **Body** — One main topic per paragraph; use bullet points for lists\n"
            "- **Clear ask** — What do you need the reader to do and by when?\n"
            "- **Closing** — Polite and professional; avoid 'please ASAP'\n\n"
            "**Writing SK reports:**\n"
            "A good activity report includes: objective, activities conducted, participants (number and demographics), "
            "expenses incurred, outcomes, challenges, and recommendations. "
            "Attach photos and supporting documents. Submit within 5 working days after the activity."
        ),
    },
    17: {
        "title": "Non-Verbal Communication",
        "content": (
            "Research suggests that over 60% of the meaning in a conversation is conveyed non-verbally. "
            "Your body language, facial expressions, and tone of voice send powerful messages — "
            "sometimes contradicting your words.\n\n"
            "**Key non-verbal channels:**\n\n"
            "**Facial expressions:** The most universal form of non-verbal communication. "
            "A genuine smile involves both the mouth and the eyes (Duchenne smile). "
            "Fake smiles are easily detected.\n\n"
            "**Posture and body positioning:** Open posture (uncrossed arms, facing the speaker) signals receptiveness. "
            "Closed posture signals defensiveness or disinterest.\n\n"
            "**Proximity (personal space):** In Filipino culture, comfortable conversational distance is generally "
            "closer than in Western contexts. Be aware of cultural and gender norms.\n\n"
            "**Eye contact:** Sustained, comfortable eye contact signals confidence and respect. "
            "Avoiding eye contact can signal dishonesty or discomfort.\n\n"
            "**Voice tone and pace:** A calm, even tone projects confidence. "
            "Rising intonation at the end of statements makes you sound uncertain.\n\n"
            "Tip: Practice in front of a mirror or record a short video of yourself speaking."
        ),
    },
    18: {
        "title": "Conflict Resolution Through Communication",
        "content": (
            "Conflict is inevitable in any group. "
            "The measure of a leader is not whether conflict arises, but how skillfully it is resolved.\n\n"
            "**Types of conflict:**\n"
            "- **Task conflict** — Disagreement over how to accomplish a goal (often productive)\n"
            "- **Relationship conflict** — Personal friction between individuals (usually destructive)\n"
            "- **Process conflict** — Disagreement over roles and responsibilities\n\n"
            "**The DESC model for conflict resolution:**\n"
            "1. **Describe** — State the behavior objectively, without judgment: 'I noticed that...'\n"
            "2. **Express** — Share how it affects you: 'I feel... when...'\n"
            "3. **Specify** — State what you need: 'What I need is...'\n"
            "4. **Consequences** — Explain the positive outcome of change: 'If this happens, we will...'\n\n"
            "**Mediation basics:**\n"
            "When two others are in conflict, a leader can mediate by: "
            "creating a safe space, hearing both sides without taking sides, "
            "identifying common ground, and facilitating agreement on a path forward.\n\n"
            "Key rule: Attack the problem, not the person."
        ),
    },

    # ── Course 4: Financial Literacy for SK ────────────────────────────────────
    19: {
        "title": "Understanding the SK Budget",
        "content": (
            "The SK Fund is your most direct resource as an SK official. "
            "Understanding where it comes from, how much it is, and what it can be used for "
            "is your first financial literacy priority.\n\n"
            "**Source of SK funds:**\n"
            "Under RA 10742, the SK receives 10% of the barangay's annual Internal Revenue Allotment (IRA). "
            "The barangay receives its share of the national IRA, and 10% of that share goes to the SK.\n\n"
            "**How SK funds are structured:**\n"
            "- **60% Programs, Projects, and Activities (PPAs)** — For actual youth programs\n"
            "- **20% Youth Development Fund (YDF)** — Capacity building, trainings, scholarships\n"
            "- **20% Administrative expenses** — Office supplies, utilities, personnel support\n\n"
            "**Key requirement:**\n"
            "The SK Annual Plan and Budget (SKAPB) must be approved by the SK Council before implementation. "
            "Spending without an approved budget is a COA (Commission on Audit) finding.\n\n"
            "Practical tip: Always keep a copy of the approved SKAPB with you and refer to it before any expenditure."
        ),
    },
    20: {
        "title": "How SK Funds Are Allocated and Disbursed",
        "content": (
            "Knowing how money moves through the SK system prevents costly mistakes and potential legal liability.\n\n"
            "**The disbursement process:**\n"
            "1. An activity is in the approved SKAPB\n"
            "2. SK Chairperson requests funding through the Barangay Treasurer\n"
            "3. Barangay Council approves the disbursement voucher\n"
            "4. Funds are released and used for the activity\n"
            "5. Liquidation report submitted within 30 days\n\n"
            "**Procurement rules:**\n"
            "The SK must follow Republic Act 9184 (Government Procurement Reform Act). "
            "For small purchases (below the threshold for public bidding), "
            "small value procurement or shopping procedures apply. "
            "For larger amounts, public bidding is required.\n\n"
            "**Liquidation requirements:**\n"
            "Every peso spent must be documented with official receipts (ORs). "
            "Unliquidated cash advances are among the most common COA findings for SK officials. "
            "Submit liquidation reports on time — within 30 days of completing the activity.\n\n"
            "Never use SK funds for personal expenses, even temporarily. "
            "This constitutes malversation of public funds."
        ),
    },
    21: {
        "title": "Procurement and Bidding Rules for SK",
        "content": (
            "Procurement is the process by which the government purchases goods, services, or infrastructure. "
            "Even at the barangay SK level, procurement must follow Republic Act 9184.\n\n"
            "**Procurement methods used by SK:**\n\n"
            "**Shopping (Section 52):** Used for readily available goods and ordinary office supplies. "
            "Requires at least three price quotations from different suppliers.\n\n"
            "**Small Value Procurement (Section 53.9):** For amounts below the public bidding threshold. "
            "Requires publication on the PhilGEPS website (or barangay bulletin board for very small amounts).\n\n"
            "**Direct Contracting:** Only in very limited cases — items with a single supplier, "
            "proprietary goods, or emergency situations. Requires full justification.\n\n"
            "**Red flags that indicate procurement violations:**\n"
            "- Splitting of purchases to avoid the bidding threshold\n"
            "- Purchasing from a supplier before getting price quotations\n"
            "- Falsifying official receipts or delivery receipts\n"
            "- Awarding contracts to relatives (nepotism)\n\n"
            "When in doubt, consult the barangay treasurer or the DILG before proceeding."
        ),
    },
    22: {
        "title": "Financial Reporting Requirements",
        "content": (
            "Transparency in financial management is both a legal obligation and an ethical one. "
            "SK officials must submit required financial reports on time.\n\n"
            "**Key financial reports required of the SK:**\n\n"
            "**Annual SK Plan and Budget (SKAPB):**\n"
            "Prepared before the start of each fiscal year. Lists all planned programs, activities, and expenses. "
            "Must be approved by the SK Council and the Sangguniang Barangay.\n\n"
            "**Quarterly Financial Report:**\n"
            "Summarizes income and expenditures for each quarter. "
            "Submitted to the barangay treasurer and posted publicly.\n\n"
            "**Annual Financial Report:**\n"
            "Year-end summary of all SK financial transactions. "
            "Subject to COA audit.\n\n"
            "**Liquidation Reports:**\n"
            "Submitted after every activity that used SK funds. "
            "Must include official receipts, attendance sheets, and photos.\n\n"
            "**Consequences of non-compliance:**\n"
            "Failure to submit reports can result in withholding of future funds, "
            "suspension from office, or criminal liability for malversation."
        ),
    },
    23: {
        "title": "Preventing Corruption and Misuse of Funds",
        "content": (
            "Corruption does not always look like blatant theft. "
            "It often starts with small compromises that gradually grow. "
            "Understanding the forms of corruption and the systems to prevent it protects you, your team, and your community.\n\n"
            "**Common forms of corruption in local government:**\n"
            "- **Ghost beneficiaries** — Claiming funds for non-existent people or activities\n"
            "- **Overpricing** — Paying more than market price for goods (kickbacks)\n"
            "- **Ghost deliveries** — Signing delivery receipts for goods never received\n"
            "- **Fund diversion** — Using public funds for personal or political purposes\n\n"
            "**Systems that prevent corruption:**\n"
            "- **Separation of duties** — The person who approves spending should not be the one who handles cash\n"
            "- **Official receipts for everything** — No OR = no payment, no reimbursement\n"
            "- **Public posting** — Post the SK budget and expense reports where constituents can see them\n"
            "- **Youth participation** — Involve youth volunteers in monitoring activities and expenses\n\n"
            "Remember: You are accountable to your constituents, the COA, and the law. "
            "When someone pressures you to cut corners, the answer is always no."
        ),
    },
    24: {
        "title": "Budget Planning for SK Programs",
        "content": (
            "A well-planned budget is the backbone of effective program delivery. "
            "It transforms ideas into concrete, fundable activities.\n\n"
            "**Steps in SK budget planning:**\n\n"
            "1. **Consult your constituents** — Conduct a simple needs assessment. "
            "Ask youth in your barangay: 'What do you need most?' Their answers should drive your priorities.\n\n"
            "2. **Identify priority programs** — Choose 3-5 activities that respond to the top needs. "
            "Think about the GYCED (General Youth Empowerment and Civic Education Development) framework.\n\n"
            "3. **Cost each activity** — List every expense: venue, materials, food, transportation, tokens. "
            "Get actual price quotations from suppliers.\n\n"
            "4. **Allocate to budget lines** — Match each expense to the correct budget category (PPAs, YDF, Admin).\n\n"
            "5. **Build in contingency** — Add 5-10% for unexpected costs.\n\n"
            "6. **Present and defend** — Present the budget to your SK Council. "
            "Every line item must be justified.\n\n"
            "Tip: Use a simple spreadsheet with columns for: Activity, Budget Line, Estimated Cost, Actual Cost, Variance."
        ),
    },

    # ── Course 5: Digital Skills for Youth Leaders ─────────────────────────────
    25: {
        "title": "Digital Literacy Basics",
        "content": (
            "Digital literacy is the ability to find, evaluate, create, and communicate information "
            "using digital technology. In today's world, it is as fundamental as reading and writing.\n\n"
            "**Core digital literacy skills:**\n"
            "- **Information literacy** — Finding credible sources, evaluating reliability, avoiding misinformation\n"
            "- **Communication literacy** — Using email, messaging apps, and social media professionally and safely\n"
            "- **Data literacy** — Reading and interpreting basic charts, statistics, and data visualizations\n"
            "- **Technical literacy** — Basic troubleshooting, file management, and software use\n\n"
            "**The fake news problem:**\n"
            "The Philippines is among the world's highest social media users. "
            "Misinformation spreads rapidly. Before sharing anything, ask:\n"
            "1. Who is the source?\n"
            "2. When was it published?\n"
            "3. Is it reported by other credible outlets?\n"
            "4. Does it match your own knowledge and common sense?\n\n"
            "Use tools like Google Reverse Image Search and fact-checking sites like VERA Files and Rappler Fact Check."
        ),
    },
    26: {
        "title": "Using Social Media for Advocacy",
        "content": (
            "Social media is one of the most powerful tools for youth advocacy — when used strategically. "
            "Millions of Filipinos are reachable through Facebook, TikTok, Instagram, and X (formerly Twitter).\n\n"
            "**Strategic social media for advocacy:**\n\n"
            "**1. Define your purpose**\n"
            "Are you raising awareness, driving action, or building community? "
            "Each goal requires a different content strategy.\n\n"
            "**2. Know your platform**\n"
            "- Facebook: Best for community groups, events, and longer-form updates\n"
            "- TikTok: Best for reaching the youngest audiences with short, creative content\n"
            "- Instagram: Visual storytelling — best for photos and short videos\n"
            "- X (Twitter): Real-time updates, hashtag campaigns, reaching media and officials\n\n"
            "**3. Create consistent, quality content**\n"
            "Post regularly. Use visuals. Keep captions clear and direct. "
            "Include a call to action: 'Share this,' 'Sign up here,' 'Attend on June 20.'\n\n"
            "**4. Engage authentically**\n"
            "Reply to comments. Thank supporters. Address critics respectfully.\n\n"
            "**5. Measure impact**\n"
            "Use platform analytics to see what content resonates. Double down on what works."
        ),
    },
    27: {
        "title": "Creating Effective Online Content",
        "content": (
            "Whether you are posting a program announcement, a call to action, or a community update, "
            "effective online content follows clear principles.\n\n"
            "**The AIDA model:**\n"
            "- **Attention** — Stop the scroll. Use a striking image, a bold headline, or an unexpected fact.\n"
            "- **Interest** — Build curiosity. Why should the reader care? What's in it for them?\n"
            "- **Desire** — Create urgency or aspiration. Make them want what you're offering.\n"
            "- **Action** — Tell them exactly what to do next: 'Register here,' 'DM us,' 'Share this post.'\n\n"
            "**Visual design basics:**\n"
            "- Use high-contrast text on backgrounds\n"
            "- Limit to 2-3 fonts and 2-3 colors per graphic\n"
            "- Leave white space — do not crowd the design\n"
            "- Use real photos from your activities whenever possible (stock photos feel generic)\n\n"
            "**Free tools for youth orgs:**\n"
            "Canva (design), CapCut (video editing), Google Forms (registration), "
            "Notion (content planning), Bitly (link shortening and tracking)\n\n"
            "Tip: Create a content calendar. Planning 2 weeks ahead removes the stress of last-minute posting."
        ),
    },
    28: {
        "title": "Online Safety and Cybersecurity",
        "content": (
            "As a youth leader with an online presence, you are a target for cybercriminals and malicious actors. "
            "Understanding online safety protects you, your organization, and your community.\n\n"
            "**Common cyber threats:**\n"
            "- **Phishing** — Fake emails or messages that trick you into revealing passwords or clicking malicious links\n"
            "- **Account hacking** — Unauthorized access to your email or social media accounts\n"
            "- **Cyberbullying and harassment** — Coordinated attacks on your reputation or mental health\n"
            "- **Identity theft** — Using your personal information for fraud\n\n"
            "**Basic cyber hygiene:**\n"
            "- **Use strong, unique passwords** — At least 12 characters, mix of letters/numbers/symbols\n"
            "- **Enable two-factor authentication (2FA)** on all important accounts\n"
            "- **Never click suspicious links** — Verify the sender before opening attachments\n"
            "- **Use a secure Wi-Fi connection** — Avoid banking or sensitive work on public Wi-Fi\n"
            "- **Keep software updated** — Updates often contain critical security patches\n\n"
            "**If you are hacked:**\n"
            "Change your passwords immediately, enable 2FA, notify your contacts, "
            "and report to the Cybercrime Division of the NBI or PNP."
        ),
    },
    29: {
        "title": "Google Tools for Youth Organizations",
        "content": (
            "Google Workspace offers free or low-cost tools that can dramatically improve the efficiency "
            "of youth organizations — from planning to documentation to communication.\n\n"
            "**Essential Google tools:**\n\n"
            "**Google Drive:** Cloud storage for all your files. "
            "Share folders with your SK council so everyone has access to the latest versions of documents. "
            "No more 'I didn't receive that file.'\n\n"
            "**Google Docs:** Collaborative document editing. "
            "Multiple people can edit simultaneously. Use it for drafting resolutions, letters, and reports.\n\n"
            "**Google Sheets:** Spreadsheets for budget tracking, attendance records, and data analysis. "
            "Use formulas for automatic calculations.\n\n"
            "**Google Forms:** Free survey and registration tool. "
            "Create forms for event registration, needs assessments, or feedback collection. "
            "Responses automatically populate a Google Sheet.\n\n"
            "**Google Meet:** Free video conferencing. "
            "Use it for remote council meetings, consultations with LGU officials, or online training.\n\n"
            "**Google Calendar:** Shared calendar for SK activities. "
            "Send event invitations to all council members automatically.\n\n"
            "Tip: Create a single shared Google Drive folder named 'SK [Your Barangay] Documents' "
            "and organize it by year and category."
        ),
    },
    30: {
        "title": "Data and Privacy Rights",
        "content": (
            "The Philippines has a comprehensive data privacy law. "
            "As a youth leader who collects information about constituents, you must understand your obligations.\n\n"
            "**Republic Act 10173 — Data Privacy Act of 2012:**\n"
            "This law protects the privacy of individuals and regulates the collection, use, and storage "
            "of personal information. It applies to all organizations — including SK councils — "
            "that handle personal data.\n\n"
            "**Key principles:**\n"
            "- **Transparency** — Tell people what data you are collecting and why\n"
            "- **Legitimate purpose** — Collect only data you actually need\n"
            "- **Proportionality** — Do not collect more data than necessary\n\n"
            "**Practical rules for SK:**\n"
            "- When collecting names, contact numbers, or addresses for program registration, "
            "inform participants that their data will only be used for program purposes\n"
            "- Do not share participant lists publicly without consent\n"
            "- Store data securely — password-protected files, limited access\n"
            "- Delete data when it is no longer needed\n\n"
            "**Youth digital rights:**\n"
            "Educate youth in your barangay about their rights: "
            "the right to access their data, the right to correct it, and the right to have it deleted."
        ),
    },
}

# ---------------------------------------------------------------------------
# Question bank: keyed by lesson id
# ---------------------------------------------------------------------------
QUESTIONS = {
    # Course 1: Leadership Fundamentals
    1: [
        {"text": "Which of the following best defines leadership?", "explanation": "Leadership is fundamentally about influence and service — guiding others toward a shared goal. It is not defined by a job title or position.",
         "choices": [("Being in a position of authority", False), ("The ability to guide and influence others toward a shared goal", True), ("Having the most experience in a group", False), ("Making all decisions without consulting the team", False)]},
        {"text": "Which trait involves doing what is right even when no one is watching?", "explanation": "Integrity is the alignment between values and actions, maintained even in the absence of external oversight.",
         "choices": [("Empathy", False), ("Accountability", False), ("Integrity", True), ("Vision", False)]},
        {"text": "A leader without followers is described as:", "explanation": "The quote from the lesson states: 'A leader without followers is just a person taking a walk.' Leadership requires people who choose to follow.",
         "choices": [("An autocratic leader", False), ("A visionary", False), ("Just a person taking a walk", True), ("A self-leader", False)]},
        {"text": "Which characteristic involves understanding and sharing the feelings of others?", "explanation": "Empathy is the ability to understand and share the feelings of another person — essential for leaders who serve diverse communities.",
         "choices": [("Vision", False), ("Accountability", False), ("Integrity", False), ("Empathy", True)]},
    ],
    2: [
        {"text": "Which leadership style puts the needs of the team members first?", "explanation": "Servant leadership prioritizes the needs of the people being led. The leader's role is to remove obstacles and empower others.",
         "choices": [("Transformational", False), ("Democratic", False), ("Servant", True), ("Autocratic", False)]},
        {"text": "Which style is best when a group needs a new direction and significant motivation?", "explanation": "Transformational leadership inspires change by painting a compelling vision of the future. It is most effective when the group needs to shift direction.",
         "choices": [("Servant", False), ("Transformational", True), ("Laissez-faire", False), ("Transactional", False)]},
        {"text": "The most flexible leadership model that adapts based on team readiness is:", "explanation": "Situational leadership adapts the style to the skill and willingness level of the team member. It is considered the most practical model for real-world leadership.",
         "choices": [("Democratic leadership", False), ("Transformational leadership", False), ("Situational leadership", True), ("Servant leadership", False)]},
        {"text": "Democratic leadership is least effective when:", "explanation": "Democratic leadership requires participation to make decisions, which takes time. It is least suited to situations that require fast, decisive action.",
         "choices": [("Building team buy-in is important", False), ("Quick decisions are urgently needed", True), ("Team expertise is high", False), ("Team motivation is low", False)]},
    ],
    3: [
        {"text": "What is the foundation of self-leadership?", "explanation": "Self-awareness — knowing your strengths, weaknesses, values, and triggers — is the foundation. You cannot effectively manage yourself without understanding yourself.",
         "choices": [("Time management", False), ("Self-awareness", True), ("Goal setting", False), ("Networking", False)]},
        {"text": "A growth mindset means:", "explanation": "A growth mindset is the belief that abilities and intelligence can be developed through effort and learning. Challenges are seen as opportunities.",
         "choices": [("You are born with fixed intelligence", False), ("Abilities can be developed through effort and learning", True), ("Only talented people can lead", False), ("Success comes from natural gifts alone", False)]},
        {"text": "Self-discipline is best described as:", "explanation": "Self-discipline is doing what needs to be done even when you don't feel like it — honoring commitments to yourself and others regardless of mood.",
         "choices": [("Always feeling motivated", False), ("Doing required tasks even when not feeling like it", True), ("Being strict with others", False), ("Setting very high standards", False)]},
        {"text": "The 'wins journal' practice recommended in this lesson involves:", "explanation": "Writing down one thing you did well AND one thing you can improve each day builds self-awareness through consistent reflection.",
         "choices": [("Listing all your achievements for the week", False), ("Writing one win and one improvement area each day", True), ("Recording your goals for the next month", False), ("Tracking how many tasks you completed daily", False)]},
    ],
    4: [
        {"text": "A vision answers which core question?", "explanation": "'Where are we going?' is the fundamental question a vision addresses. It provides direction and long-term purpose.",
         "choices": [("How do we improve this week?", False), ("Who is responsible for each task?", False), ("Where are we going?", True), ("What is our current budget?", False)]},
        {"text": "Which of these is NOT a characteristic of a strong vision?", "explanation": "A vision should be simple enough to communicate in one sentence. A complex, multi-page document is not a vision — it is a strategic plan.",
         "choices": [("Clear and easy to communicate", False), ("Inspiring and creates hope", False), ("Complex and multi-layered to cover all scenarios", True), ("Challenging but achievable", False)]},
        {"text": "Why is a team without a vision described as likely to 'drift'?", "explanation": "Without a vision, teams complete tasks but lose sight of the bigger purpose. They may work hard but in the wrong direction.",
         "choices": [("They spend too much time planning", False), ("They focus only on financial goals", False), ("They complete tasks without a clear bigger purpose", True), ("They become too competitive internally", False)]},
        {"text": "When crafting a vision, the recommended process is to:", "explanation": "A vision gains power when it is shared and refined with the people it affects. It should not be created in isolation.",
         "choices": [("Write it alone and announce it to the team", False), ("Copy a vision from a successful organization", False), ("Write a draft, share it, and refine with team input", True), ("Wait until the team reaches consensus on every word", False)]},
    ],
    5: [
        {"text": "What is 'analysis paralysis'?", "explanation": "Analysis paralysis occurs when overthinking and over-analyzing a situation prevents a decision from being made until the opportunity or deadline passes.",
         "choices": [("Making too many decisions at once", False), ("Overthinking until the moment to decide passes", True), ("Consulting too many people before deciding", False), ("Using data to support every decision", False)]},
        {"text": "The sunk cost fallacy in decision-making means:", "explanation": "The sunk cost fallacy is continuing to invest in a failing plan simply because of what has already been invested, rather than evaluating the future costs and benefits objectively.",
         "choices": [("Undervaluing past investments", False), ("Only using past experience to decide", False), ("Continuing a failing plan due to past investment", True), ("Avoiding risky decisions to minimize losses", False)]},
        {"text": "According to the decision framework, how many alternatives should you aim to identify?", "explanation": "The framework recommends listing at least three alternatives to avoid the trap of binary either/or thinking, which limits creative problem-solving.",
         "choices": [("At least one", False), ("Exactly two (pros and cons)", False), ("At least three alternatives", True), ("As many as possible, even if impractical", False)]},
        {"text": "Which statement best reflects the lesson's advice on timing decisions?", "explanation": "The lesson states: 'A good decision made quickly is often better than a perfect decision made too late.' Speed and quality must be balanced.",
         "choices": [("Always take maximum time to ensure a perfect decision", False), ("A good decision made quickly is often better than a perfect decision made too late", True), ("Never decide without unanimous agreement", False), ("Intuition is always more reliable than analysis", False)]},
    ],
    6: [
        {"text": "What is the key difference between intrinsic and extrinsic motivation?", "explanation": "Extrinsic motivation comes from external rewards (money, certificates). Intrinsic motivation comes from within — from purpose, mastery, and autonomy. Intrinsic motivation is more durable.",
         "choices": [("Intrinsic motivation uses rewards; extrinsic comes from within", False), ("Extrinsic motivation uses rewards; intrinsic comes from within", True), ("Both types rely on public recognition", False), ("Intrinsic motivation only works for experienced leaders", False)]},
        {"text": "Which motivation strategy involves connecting work to its larger meaning?", "explanation": "'Connect to purpose' means reminding the team WHY their work matters beyond the task itself. It is the most powerful long-term motivator.",
         "choices": [("Give autonomy", False), ("Celebrate wins", False), ("Connect to purpose", True), ("Model the behavior", False)]},
        {"text": "The quote 'People don't care how much you know until they know how much you care' is attributed to:", "explanation": "This quote is attributed to Theodore Roosevelt and captures the essence of relational leadership — caring for people is the prerequisite for influence.",
         "choices": [("Mahatma Gandhi", False), ("Theodore Roosevelt", True), ("Nelson Mandela", False), ("Abraham Lincoln", False)]},
        {"text": "Micromanagement is described in this lesson as:", "explanation": "The lesson explicitly states that micromanagement kills motivation by removing autonomy — people need to feel trusted with real responsibility.",
         "choices": [("An effective way to maintain quality", False), ("Necessary for inexperienced teams", False), ("Something that kills motivation", True), ("A form of transformational leadership", False)]},
    ],

    # Course 2: Youth Governance 101
    7: [
        {"text": "Approximately what percentage of the Philippine population are youth (ages 15-30)?", "explanation": "The lesson states that youth between 15 and 30 years old make up roughly 30% of the total Philippine population.",
         "choices": [("10%", False), ("20%", False), ("30%", True), ("50%", False)]},
        {"text": "Which law created the National Youth Commission (NYC)?", "explanation": "Republic Act 8044, the Youth in Nation-Building Act, created the National Youth Commission and mandated the formulation of a National Youth Policy.",
         "choices": [("RA 10742", False), ("RA 8044", True), ("RA 9184", False), ("RA 7160", False)]},
        {"text": "Which of these is NOT listed as a key principle of good governance?", "explanation": "Good governance requires participation, transparency, and accountability. Competition is not listed as a principle — it can even be counterproductive in governance contexts.",
         "choices": [("Participation", False), ("Transparency", False), ("Accountability", False), ("Competition", True)]},
        {"text": "At what level of government does the SK Barangay council operate?", "explanation": "The SK Barangay council is the most local level — operating within individual barangays under the supervision of the Sangguniang Barangay.",
         "choices": [("National level", False), ("City/Municipal level", False), ("Barangay level", True), ("Provincial level", False)]},
    ],
    8: [
        {"text": "Which law revived and reformed the Sangguniang Kabataan?", "explanation": "RA 10742, known as the SK Reform Act of 2015, revived the SK and reformed its structure including qualifications, terms of office, and mandates.",
         "choices": [("RA 8044", False), ("RA 7610", False), ("RA 10742", True), ("RA 9262", False)]},
        {"text": "RA 7610 is specifically designed to protect:", "explanation": "Republic Act 7610 is the Special Protection of Children Act, which protects children from abuse, exploitation, and discrimination.",
         "choices": [("Women from domestic violence", False), ("Children from abuse and exploitation", True), ("Youth from cybercrime", False), ("Senior citizens from fraud", False)]},
        {"text": "RA 9262 addresses:", "explanation": "Republic Act 9262 is the Anti-Violence Against Women and Children Act, which addresses gender-based violence.",
         "choices": [("Youth unemployment", False), ("Anti-corruption measures", False), ("Violence against women and children", True), ("Child labor prevention", False)]},
        {"text": "The SK Reform Act mandates which financial planning document?", "explanation": "RA 10742 mandates that every SK must prepare an Annual SK Plan and Budget (SKAPB) to guide their programs and spending.",
         "choices": [("Monthly Cash Flow Statement", False), ("Annual SK Plan and Budget", True), ("Five-Year Development Plan", False), ("Quarterly Budget Review", False)]},
    ],
    9: [
        {"text": "What does 'ex-officio' mean in the context of the SK Chairperson's role in the Sangguniang Barangay?", "explanation": "'Ex-officio' means by virtue of the position. The SK Chairperson automatically becomes a member of the SB because they hold the SK Chairperson position — not through a separate election.",
         "choices": [("Elected separately by all barangay residents", False), ("A member by virtue of holding the SK Chairperson position", True), ("An honorary member without voting rights", False), ("Appointed by the Barangay Captain", False)]},
        {"text": "Which of the following is a RIGHT of the SK in barangay governance?", "explanation": "The SK has the right to propose ordinances and resolutions, making them an active legislative participant — not just an observer — in barangay governance.",
         "choices": [("Controlling the entire barangay budget", False), ("Vetoing Barangay Captain decisions", False), ("Proposing ordinances and resolutions", True), ("Hiring and firing barangay employees", False)]},
        {"text": "The lesson suggests the key to overcoming skepticism from older officials is:", "explanation": "Credibility is earned through competence and consistency — coming prepared to meetings with data and well-researched proposals, and behaving professionally.",
         "choices": [("Confronting older officials publicly", False), ("Building preparation, competence, and professional conduct", True), ("Seeking support from national politicians", False), ("Limiting participation to SK-specific topics only", False)]},
        {"text": "Why is it important for the SK Chairperson to consult youth before barangay council meetings?", "explanation": "The SK Chairperson's role is specifically to represent youth interests. Without consulting constituents, they are just voicing personal opinions, not representing the community.",
         "choices": [("To get permission from youth to attend", False), ("To bring the genuine youth perspective to governance", True), ("To build social media content", False), ("To avoid being questioned by older officials", False)]},
    ],
    10: [
        {"text": "What is the primary function of the Barangay Development Council (BDC)?", "explanation": "The BDC is the planning body of the barangay. It formulates the Annual Investment Plan (AIP) and the Barangay Development Plan (BDP).",
         "choices": [("Conducting barangay elections", False), ("Formulating the AIP and Barangay Development Plan", True), ("Approving all barangay expenditures", False), ("Managing the barangay police auxiliary", False)]},
        {"text": "According to the lesson, one of the most important things to do at barangay meetings is to:", "explanation": "Coming prepared — reading the agenda, doing research, and bringing proposals — is how you add value and build credibility in barangay meetings.",
         "choices": [("Speak as many times as possible", False), ("Arrive early and leave late", False), ("Come prepared with research and proposals", True), ("Focus only on youth-specific agenda items", False)]},
        {"text": "A barangay assembly is best described as:", "explanation": "A barangay assembly is a public forum open to all residents of the barangay — not just officials — where community concerns can be raised and addressed.",
         "choices": [("A meeting only for elected barangay officials", False), ("A public forum where all residents can voice concerns", True), ("A budget review session led by the barangay treasurer", False), ("A quarterly meeting between the barangay and the city government", False)]},
        {"text": "Why should the SK keep records of resolutions and minutes?", "explanation": "Documentation creates accountability, provides a legal record of decisions, and allows for tracking whether commitments were fulfilled.",
         "choices": [("For social media posting", False), ("As proof of attendance for COA purposes only", False), ("To create accountability and a legal record of decisions", True), ("To comply with a requirement for DILG accreditation", False)]},
    ],
    11: [
        {"text": "What is the main difference between a resolution and an ordinance?", "explanation": "An ordinance has the force of law and requires a public hearing. A resolution expresses the council's position on an issue but does not have the force of law.",
         "choices": [("Resolutions require more votes to pass", False), ("Ordinances require a public hearing and have the force of law; resolutions do not", True), ("Resolutions are permanent; ordinances expire", False), ("Ordinances can only be proposed by the Barangay Captain", False)]},
        {"text": "Which part of a resolution states the background and justification for the action?", "explanation": "The 'Whereas clauses' provide the factual background and justification that support the council's decision. They explain WHY the resolution is being passed.",
         "choices": [("The header", False), ("The resolved clause", False), ("The Whereas clauses", True), ("The signature block", False)]},
        {"text": "Before an ordinance can be passed by the Sangguniang Barangay, what must first occur?", "explanation": "Unlike resolutions, ordinances require a public hearing before passage. This gives community members the opportunity to comment on proposed local laws.",
         "choices": [("A public hearing must be conducted", True), ("The Barangay Captain must sign it", False), ("It must be endorsed by the DILG", False), ("All barangay residents must vote on it", False)]},
        {"text": "Which of the following is an appropriate topic for an SK resolution?", "explanation": "Approving the Annual SK Plan and Budget is a core function of the SK council that is formalized through a resolution.",
         "choices": [("Imposing barangay curfew hours", False), ("Approving the Annual SK Plan and Budget", True), ("Establishing barangay fines for littering", False), ("Creating a barangay police auxiliary unit", False)]},
    ],
    12: [
        {"text": "Which Philippine constitutional provision establishes that public office is a public trust?", "explanation": "Article XI of the Philippine Constitution states that 'public office is a public trust' — the foundation for accountability in government.",
         "choices": [("Article I", False), ("Article III (Bill of Rights)", False), ("Article XI", True), ("Article XVIII", False)]},
        {"text": "Which tool for transparency involves sharing SK financial information in publicly visible locations?", "explanation": "Public posting of budgets and expense reports where constituents can see them is a direct tool of transparency in local governance.",
         "choices": [("Open meetings", False), ("Social media", False), ("Public posting", True), ("Regular reporting", False)]},
        {"text": "Falsifying official receipts or delivery receipts in procurement is an example of:", "explanation": "Falsifying official documents is a form of fraud and corruption. It is a serious offense that can result in criminal liability.",
         "choices": [("A minor administrative error", False), ("A COA finding that can be settled easily", False), ("Fraud and corruption", True), ("An acceptable practice if funds are limited", False)]},
        {"text": "The lesson states that SK officials should learn the COA rules applicable to SK because:", "explanation": "Corruption can occur even without intent through improper procedures. Knowing the rules prevents accidental violations that could result in serious penalties.",
         "choices": [("They will be tested on it during the next DILG audit", False), ("Corruption can occur accidentally without knowing the rules", True), ("COA will withhold funds unless the SK can recite the rules", False), ("It is required before the SKAPB can be approved", False)]},
    ],

    # Course 3: Communication Skills for Leaders
    13: [
        {"text": "What is the correct sequence of the communication process?", "explanation": "The complete communication process goes: Sender → Message → Channel → Receiver → Feedback. Each step is a potential point of breakdown.",
         "choices": [("Message → Sender → Channel → Feedback → Receiver", False), ("Sender → Message → Channel → Receiver → Feedback", True), ("Receiver → Sender → Message → Feedback → Channel", False), ("Channel → Sender → Message → Receiver", False)]},
        {"text": "Which barrier to communication involves using technical language that others may not understand?", "explanation": "Jargon is a language difference — using specialized vocabulary that others may not know. It creates a gap between sender and receiver.",
         "choices": [("Emotional state", False), ("Physical noise", False), ("Language differences (jargon)", True), ("Cultural differences", False)]},
        {"text": "The 'antidote' to communication barriers recommended in this lesson is:", "explanation": "The lesson recommends 'clarity + confirmation' — saying what you mean clearly and then checking that the message was received and understood as intended.",
         "choices": [("Speaking louder and more slowly", False), ("Clarity and confirmation", True), ("Using formal language at all times", False), ("Writing everything down instead of speaking", False)]},
        {"text": "An 'assumption' as a communication barrier means:", "explanation": "Assumptions occur when you believe you know what the other person means without actually checking. This leads to misunderstandings that could easily be avoided.",
         "choices": [("Using too many technical terms", False), ("Thinking you know what someone means without checking", True), ("Being distracted by noise in the environment", False), ("Having a different cultural background from the speaker", False)]},
    ],
    14: [
        {"text": "Why is genuinely active listening rare?", "explanation": "We think about 4 times faster than we speak, so our spare mental capacity gets filled with our own thoughts and rebuttals rather than focusing on the speaker.",
         "choices": [("Most people are naturally self-centered", False), ("We think much faster than we speak, leaving mental capacity for our own thoughts", True), ("Listening is a skill that requires formal training", False), ("Active listening is only possible in quiet environments", False)]},
        {"text": "Paraphrasing what a speaker said ('So what you're saying is...') is an example of:", "explanation": "Reflecting back the speaker's words by paraphrasing confirms your understanding and shows the speaker they have been truly heard.",
         "choices": [("Giving full attention", False), ("Asking clarifying questions", False), ("Reflecting back to confirm understanding", True), ("Avoiding judgment", False)]},
        {"text": "What does 'acknowledge emotions' mean in active listening?", "explanation": "'I can hear that this is frustrating for you' is an example of acknowledging emotions — validating the speaker's feelings without necessarily agreeing with their position.",
         "choices": [("Telling the speaker how they should feel", False), ("Validating the speaker's feelings without necessarily agreeing", True), ("Expressing your own emotions in response", False), ("Ignoring emotional content and focusing on facts", False)]},
        {"text": "The active listening practice challenge in this lesson is to:", "explanation": "The lesson challenges the reader to ask two follow-up questions before sharing their own opinion — building the habit of prioritizing understanding over responding.",
         "choices": [("Listen for at least 5 minutes before speaking", False), ("Ask two follow-up questions before sharing your opinion", True), ("Take detailed notes during every conversation", False), ("Maintain unbroken eye contact with the speaker", False)]},
    ],
    15: [
        {"text": "According to the lesson, what accounts for 80% of public speaking success?", "explanation": "Preparation is 80% of the work in public speaking — knowing your audience, your material, and your purpose before you ever step in front of a crowd.",
         "choices": [("Natural charisma and stage presence", False), ("Preparation", True), ("Memorizing the speech word-for-word", False), ("Dressing professionally", False)]},
        {"text": "The correct order of a well-structured speech is:", "explanation": "Every effective speech follows: Opening (grab attention) → Body (2-3 main points with evidence) → Closing (summary + call to action).",
         "choices": [("Body → Opening → Closing", False), ("Opening → Closing → Body", False), ("Opening → Body → Closing", True), ("Body → Closing → Opening", False)]},
        {"text": "Why should you intentionally slow down when nervous during a speech?", "explanation": "Nervousness physiologically speeds up our speech rate. Consciously slowing down counteracts this effect and makes the delivery clearer and more authoritative.",
         "choices": [("The audience will think you are more confident", False), ("Nervousness speeds you up, so slowing down counteracts it", True), ("Slow speech allows time to remember your memorized lines", False), ("Judges and evaluators prefer slower speakers", False)]},
        {"text": "What does the lesson say audiences value more than perfect delivery?", "explanation": "The lesson states: 'Audiences forgive stumbles but they reward passion.' Genuine conviction about your message is more persuasive than flawless technique.",
         "choices": [("Flawless grammar and vocabulary", False), ("Expensive visual aids and presentations", False), ("Genuine conviction and passion", True), ("Speaking for the full allotted time", False)]},
    ],
    16: [
        {"text": "What does 'BLUF' stand for in written communication?", "explanation": "BLUF stands for 'Bottom Line Up Front' — start with the most important information so that busy readers immediately know the key message.",
         "choices": [("Basic Layout Uniformity Format", False), ("Bottom Line Up Front", True), ("Brief Letter Unified Format", False), ("Brevity, Logic, Unity, Focus", False)]},
        {"text": "A good email subject line should be:", "explanation": "Subject lines should be specific and informative — like 'Request for Attendance — SK Planning Meeting June 15' — so the reader knows exactly what to expect before opening.",
         "choices": [("Short and vague to create curiosity", False), ("Specific and informative about the email's purpose", True), ("Formal and include the sender's full title", False), ("Written in all capitals for visibility", False)]},
        {"text": "Which of the following should appear at the BEGINNING of a well-written email?", "explanation": "The BLUF principle requires stating the purpose in the opening sentence — not burying it after lengthy context-setting.",
         "choices": [("Background context and history", False), ("The purpose of the email clearly stated", True), ("A detailed list of all attachments", False), ("A formal quotation or proverb", False)]},
        {"text": "A complete SK activity report should include which of the following?", "explanation": "An SK activity report must include objectives, activities conducted, participants, expenses, outcomes, challenges, and recommendations — a complete accountability record.",
         "choices": [("Only photos and a narrative paragraph", False), ("Objectives, participants, expenses, outcomes, and recommendations", True), ("Just the budget comparison (estimated vs. actual)", False), ("A summary of media coverage and social media reach", False)]},
    ],
    17: [
        {"text": "What percentage of conversational meaning is suggested to be conveyed non-verbally?", "explanation": "The lesson states that research suggests over 60% of the meaning in a conversation is conveyed non-verbally — through body language, facial expressions, and tone.",
         "choices": [("About 20%", False), ("About 40%", False), ("Over 60%", True), ("About 80%", False)]},
        {"text": "What characterizes a genuine (Duchenne) smile?", "explanation": "A genuine smile involves both the mouth AND the eyes. Fake smiles only involve the mouth, which is why they are easily detected by others.",
         "choices": [("It shows the teeth prominently", False), ("It involves both the mouth and eyes", True), ("It is held longer than 5 seconds", False), ("It is accompanied by laughter", False)]},
        {"text": "Open posture in a conversation signals:", "explanation": "Open posture (uncrossed arms, body facing the speaker) signals receptiveness and openness to the conversation. Closed posture signals defensiveness or disinterest.",
         "choices": [("Dominance and authority", False), ("Receptiveness and openness", True), ("Formality and professionalism", False), ("Disagreement with the speaker", False)]},
        {"text": "Rising intonation at the end of statements makes a speaker sound:", "explanation": "Rising intonation at the end of a statement (rather than a question) makes the speaker sound uncertain or as though seeking approval — undermining confidence.",
         "choices": [("Enthusiastic and energetic", False), ("Friendly and approachable", False), ("Uncertain or lacking confidence", True), ("Culturally aware and inclusive", False)]},
    ],
    18: [
        {"text": "Which type of conflict is generally described as productive?", "explanation": "Task conflict — disagreement over how to accomplish a goal — is often productive because it surfaces different perspectives and leads to better solutions.",
         "choices": [("Relationship conflict", False), ("Process conflict", False), ("Task conflict", True), ("Personality conflict", False)]},
        {"text": "In the DESC model, what does the 'E' stand for?", "explanation": "In DESC: D = Describe, E = Express (share how the behavior affects you), S = Specify (state what you need), C = Consequences (explain the positive outcome of change).",
         "choices": [("Evaluate", False), ("Express", True), ("Explain", False), ("Engage", False)]},
        {"text": "The principle 'attack the problem, not the person' means:", "explanation": "In conflict resolution, the focus must be on solving the issue at hand, not on criticizing the character or personality of the other person.",
         "choices": [("Be more aggressive in stating your position", False), ("Focus on resolving the issue rather than criticizing the person", True), ("Physical confrontation should be avoided", False), ("Problems should always be addressed in writing", False)]},
        {"text": "When a leader mediates a conflict between two others, they should:", "explanation": "A mediator creates a safe space, hears both sides without taking sides, finds common ground, and helps parties agree on a way forward. Taking sides undermines the mediation.",
         "choices": [("Side with the person who has seniority", False), ("Hear both sides without taking sides and find common ground", True), ("Make the final decision on who is right", False), ("Separate the parties and handle them individually from then on", False)]},
    ],

    # Course 4: Financial Literacy for SK
    19: [
        {"text": "What percentage of the barangay's IRA does the SK receive?", "explanation": "Under RA 10742, the SK receives 10% of the barangay's annual Internal Revenue Allotment (IRA).",
         "choices": [("5%", False), ("10%", True), ("20%", False), ("25%", False)]},
        {"text": "What percentage of SK funds is allocated for Programs, Projects, and Activities (PPAs)?", "explanation": "60% of SK funds must go to PPAs — actual youth programs and activities, not overhead expenses.",
         "choices": [("20%", False), ("40%", False), ("60%", True), ("80%", False)]},
        {"text": "What is the purpose of the Youth Development Fund (YDF)?", "explanation": "The YDF (20% of the SK fund) is specifically for capacity building — trainings, scholarships, and developing the skills of youth.",
         "choices": [("Administrative expenses like office supplies", False), ("Capacity building, trainings, and scholarships", True), ("Physical infrastructure projects", False), ("Emergency relief operations", False)]},
        {"text": "Spending SK funds without an approved SKAPB would likely result in:", "explanation": "Any expenditure not covered by an approved SKAPB would be flagged by the Commission on Audit (COA) as an unauthorized expenditure — a serious finding.",
         "choices": [("A simple reminder from DILG", False), ("A Commission on Audit (COA) finding", True), ("Suspension of the SK Chairperson immediately", False), ("A requirement to return the funds within 24 hours", False)]},
    ],
    20: [
        {"text": "Within how many days must a liquidation report be submitted after an SK activity?", "explanation": "The lesson states that liquidation reports must be submitted within 30 days of completing the activity. This is a firm requirement.",
         "choices": [("7 days", False), ("14 days", False), ("30 days", True), ("60 days", False)]},
        {"text": "Under RA 9184, what procurement method requires at least three price quotations?", "explanation": "Shopping (Section 52 of RA 9184) is used for readily available goods and requires at least three price quotations from different suppliers.",
         "choices": [("Direct contracting", False), ("Public bidding", False), ("Shopping", True), ("Small value procurement", False)]},
        {"text": "Using SK funds for personal expenses, even temporarily, constitutes:", "explanation": "Malversation of public funds is the misappropriation of public money, regardless of whether the intent is to return the funds later.",
         "choices": [("A temporary cash advance", False), ("Malversation of public funds", True), ("A minor administrative lapse", False), ("A loan from the SK fund", False)]},
        {"text": "Which document must be included in every liquidation report?", "explanation": "Official receipts (ORs) are the primary evidence that funds were legitimately spent. Without ORs, a liquidation cannot be completed.",
         "choices": [("A letter from the beneficiaries thanking the SK", False), ("Official receipts for all expenditures", True), ("A notarized affidavit from the SK Chairperson", False), ("A certificate from the city mayor", False)]},
    ],
    21: [
        {"text": "What is 'splitting of purchases' and why is it prohibited?", "explanation": "Splitting purchases means dividing one large purchase into smaller ones to keep each below the public bidding threshold. This is prohibited because it defeats the purpose of competitive procurement.",
         "choices": [("Sharing costs between barangays — it is encouraged", False), ("Dividing a large purchase to avoid the bidding threshold — it is prohibited", True), ("Buying from multiple suppliers for variety — it is best practice", False), ("Negotiating lower prices — it is allowed under certain conditions", False)]},
        {"text": "PhilGEPS is primarily used in government procurement for:", "explanation": "The Philippine Government Electronic Procurement System (PhilGEPS) is used to publish procurement notices and awards, ensuring transparency and equal access for suppliers.",
         "choices": [("Processing payroll for government employees", False), ("Publishing procurement notices for transparency", True), ("Storing government financial records", False), ("Managing the national budget", False)]},
        {"text": "When is direct contracting allowable in government procurement?", "explanation": "Direct contracting is only allowed in very limited cases: single-source items, proprietary goods, or genuine emergency situations. It always requires full justification.",
         "choices": [("Whenever the SK Chairperson determines it is most efficient", False), ("Only in specific cases like single suppliers or emergencies, with full justification", True), ("For any purchase below the small value procurement threshold", False), ("When at least two suppliers quote the same price", False)]},
        {"text": "Awarding a government contract to a relative of an official is an example of:", "explanation": "Nepotism in procurement is the practice of favoring relatives when awarding contracts. It is a form of corruption and conflict of interest that violates procurement law.",
         "choices": [("Standard business practice", False), ("Nepotism — a form of corruption and conflict of interest", True), ("Direct contracting, which is sometimes allowed", False), ("An acceptable practice if the relative offers the lowest price", False)]},
    ],
    22: [
        {"text": "Which financial report must be prepared BEFORE the start of the fiscal year?", "explanation": "The Annual SK Plan and Budget (SKAPB) must be prepared before the fiscal year begins, as it is the authorization for all planned spending.",
         "choices": [("Quarterly Financial Report", False), ("Annual SK Plan and Budget (SKAPB)", True), ("Monthly Expense Report", False), ("Year-End Audit Summary", False)]},
        {"text": "The Quarterly Financial Report is submitted to:", "explanation": "The Quarterly Financial Report is submitted to the barangay treasurer and must be posted publicly for transparency.",
         "choices": [("The National Youth Commission directly", False), ("The City Mayor's Office", False), ("The barangay treasurer and posted publicly", True), ("The Commission on Audit regional office", False)]},
        {"text": "How long after a COA audit can unsettled findings remain before criminal liability can arise?", "explanation": "The lesson notes that failure to comply with financial requirements can result in criminal liability — there is no specific 'safe window.' Accountability applies immediately.",
         "choices": [("6 months", False), ("1 year", False), ("Criminal liability can arise from non-compliance at any time", True), ("Only after a second consecutive audit finding", False)]},
        {"text": "Within how many days must a liquidation report be submitted after an activity?", "explanation": "The lesson reiterates that liquidation reports must be submitted within 30 days after every activity that used SK funds.",
         "choices": [("7 days", False), ("14 days", False), ("30 days", True), ("60 days", False)]},
    ],
    23: [
        {"text": "Claiming funds for non-existent people or activities is called:", "explanation": "Ghost beneficiaries is the practice of listing fictitious recipients to justify drawing funds that are then pocketed. It is a serious form of corruption.",
         "choices": [("Fund diversion", False), ("Ghost beneficiaries", True), ("Overpricing", False), ("Direct contracting abuse", False)]},
        {"text": "Which internal control principle separates the person who approves spending from the one who handles cash?", "explanation": "Separation of duties ensures that no single person controls all steps of a financial process — reducing the opportunity for fraud.",
         "choices": [("Transparency", False), ("Proportionality", False), ("Separation of duties", True), ("Audit trail maintenance", False)]},
        {"text": "Public posting of the SK budget and expense reports serves which function?", "explanation": "Making financial information publicly visible allows constituents to serve as a check — they can see what was planned and what was spent, and raise concerns if something doesn't add up.",
         "choices": [("It is required by DILG as a documentary requirement", False), ("It allows constituents to monitor SK finances", True), ("It satisfies the annual COA audit automatically", False), ("It is primarily for social media content purposes", False)]},
        {"text": "Overpricing in procurement means:", "explanation": "Overpricing occurs when government pays more than the market price for goods or services, often involving a kickback arrangement with the supplier.",
         "choices": [("Buying items that are too expensive for the budget", False), ("Paying more than market price, often with kickbacks involved", True), ("Ordering more items than are needed", False), ("Failing to get price quotations before purchasing", False)]},
    ],
    24: [
        {"text": "The first step in SK budget planning is:", "explanation": "The process begins with consulting constituents — conducting a needs assessment to determine what youth in your barangay actually need. Their input should drive priorities.",
         "choices": [("Listing all possible programs from DILG guidelines", False), ("Consulting your constituents through a needs assessment", True), ("Copying the previous year's budget", False), ("Checking how much money is available first", False)]},
        {"text": "What is the GYCED framework referenced in this lesson?", "explanation": "GYCED stands for General Youth Empowerment and Civic Education Development — it is the framework SK officials should use when selecting priority programs.",
         "choices": [("Government Youth Capacity Enhancement Division", False), ("General Youth Empowerment and Civic Education Development", True), ("Government Youth Community Engagement Department", False), ("General Youth Coordination and Economic Development", False)]},
        {"text": "Why should you get actual price quotations when costing SK activities?", "explanation": "Actual price quotations give you real market prices — using estimates or guesses leads to budgets that are either too high (wasted allocation) or too low (insufficient funds).",
         "choices": [("To avoid COA findings on overpricing", False), ("To get real market prices for accurate budget estimates", True), ("Because RA 9184 requires three quotations for all purchases", False), ("To build supplier relationships before the activity", False)]},
        {"text": "A contingency budget of 5-10% is recommended because:", "explanation": "Unexpected costs almost always arise in program implementation. A contingency reserve prevents activities from being cancelled or going over budget due to unforeseen expenses.",
         "choices": [("It is required by COA for all SK activities", False), ("Unexpected costs are nearly inevitable in program delivery", True), ("It allows for bonuses for SK volunteers", False), ("It creates a buffer to increase the SK fund over time", False)]},
    ],

    # Course 5: Digital Skills for Youth Leaders
    25: [
        {"text": "Which of the following is an example of information literacy?", "explanation": "Evaluating the reliability of an online article before sharing it is information literacy — the skill of critically assessing information sources.",
         "choices": [("Knowing how to format a document in Microsoft Word", False), ("Evaluating the reliability of an online article before sharing it", True), ("Being able to fix a broken Wi-Fi connection", False), ("Typing quickly without errors", False)]},
        {"text": "What tool can you use to check whether an image has been used in a different context online?", "explanation": "Google Reverse Image Search allows you to upload an image and see where else it has appeared online — useful for verifying whether photos are authentic or misattributed.",
         "choices": [("TinEye only", False), ("Google Reverse Image Search", True), ("Google News archives", False), ("Facebook Photo Checker", False)]},
        {"text": "The Philippines is notable in the context of social media because:", "explanation": "The lesson states that the Philippines is among the world's highest social media users — making digital literacy and media literacy especially critical.",
         "choices": [("It has the fastest internet speeds in Asia", False), ("It was the first country to regulate social media", False), ("It is among the world's highest social media users", True), ("Over 90% of Filipinos have smartphones", False)]},
        {"text": "Before sharing content on social media, you should verify:", "explanation": "The four verification questions are: Who is the source? When was it published? Is it reported by other credible outlets? Does it match your knowledge and common sense?",
         "choices": [("Only whether the post has many shares and likes", False), ("The source, publication date, corroboration, and plausibility", True), ("Whether it was posted by a verified account", False), ("Whether the content uses proper Filipino grammar", False)]},
    ],
    26: [
        {"text": "Which platform is best for reaching the YOUNGEST audiences with short, creative content?", "explanation": "TikTok's algorithm and format (short videos) make it the most effective platform for reaching Gen Z and the youngest youth demographics.",
         "choices": [("Facebook", False), ("X (Twitter)", False), ("TikTok", True), ("LinkedIn", False)]},
        {"text": "Which of the following is a good call to action for an advocacy post?", "explanation": "A specific, actionable CTA like 'Register by June 15 at this link' tells the audience exactly what to do and by when — the most effective form of CTA.",
         "choices": [("'Think about it and let us know'", False), ("'We need your support!'", False), ("'Register by June 15 at this link'", True), ("'Like this post if you agree'", False)]},
        {"text": "Platform analytics is recommended in this lesson for:", "explanation": "Using platform analytics to see which content resonates — and then creating more of what works — is the data-driven approach to social media advocacy.",
         "choices": [("Monitoring competitor organizations", False), ("Reporting social media abuse to authorities", False), ("Seeing what content resonates and doubling down on it", True), ("Calculating the SK's social media budget", False)]},
        {"text": "Engaging authentically on social media means:", "explanation": "Authentic engagement means genuinely responding to comments, thanking supporters, and addressing critics respectfully — not just broadcasting content and ignoring the audience.",
         "choices": [("Only posting official announcements", False), ("Replying to comments, thanking supporters, and addressing critics respectfully", True), ("Having a professional profile photo and bio", False), ("Posting at consistent times each day", False)]},
    ],
    27: [
        {"text": "In the AIDA model, what does the 'A' in the first position stand for?", "explanation": "The first 'A' in AIDA stands for Attention — stopping the scroll with a striking image, bold headline, or unexpected fact to make people pause.",
         "choices": [("Authority", False), ("Attention", True), ("Advocacy", False), ("Action", False)]},
        {"text": "Which design principle says to limit to 2-3 fonts and 2-3 colors?", "explanation": "Using too many fonts and colors creates visual clutter and looks unprofessional. Limiting to 2-3 of each creates visual consistency and focus.",
         "choices": [("High contrast text", False), ("Using 2-3 fonts and 2-3 colors for visual consistency", True), ("White space principle", False), ("AIDA model", False)]},
        {"text": "Which free tool is recommended for video editing for youth organizations?", "explanation": "CapCut is recommended in the lesson as a free video editing tool accessible to youth organizations creating digital content.",
         "choices": [("Adobe Premiere Pro", False), ("iMovie", False), ("CapCut", True), ("Final Cut Pro", False)]},
        {"text": "What is a 'content calendar' and why is it recommended?", "explanation": "A content calendar is a forward-looking plan of what to post and when. Planning 2 weeks ahead removes the stress of last-minute posting and ensures consistent output.",
         "choices": [("A real-time log of all posts published in the past month", False), ("A forward plan of what to post that removes last-minute stress", True), ("A subscription service that automatically generates content", False), ("A tool for tracking the number of followers over time", False)]},
    ],
    28: [
        {"text": "What is phishing?", "explanation": "Phishing is a cyber attack where fake messages (emails, texts, DMs) trick victims into revealing passwords or clicking malicious links.",
         "choices": [("Hacking into someone's email by guessing their password", False), ("Fake messages that trick you into revealing passwords or clicking malicious links", True), ("Stealing someone's personal data from a public Wi-Fi network", False), ("Posting defamatory content about someone online", False)]},
        {"text": "Two-factor authentication (2FA) protects your accounts by:", "explanation": "2FA adds a second layer of verification beyond your password — typically a code sent to your phone. Even if your password is stolen, the attacker cannot access your account without the second factor.",
         "choices": [("Encrypting your stored passwords", False), ("Requiring a second verification step beyond your password", True), ("Scanning your device for malware automatically", False), ("Blocking all login attempts from unknown locations", False)]},
        {"text": "Why should you avoid conducting sensitive work on public Wi-Fi?", "explanation": "Public Wi-Fi networks are often unsecured, making it easy for attackers to intercept data transmitted over the network — a 'man-in-the-middle' attack.",
         "choices": [("Public Wi-Fi is always slower than home networks", False), ("Unsecured public Wi-Fi allows others to intercept your data", True), ("It is technically illegal to use public Wi-Fi for official work", False), ("Public Wi-Fi automatically disables 2FA", False)]},
        {"text": "If your social media account is hacked, the immediate first step is:", "explanation": "Changing your password immediately is the first defensive action to lock out the attacker. Then enable 2FA, notify contacts, and report to authorities.",
         "choices": [("Report to the NBI first before doing anything else", False), ("Change your passwords immediately and enable 2FA", True), ("Delete the account to prevent further damage", False), ("Post a public announcement warning your followers", False)]},
    ],
    29: [
        {"text": "What is the primary purpose of Google Drive for a youth organization?", "explanation": "Google Drive provides cloud storage that enables collaboration — all council members can access the latest versions of documents without emailing files back and forth.",
         "choices": [("Creating presentations for public events", False), ("Cloud storage that enables real-time collaboration and document sharing", True), ("Editing photos and graphics for social media", False), ("Managing the SK's social media accounts", False)]},
        {"text": "Which Google tool automatically puts form responses into a spreadsheet?", "explanation": "Google Forms automatically populates responses into a Google Sheet — making it easy to analyze registration data or survey results without manual data entry.",
         "choices": [("Google Docs", False), ("Google Slides", False), ("Google Forms", True), ("Google Keep", False)]},
        {"text": "What does Google Sheets offer that regular paper budgets cannot?", "explanation": "Google Sheets uses formulas (like SUM, AVERAGE) that automatically calculate totals and update when values change — eliminating manual arithmetic errors.",
         "choices": [("Ability to share with multiple people", False), ("Automatic calculations using formulas", True), ("A more professional appearance", False), ("Secure cloud backup", False)]},
        {"text": "The recommended structure for organizing an SK's Google Drive folder is:", "explanation": "The lesson recommends creating a single shared folder named 'SK [Your Barangay] Documents' organized by year and category — a clear, accessible structure for the entire council.",
         "choices": [("A separate Drive for each SK council member", False), ("One shared folder named 'SK [Barangay] Documents' organized by year and category", True), ("Uploading all documents without folders for simplicity", False), ("Using a private folder only the Chairperson can access", False)]},
    ],
    30: [
        {"text": "Which Philippine law governs the protection and proper use of personal data?", "explanation": "Republic Act 10173, the Data Privacy Act of 2012, protects the privacy of individuals and regulates how organizations (including SK) collect, use, and store personal information.",
         "choices": [("RA 10742", False), ("RA 9184", False), ("RA 10173", True), ("RA 8044", False)]},
        {"text": "Which principle says you should collect only the data you actually need?", "explanation": "The principle of legitimate purpose + proportionality means you must have a valid reason for collecting data AND should not collect more than necessary for that purpose.",
         "choices": [("Transparency", False), ("Proportionality / Legitimate purpose", True), ("Accountability", False), ("Lawful processing", False)]},
        {"text": "When collecting participant data for an SK program, you are required to:", "explanation": "The Data Privacy Act requires informed consent — you must tell people what data you're collecting and why before they provide it.",
         "choices": [("Submit a data collection form to the NPC 30 days in advance", False), ("Inform participants about how their data will be used", True), ("Store all data in a COA-approved system", False), ("Get written permission from the barangay captain for each data collection", False)]},
        {"text": "Under the Data Privacy Act, individuals have the right to:", "explanation": "The law grants individuals three key rights: access their personal data, correct inaccurate data, and request deletion of data that is no longer needed.",
         "choices": [("Sue the organization for any data collection without prior notice", False), ("Access, correct, and request deletion of their personal data", True), ("Prohibit any government agency from collecting their data", False), ("Demand payment for use of their personal data", False)]},
    ],
}


def seed():
    created_lessons = 0
    created_questions = 0
    created_choices = 0

    for lesson_id, data in LESSON_DATA.items():
        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            print(f"  [SKIP] Lesson {lesson_id} not found in DB")
            continue

        # Update title and content
        lesson.title = data["title"]
        lesson.content = data["content"]
        lesson.save(update_fields=["title", "content"])
        created_lessons += 1
        print(f"  [OK] Lesson {lesson_id}: '{data['title']}'")

    for lesson_id, questions in QUESTIONS.items():
        try:
            lesson = Lesson.objects.get(pk=lesson_id)
        except Lesson.DoesNotExist:
            print(f"  [SKIP] Lesson {lesson_id} not found")
            continue

        if lesson.questions.exists():
            print(f"  [SKIP] Lesson {lesson_id} already has questions")
            continue

        for q_order, q_data in enumerate(questions):
            q = Question.objects.create(
                lesson=lesson,
                text=q_data["text"],
                explanation=q_data.get("explanation", ""),
                order=q_order,
            )
            created_questions += 1
            for c_order, (choice_text, is_correct) in enumerate(q_data["choices"]):
                QuestionChoice.objects.create(
                    question=q,
                    text=choice_text,
                    is_correct=is_correct,
                    order=c_order,
                )
                created_choices += 1

        print(f"  [OK] Lesson {lesson_id}: added {len(questions)} questions")

    print(f"\nDone: {created_lessons} lessons updated, {created_questions} questions, {created_choices} choices created.")


if __name__ == "__main__":
    print("Seeding lesson content and quiz questions...")
    seed()
