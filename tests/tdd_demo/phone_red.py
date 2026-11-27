"""Deliberately incomplete isolated example, never imported by the app."""

import re


def normalize_phone(value):
    return "+7" + re.sub(r"\D", "", value)
