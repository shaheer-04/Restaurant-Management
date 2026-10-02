from rest_framework import serializers

from .models import Category, MenuItem


class CategorySerializer(serializers.ModelSerializer):
    class Meta:
        model = Category
        fields = ["id", "name", "is_active"]
        read_only_fields = ["id"]


class MenuItemSerializer(serializers.ModelSerializer):
    category_name = serializers.CharField(
        source="category.name",
        read_only=True,
    )

    class Meta:
        model = MenuItem
        fields = [
            "id",
            "name",
            "short_code",
            "category",
            "category_name",
            "price",
            "is_available",
        ]
        read_only_fields = ["id"]