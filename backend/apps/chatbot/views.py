import os
import uuid

import httpx
try:
    from openai import OpenAI, APIConnectionError, AuthenticationError
except ImportError:  # openai not installed — chatbot will degrade gracefully
    OpenAI = None
    APIConnectionError = Exception
    AuthenticationError = Exception
from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import ChatMessage, ChatSession
from .serializers import ChatSessionSerializer

GROQ_BASE_URL = "https://api.groq.com/openai/v1"
GROQ_MODEL = "llama-3.1-8b-instant"

SYSTEM_PROMPT = (
    "You are a helpful AI assistant for the Lucena City Youth Development Portal (LYDO Hub). "
    "You answer questions about: youth programs, SK (Sangguniang Kabataan), youth organization registration (YORP), "
    "Lucena City government programs, events, requirements, policies, scholarships, jobs, internships, "
    "and laws affecting Filipino youth aged 15-30. "
    "Be friendly, concise, and helpful. If you don't know something specific to Lucena City, say so honestly. "
    "Respond in English or Filipino based on the user's language."
)


class ChatbotView(APIView):
    """POST: send a message and receive an AI reply. GET: retrieve chat history by session_key."""

    permission_classes = [AllowAny]

    # ------------------------------------------------------------------
    # GET  /api/chatbot/?session_key=<key>
    # ------------------------------------------------------------------
    def get(self, request):
        session_key = request.query_params.get('session_key')
        if not session_key:
            return Response(
                {'error': 'session_key query parameter is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )
        session = get_object_or_404(ChatSession, session_key=session_key)
        serializer = ChatSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)

    # ------------------------------------------------------------------
    # POST  /api/chatbot/
    # ------------------------------------------------------------------
    def post(self, request):
        message_text = request.data.get('message', '').strip()
        if not message_text:
            return Response(
                {'error': 'message is required.'},
                status=status.HTTP_400_BAD_REQUEST,
            )

        # Resolve or create session
        session_key = request.data.get('session_key') or str(uuid.uuid4())
        user = request.user if request.user.is_authenticated else None
        session, _ = ChatSession.objects.get_or_create(
            session_key=session_key,
            defaults={'user': user},
        )

        # Persist the incoming user message
        ChatMessage.objects.create(session=session, role='user', content=message_text)

        # Check API key
        api_key = os.getenv('GROQ_API_KEY', '')
        if not api_key:
            reply = 'AI chatbot is not configured. Please contact the administrator.'
            ChatMessage.objects.create(session=session, role='assistant', content=reply)
            return Response({'reply': reply, 'session_key': session_key}, status=status.HTTP_200_OK)

        # Build message history (last 10 messages)
        recent_messages = list(session.messages.order_by('created_at'))[-10:]
        api_messages = [
            {'role': 'system', 'content': SYSTEM_PROMPT},
            *[{'role': msg.role, 'content': msg.content} for msg in recent_messages],
        ]

        # Call Groq API (OpenAI-compatible)
        try:
            client = OpenAI(
                api_key=api_key,
                base_url=GROQ_BASE_URL,
                # OUTBOUND_PROXY is needed on PythonAnywhere free accounts
                # (http://proxy.server:3128); unset locally.
                http_client=httpx.Client(
                    verify=False,  # bypass local SSL inspection
                    proxy=os.getenv('OUTBOUND_PROXY') or None,
                    timeout=30,
                ),
            )
            response = client.chat.completions.create(
                model=GROQ_MODEL,
                messages=api_messages,
                max_tokens=1024,
                temperature=0.7,
            )
            reply = response.choices[0].message.content
        except APIConnectionError:
            reply = 'Could not connect to the AI service. Please try again later.'
        except AuthenticationError:
            reply = 'AI chatbot is not configured correctly. Please contact the administrator.'
        except Exception as exc:  # noqa: BLE001
            reply = f'An error occurred while processing your request: {exc}'

        # Persist assistant reply
        ChatMessage.objects.create(session=session, role='assistant', content=reply)

        return Response({'reply': reply, 'session_key': session_key}, status=status.HTTP_200_OK)


class ChatHistoryView(APIView):
    """GET /api/chatbot/history/<session_key>/"""

    permission_classes = [AllowAny]

    def get(self, request, session_key):
        session = get_object_or_404(ChatSession, session_key=session_key)
        serializer = ChatSessionSerializer(session)
        return Response(serializer.data, status=status.HTTP_200_OK)
