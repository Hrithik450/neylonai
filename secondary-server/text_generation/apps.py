import os
import psutil
from .lib.utils import report
from django.apps import AppConfig

mem = report("start", 0)

# Memory before any imports
mem = report("before any imports", mem)

from .tools.semantic_search_tool import semantic_search_tool
mem =report("after semantic tool imports", mem)

from .tools.email_filtering_tool import email_filtering_tool
mem = report("after email tool imports", mem)

class TextGenerationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'text_generation'