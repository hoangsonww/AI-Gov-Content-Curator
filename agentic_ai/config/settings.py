"""
Production-ready configuration settings for the Agentic AI Pipeline.
"""
from typing import Optional, List
from pydantic_settings import BaseSettings, SettingsConfigDict
from pydantic import Field


class Settings(BaseSettings):
    """Application settings with environment variable support."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="allow"
    )

    # Application Settings
    app_name: str = "SynthoraAI Agentic Pipeline"
    environment: str = Field(default="production", description="Environment: development, staging, production")
    debug: bool = Field(default=False, description="Debug mode")
    log_level: str = Field(default="INFO", description="Logging level")

    # API Settings
    api_host: str = Field(default="0.0.0.0", description="API host")
    api_port: int = Field(default=8000, description="API port")
    api_workers: int = Field(default=4, description="Number of API workers")

    # MCP Server Settings
    mcp_port: int = Field(default=8001, description="MCP server port")
    mcp_max_connections: int = Field(default=100, description="Max MCP connections")

    # LLM Configuration
    openai_api_key: Optional[str] = Field(default=None, description="OpenAI API key")
    anthropic_api_key: Optional[str] = Field(default=None, description="Anthropic API key")
    google_ai_api_key: Optional[str] = Field(default=None, description="Google AI API key")
    cohere_api_key: Optional[str] = Field(default=None, description="Cohere API key")

    default_llm_provider: str = Field(default="google", description="Default LLM provider")
    default_model: str = Field(default="gemini-pro", description="Default model name")
    temperature: float = Field(default=0.7, description="LLM temperature")
    max_tokens: int = Field(default=2000, description="Max tokens for LLM responses")

    # Vector Store Configuration
    pinecone_api_key: Optional[str] = Field(default=None, description="Pinecone API key")
    pinecone_environment: Optional[str] = Field(default=None, description="Pinecone environment")
    pinecone_index_name: str = Field(default="synthora-ai", description="Pinecone index name")

    # MongoDB Configuration
    mongodb_uri: str = Field(default="mongodb://localhost:27017", description="MongoDB URI")
    mongodb_database: str = Field(default="synthora_ai", description="MongoDB database name")

    # Redis Configuration
    redis_host: str = Field(default="localhost", description="Redis host")
    redis_port: int = Field(default=6379, description="Redis port")
    redis_db: int = Field(default=0, description="Redis database number")
    redis_password: Optional[str] = Field(default=None, description="Redis password")

    # AWS Configuration
    aws_region: str = Field(default="us-east-1", description="AWS region")
    aws_access_key_id: Optional[str] = Field(default=None, description="AWS access key")
    aws_secret_access_key: Optional[str] = Field(default=None, description="AWS secret key")
    aws_s3_bucket: Optional[str] = Field(default=None, description="AWS S3 bucket")

    # Azure Configuration
    azure_subscription_id: Optional[str] = Field(default=None, description="Azure subscription ID")
    azure_resource_group: Optional[str] = Field(default=None, description="Azure resource group")
    azure_storage_account: Optional[str] = Field(default=None, description="Azure storage account")
    azure_storage_key: Optional[str] = Field(default=None, description="Azure storage key")

    # Agent Configuration
    max_iterations: int = Field(default=10, description="Max agent iterations")
    agent_timeout: int = Field(default=300, description="Agent timeout in seconds")
    enable_human_in_loop: bool = Field(default=False, description="Enable human-in-the-loop")

    # Rate Limiting
    rate_limit_requests: int = Field(default=100, description="Rate limit requests per minute")
    rate_limit_window: int = Field(default=60, description="Rate limit window in seconds")

    # Monitoring
    enable_metrics: bool = Field(default=True, description="Enable Prometheus metrics")
    metrics_port: int = Field(default=9090, description="Metrics port")

    # Feature Flags
    enable_content_analysis: bool = Field(default=True, description="Enable content analysis")
    enable_sentiment_analysis: bool = Field(default=True, description="Enable sentiment analysis")
    enable_summarization: bool = Field(default=True, description="Enable summarization")
    enable_classification: bool = Field(default=True, description="Enable classification")


settings = Settings()
