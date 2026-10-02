from rest_framework import filters, viewsets

from accounts.permissions import IsManager

from .models import Category, MenuItem
from .permissions import CanAccessMenu
from .serializers import CategorySerializer, MenuItemSerializer


class CategoryViewSet(viewsets.ModelViewSet):
    serializer_class = CategorySerializer
    permission_classes = [CanAccessMenu]

    http_method_names = [
        "get", "post", "put", "patch", "head", "options",
    ]

    def get_queryset(self):
        queryset = Category.objects.all()

        if IsManager().has_permission(self.request, self):
            return queryset

        return queryset.filter(is_active=True)


class MenuItemViewSet(viewsets.ModelViewSet):
    serializer_class = MenuItemSerializer
    permission_classes = [CanAccessMenu]

    http_method_names = [
        "get", "post", "put", "patch", "head", "options",
    ]

    filter_backends = [filters.SearchFilter]
    search_fields = ["name", "short_code"]

    def get_queryset(self):
        queryset = MenuItem.objects.select_related("category")

        if IsManager().has_permission(self.request, self):
            return queryset

        return queryset.filter(category__is_active=True)
