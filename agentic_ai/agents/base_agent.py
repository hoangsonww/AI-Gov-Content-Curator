"""
Base Agent class for all specialized agents in the pipeline.
"""
from abc import ABC, abstractmethod
from typing import Any, Dict, Optional
from langchain_core.language_models import BaseChatModel
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_openai import ChatOpenAI
from langchain_anthropic import ChatAnthropic
from langchain_cohere import ChatCohere

from ..config.settings import settings
import structlog

logger = structlog.get_logger()


class BaseAgent(ABC):
    """Abstract base class for all agents."""

    def __init__(self, name: str, llm: Optional[BaseChatModel] = None):
        """
        Initialize the agent.

        Args:
            name: Agent name
            llm: Optional language model (will use default if not provided)
        """
        self.name = name
        self.llm = llm or self._get_default_llm()
        logger.info(f"Initialized {name} agent")

    def _get_default_llm(self) -> BaseChatModel:
        """Get the default language model based on settings."""
        provider = settings.default_llm_provider.lower()

        if provider == "google":
            if not settings.google_ai_api_key:
                raise ValueError("GOOGLE_AI_API_KEY is required when DEFAULT_LLM_PROVIDER=google")
            return ChatGoogleGenerativeAI(
                model=settings.default_model,
                google_api_key=settings.google_ai_api_key,
                temperature=settings.temperature,
                max_tokens=settings.max_tokens
            )
        elif provider == "openai":
            if not settings.openai_api_key:
                raise ValueError("OPENAI_API_KEY is required when DEFAULT_LLM_PROVIDER=openai")
            return ChatOpenAI(
                model=settings.default_model,
                api_key=settings.openai_api_key,
                temperature=settings.temperature,
                max_tokens=settings.max_tokens
            )
        elif provider == "anthropic":
            if not settings.anthropic_api_key:
                raise ValueError("ANTHROPIC_API_KEY is required when DEFAULT_LLM_PROVIDER=anthropic")
            return ChatAnthropic(
                model=settings.default_model,
                anthropic_api_key=settings.anthropic_api_key,
                temperature=settings.temperature,
                max_tokens=settings.max_tokens
            )
        elif provider == "cohere":
            if not settings.cohere_api_key:
                raise ValueError("COHERE_API_KEY is required when DEFAULT_LLM_PROVIDER=cohere")
            return ChatCohere(
                model=settings.default_model,
                cohere_api_key=settings.cohere_api_key,
                temperature=settings.temperature,
                max_tokens=settings.max_tokens
            )
        else:
            raise ValueError(
                f"Unsupported LLM provider: {provider}. "
                "Supported providers: google, openai, anthropic, cohere"
            )

    @abstractmethod
    def process(self, *args, **kwargs) -> Any:
        """Process method to be implemented by subclasses."""
        pass

    def _handle_error(self, error: Exception, context: Dict[str, Any]) -> Dict[str, Any]:
        """Handle errors consistently across agents."""
        logger.error(
            f"{self.name} error",
            error=str(error),
            context=context
        )
        return {
            "error": str(error),
            "agent": self.name,
            "context": context
        }
