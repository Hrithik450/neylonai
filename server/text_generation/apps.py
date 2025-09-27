from django.apps import AppConfig
from .lib.load_data import df, chroma_collection

class TextGenerationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'text_generation'