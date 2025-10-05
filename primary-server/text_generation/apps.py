from django.apps import AppConfig

class TextGenerationConfig(AppConfig):
    default_auto_field = 'django.db.models.BigAutoField'
    name = 'text_generation'

    def ready(self):
        from .lib.load_agent import LoadInitialAgentConfig
        agent_instance = LoadInitialAgentConfig.get_instance()
        print(f"TextGeneration app is ready: {agent_instance}")