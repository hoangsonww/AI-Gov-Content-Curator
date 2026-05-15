"""Production-ready configuration settings for the Agentic AI Pipeline.

Adopts strict Pydantic Settings semantics in production: secret references
must resolve, allow-listed providers, fail-fast on bad enum values.
"""

from __future__ import annotations

from typing import Literal, Optional

from pydantic import Field, SecretStr, field_validator, model_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


Environment = Literal["development", "staging", "production", "test"]
LLMProvider = Literal["google", "openai", "anthropic", "cohere"]
ACPBackend = Literal["redis", "memory"]
LogLevel = Literal["DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL"]


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=("agentic_ai/.env", ".env"),
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow",
    )

    # ── Application ────────────────────────────────────────────────────
    app_name: str = "SynthoraAI Agentic Pipeline"
    app_version: str = Field(default="1.0.0")
    environment: Environment = Field(default="production")
    debug: bool = Field(default=False)
    log_level: LogLevel = Field(default="INFO")
    log_json: bool = Field(default=True)

    # ── API ────────────────────────────────────────────────────────────
    api_host: str = Field(default="0.0.0.0")  # noqa: S104  bind-all is intentional for containers
    api_port: int = Field(default=8000, ge=1, le=65535)
    api_workers: int = Field(default=4, ge=1, le=64)

    # ── MCP Server ─────────────────────────────────────────────────────
    mcp_server_name: str = Field(default="synthora-agentic-pipeline")
    mcp_server_version: str = Field(default="1.0.0")
    mcp_port: int = Field(default=8001, ge=1, le=65535)
    mcp_max_connections: int = Field(default=100, ge=1, le=10_000)
    mcp_max_content_chars: int = Field(default=20_000, ge=1, le=1_000_000)
    mcp_max_metadata_entries: int = Field(default=50, ge=1, le=1_000)
    mcp_max_metadata_value_chars: int = Field(default=2_000, ge=1, le=200_000)
    mcp_max_batch_items: int = Field(default=25, ge=1, le=1_000)
    mcp_max_job_history: int = Field(default=1_000, ge=1, le=1_000_000)
    mcp_job_ttl_seconds: int = Field(default=86_400, ge=1)

    # ── ACP ────────────────────────────────────────────────────────────
    acp_enabled: bool = Field(default=True)
    acp_backend: ACPBackend = Field(default="redis")
    acp_max_agents: int = Field(default=200, ge=1, le=100_000)
    acp_max_messages: int = Field(default=5_000, ge=1, le=10_000_000)
    acp_message_ttl_seconds: int = Field(default=3_600, ge=1)
    acp_agent_ttl_seconds: int = Field(default=900, ge=1)
    acp_redis_key_prefix: str = Field(default="synthora:acp")
    acp_max_payload_chars: int = Field(default=20_000, ge=1, le=1_000_000)
    acp_max_metadata_entries: int = Field(default=50, ge=1, le=1_000)
    acp_max_capabilities: int = Field(default=32, ge=1, le=1_000)

    # ── LLM provider keys (SecretStr so they never serialize to logs) ──
    openai_api_key: Optional[SecretStr] = Field(default=None)
    anthropic_api_key: Optional[SecretStr] = Field(default=None)
    google_ai_api_key: Optional[SecretStr] = Field(default=None)
    cohere_api_key: Optional[SecretStr] = Field(default=None)

    default_llm_provider: LLMProvider = Field(default="google")
    default_model: str = Field(default="gemini-1.5-flash")
    temperature: float = Field(default=0.7, ge=0.0, le=2.0)
    max_tokens: int = Field(default=2000, ge=1, le=200_000)

    # LLM call resilience.
    llm_request_timeout_seconds: float = Field(default=60.0, gt=0.0)
    llm_max_attempts: int = Field(default=3, ge=1, le=10)
    llm_circuit_fail_max: int = Field(default=5, ge=1, le=100)
    llm_circuit_reset_seconds: int = Field(default=30, ge=1, le=3_600)

    # ── Vector Store ───────────────────────────────────────────────────
    pinecone_api_key: Optional[SecretStr] = Field(default=None)
    pinecone_environment: Optional[str] = Field(default=None)
    pinecone_index_name: str = Field(default="synthora-ai")

    # ── MongoDB ────────────────────────────────────────────────────────
    mongodb_uri: SecretStr = Field(default=SecretStr("mongodb://localhost:27017"))
    mongodb_database: str = Field(default="synthora_ai")

    # ── Redis ──────────────────────────────────────────────────────────
    redis_host: str = Field(default="localhost")
    redis_port: int = Field(default=6379, ge=1, le=65535)
    redis_db: int = Field(default=0, ge=0, le=15)
    redis_password: Optional[SecretStr] = Field(default=None)
    redis_tls: bool = Field(default=False)

    # ── AWS ────────────────────────────────────────────────────────────
    aws_region: str = Field(default="us-east-1")
    aws_access_key_id: Optional[SecretStr] = Field(default=None)
    aws_secret_access_key: Optional[SecretStr] = Field(default=None)
    aws_s3_bucket: Optional[str] = Field(default=None)

    # ── Azure ──────────────────────────────────────────────────────────
    azure_subscription_id: Optional[str] = Field(default=None)
    azure_resource_group: Optional[str] = Field(default=None)
    azure_storage_account: Optional[str] = Field(default=None)
    azure_storage_key: Optional[SecretStr] = Field(default=None)
    azure_app_insights_connection_string: Optional[SecretStr] = Field(default=None)

    # ── GCP ────────────────────────────────────────────────────────────
    gcp_project_id: Optional[str] = Field(default=None)
    gcp_region: str = Field(default="us-central1")
    gcp_storage_bucket: Optional[str] = Field(default=None)
    google_application_credentials: Optional[str] = Field(default=None)

    # ── Agent Configuration ────────────────────────────────────────────
    max_iterations: int = Field(default=10, ge=1, le=100)
    agent_timeout: int = Field(default=300, ge=1, le=3_600)
    enable_human_in_loop: bool = Field(default=False)

    # ── Rate Limiting ──────────────────────────────────────────────────
    rate_limit_requests: int = Field(default=100, ge=1, le=1_000_000)
    rate_limit_window: int = Field(default=60, ge=1, le=86_400)

    # ── Monitoring / OTel ──────────────────────────────────────────────
    enable_metrics: bool = Field(default=True)
    metrics_port: int = Field(default=9090, ge=1, le=65535)
    otel_exporter_otlp_endpoint: Optional[str] = Field(default=None)
    otel_exporter_otlp_protocol: Literal["grpc", "http/protobuf"] = Field(default="grpc")
    otel_traces_sample_ratio: float = Field(default=1.0, ge=0.0, le=1.0)

    # ── Feature Flags ──────────────────────────────────────────────────
    enable_content_analysis: bool = Field(default=True)
    enable_sentiment_analysis: bool = Field(default=True)
    enable_summarization: bool = Field(default=True)
    enable_classification: bool = Field(default=True)

    # ── Cost Budget ────────────────────────────────────────────────────
    daily_cost_budget_usd: float = Field(default=50.0, ge=0.0)
    cost_alert_threshold: float = Field(default=0.8, ge=0.0, le=1.0)

    # ─── Validators ────────────────────────────────────────────────────

    @field_validator("log_level", mode="before")
    @classmethod
    def _upper_log_level(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().upper()
        return value

    @field_validator("environment", "default_llm_provider", "acp_backend", mode="before")
    @classmethod
    def _lower_enums(cls, value: object) -> object:
        if isinstance(value, str):
            return value.strip().lower()
        return value

    @model_validator(mode="after")
    def _check_provider_key_present(self) -> "Settings":
        """In production, the default LLM provider must have its key set.

        Non-production environments may run without keys (e.g. unit tests
        that mock the LLM). This keeps test ergonomics while preventing
        production startup with missing credentials.
        """
        if self.environment != "production":
            return self
        provider_keys: dict[str, Optional[SecretStr]] = {
            "google": self.google_ai_api_key,
            "openai": self.openai_api_key,
            "anthropic": self.anthropic_api_key,
            "cohere": self.cohere_api_key,
        }
        key = provider_keys.get(self.default_llm_provider)
        if key is None or not key.get_secret_value().strip():
            raise ValueError(
                f"DEFAULT_LLM_PROVIDER={self.default_llm_provider} requires its "
                "API key to be set when ENVIRONMENT=production."
            )
        return self

    # ─── Convenience helpers ───────────────────────────────────────────

    def get_provider_key(self, provider: str) -> Optional[str]:
        """Return the API key for a provider as a plain string, or None."""
        attr = {
            "google": "google_ai_api_key",
            "openai": "openai_api_key",
            "anthropic": "anthropic_api_key",
            "cohere": "cohere_api_key",
        }.get(provider.lower())
        if attr is None:
            return None
        secret: Optional[SecretStr] = getattr(self, attr, None)
        if secret is None:
            return None
        value = secret.get_secret_value().strip()
        return value or None

    def is_production(self) -> bool:
        return self.environment == "production"


settings = Settings()
