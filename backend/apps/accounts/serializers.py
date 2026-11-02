import bleach
from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers
from .models import User, Profile, Skill, Interest, UserSkill, UserInterest, Document, PersonalEvent, AuditLog


class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True, validators=[validate_password])
    password2 = serializers.CharField(write_only=True)
    organization = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    job_title = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')
    barangay = serializers.CharField(write_only=True, required=False, allow_blank=True, default='')

    class Meta:
        model = User
        fields = ["email", "first_name", "last_name", "barangay", "role", "youth_type", "password", "password2", "organization", "job_title"]

    def validate(self, attrs):
        if attrs["password"] != attrs["password2"]:
            raise serializers.ValidationError({"password": "Passwords do not match."})
        role = attrs.get("role", User.Role.YOUTH)
        if role == User.Role.SUPER_ADMIN:
            raise serializers.ValidationError({"role": "Cannot self-register as Super Admin."})
        if role == User.Role.LGU_ADMIN:
            raise serializers.ValidationError({"role": "Cannot self-register as LGU Admin."})
        # youth_type only matters for youth role
        if role != User.Role.YOUTH:
            attrs["youth_type"] = User.YouthType.GENERAL
        return attrs

    def validate_first_name(self, value):
        return bleach.clean(value.strip(), tags=[], strip=True)

    def validate_last_name(self, value):
        return bleach.clean(value.strip(), tags=[], strip=True)

    def create(self, validated_data):
        validated_data.pop("password2")
        password = validated_data.pop("password")
        organization = validated_data.pop("organization", "")
        job_title = validated_data.pop("job_title", "")
        barangay = validated_data.pop("barangay", "")
        user = User(**validated_data)
        user.set_password(password)
        user.save()
        profile_fields = {}
        if organization:
            profile_fields["organization"] = organization
        if job_title:
            profile_fields["job_title"] = job_title
        if barangay:
            profile_fields["barangay"] = barangay
        if profile_fields:
            profile = user.profile
            for k, v in profile_fields.items():
                setattr(profile, k, v)
            profile.save(update_fields=list(profile_fields.keys()))
        return user


class UserMiniSerializer(serializers.ModelSerializer):
    full_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = ["id", "email", "full_name", "role", "avatar_url"]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None


class ProfileSerializer(serializers.ModelSerializer):
    completeness_percent = serializers.IntegerField(read_only=True)
    missing_fields = serializers.ListField(child=serializers.CharField(), read_only=True)

    class Meta:
        model = Profile
        exclude = ["user"]

    def validate_bio(self, value):
        return bleach.clean(value, tags=[], strip=True)[:1000]


class SkillSerializer(serializers.ModelSerializer):
    class Meta:
        model = Skill
        fields = "__all__"


class InterestSerializer(serializers.ModelSerializer):
    class Meta:
        model = Interest
        fields = "__all__"


class MeSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    avatar_url = serializers.SerializerMethodField()
    skills = serializers.SerializerMethodField()
    interests = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "role", "youth_type", "is_email_verified", "avatar_url", "onboarding_complete", "date_joined",
            "profile", "skills", "interests",
        ]

    def get_avatar_url(self, obj):
        request = self.context.get("request")
        if obj.avatar and request:
            return request.build_absolute_uri(obj.avatar.url)
        return None

    def get_skills(self, obj):
        return [us.skill.name for us in obj.user_skills.select_related("skill").all()]

    def get_interests(self, obj):
        return [ui.interest.name for ui in obj.user_interests.select_related("interest").all()]


class UserAdminSerializer(serializers.ModelSerializer):
    profile = ProfileSerializer(read_only=True)
    full_name = serializers.CharField(read_only=True)
    is_verified = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "first_name", "last_name", "full_name",
            "role", "youth_type", "is_active", "date_joined", "onboarding_complete", "profile",
            "is_verified",
        ]
        read_only_fields = ["date_joined"]

    def get_is_verified(self, obj):
        try:
            return obj.id_verification.status == "approved"
        except Exception:
            return False


class DocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = Document
        fields = "__all__"
        read_only_fields = ["user", "uploaded_at"]

    def validate_file(self, value):
        max_size = 10 * 1024 * 1024
        if value.size > max_size:
            raise serializers.ValidationError("File too large. Max 10 MB.")
        allowed = [
            "application/pdf",
            "application/msword",
            "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            "image/jpeg",
            "image/png",
        ]
        if value.content_type not in allowed:
            raise serializers.ValidationError("Unsupported file type.")
        return value


class ChangePasswordSerializer(serializers.Serializer):
    old_password = serializers.CharField(write_only=True)
    new_password = serializers.CharField(write_only=True, validators=[validate_password])
    new_password2 = serializers.CharField(write_only=True)

    def validate(self, attrs):
        if attrs["new_password"] != attrs["new_password2"]:
            raise serializers.ValidationError({"new_password": "Passwords do not match."})
        return attrs


class PersonalEventSerializer(serializers.ModelSerializer):
    class Meta:
        model  = PersonalEvent
        fields = ['id', 'title', 'description', 'date', 'time', 'color', 'created_at']
        read_only_fields = ['id', 'created_at']


class AuditLogSerializer(serializers.ModelSerializer):
    user_email    = serializers.EmailField(source='user.email', read_only=True, default=None)
    user_name     = serializers.CharField(source='user.full_name', read_only=True, default=None)

    class Meta:
        model  = AuditLog
        fields = ['id', 'user_email', 'user_name', 'action', 'model_name', 'object_id', 'details', 'ip_address', 'created_at']
