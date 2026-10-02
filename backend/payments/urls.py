from django.urls import path

from .checkout_views import CheckoutView, OrderPaymentView
from .receipt_views import PaymentReceiptView
from .report_views import DailySalesSummaryView
from .views import BillQuoteView


urlpatterns = [
    path(
        "daily-summary/",
        DailySalesSummaryView.as_view(),
        name="daily-sales-summary",
    ),
    path(
        "orders/<int:order_id>/quote/",
        BillQuoteView.as_view(),
        name="bill-quote",
    ),
    path(
        "orders/<int:order_id>/checkout/",
        CheckoutView.as_view(),
        name="order-checkout",
    ),
    path(
        "orders/<int:order_id>/payment/",
        OrderPaymentView.as_view(),
        name="order-payment",
    ),
    path(
        "orders/<int:order_id>/receipt/",
        PaymentReceiptView.as_view(),
        name="order-receipt",
    ),
]