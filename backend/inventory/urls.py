from rest_framework.routers import SimpleRouter
from .api import StockViewSet, AdjustmentViewSet
router = SimpleRouter()
router.register("items", StockViewSet, basename="stock-item")
router.register("adjustments", AdjustmentViewSet, basename="stock-adjustment")
urlpatterns = router.urls
