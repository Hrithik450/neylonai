from __future__ import annotations

from typing import TYPE_CHECKING

# mixins are small reusable classes that adds extra functionality to another class.
from django.contrib.auth.mixins import (
    LoginRequiredMixin,
)  # ensures user will be logged in.
from django.contrib.messages.views import (
    SuccessMessageMixin,
)  # adds success message after successful operation.
from django.urls import reverse
from django.utils.translation import gettext_lazy as _
from django.views.generic import DetailView
from django.views.generic import RedirectView
from django.views.generic import UpdateView

from server.users.models import User

if TYPE_CHECKING:
    from django.db.models import QuerySet


class UserDetailView(LoginRequiredMixin, DetailView):
    model = User
    slug_field = "id"
    slug_url_kwarg = "id"


# converts class into callable view.
user_detail_view = UserDetailView.as_view()


class UserUpdateView(LoginRequiredMixin, SuccessMessageMixin, UpdateView):
    model = User
    # Fields that can be safely modified.
    fields = ["name"]
    # _() is for translation (i18n)
    success_message = _("%(name)s updated successfully")

    # overriding methods
    # redirects the user after success.
    def get_success_url(self) -> str:
        # assert ensures condition must be true.
        assert self.request.user.is_authenticated  # type guard
        # get_absolute_url() is a user defined method on the User model that returns profile URL
        return self.request.user.get_absolute_url()

    # gets the object of the user to be updated.
    def get_object(self, queryset: QuerySet | None = None) -> User:
        assert self.request.user.is_authenticated  # type guard
        return self.request.user


user_update_view = UserUpdateView.as_view()


class UserRedirectView(LoginRequiredMixin, RedirectView):
    # Controls Http status codes. temporary redirect.
    permanent = False

    def get_redirect_url(self) -> str:
        # pk stands for primary key.
        # kwargs stands keyword args, dictionary of named arguments used to pass values into func.
        return reverse("users:detail", kwargs={"pk": self.request.user.pk})


user_redirect_view = UserRedirectView.as_view()
