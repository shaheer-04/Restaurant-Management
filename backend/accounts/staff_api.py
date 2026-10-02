from django.contrib.auth import get_user_model
from django.contrib.auth.models import Group
from django.contrib.auth.password_validation import validate_password
from django.core.exceptions import ValidationError as DjangoValidationError
from django.db import transaction
from rest_framework import serializers, viewsets
from .permissions import IsManager
User = get_user_model()

class StaffSerializer(serializers.ModelSerializer):
    role = serializers.ChoiceField(choices=["Manager", "Cashier", "Kitchen"], write_only=True, required=False)
    roles = serializers.SerializerMethodField()
    password = serializers.CharField(write_only=True, required=False, trim_whitespace=False, max_length=256)
    class Meta:
        model = User
        fields = ["id", "username", "email", "first_name", "last_name", "is_active", "role", "roles", "password"]
        read_only_fields = ["id", "roles"]
    def get_roles(self, obj):
        return list(obj.groups.values_list("name", flat=True))
    def validate(self, attrs):
        if self.instance is None and ("password" not in attrs or "role" not in attrs):
            raise serializers.ValidationError("Password and role are required for new staff.")
        if self.instance and self.instance.pk == self.context["request"].user.pk:
            if attrs.get("is_active") is False or "role" in attrs:
                raise serializers.ValidationError("You cannot deactivate yourself or change your own role.")
        if "password" in attrs:
            candidate = User(username=attrs.get("username", getattr(self.instance, "username", "")), email=attrs.get("email", getattr(self.instance, "email", "")))
            try: validate_password(attrs["password"], candidate)
            except DjangoValidationError as exc: raise serializers.ValidationError({"password": exc.messages})
        return attrs
    @transaction.atomic
    def create(self, validated_data):
        role = validated_data.pop("role")
        password = validated_data.pop("password")
        user = User.objects.create_user(password=password, **validated_data)
        user.groups.set([Group.objects.get_or_create(name=role)[0]])
        return user
    @transaction.atomic
    def update(self, instance, validated_data):
        role = validated_data.pop("role", None)
        password = validated_data.pop("password", None)
        for key, value in validated_data.items(): setattr(instance, key, value)
        if password is not None: instance.set_password(password)
        instance.save()
        if role is not None: instance.groups.set([Group.objects.get_or_create(name=role)[0]])
        return instance

class StaffViewSet(viewsets.ModelViewSet):
    queryset = User.objects.filter(is_superuser=False, is_staff=False).prefetch_related("groups").order_by("username")
    serializer_class = StaffSerializer
    permission_classes = [IsManager]
    http_method_names = ["get", "post", "put", "patch", "head", "options"]
