"""
Model Context Protocol (MCP) Server for the Agentic AI Pipeline.
Provides standardized interface for AI model interactions.
"""
from typing import Dict, Any, List, Optional
import asyncio
from datetime import datetime
from fastmcp import FastMCP
from pydantic import BaseModel, Field

from ..core.pipeline import AgenticPipeline
from ..config.settings import settings
import structlog

logger = structlog.get_logger()


# Request/Response Models
class ArticleProcessRequest(BaseModel):
    """Request model for article processing."""
    article_id: str = Field(..., description="Unique article identifier")
    content: str = Field(..., description="Article content to process")
    url: Optional[str] = Field(None, description="Article URL")
    source: Optional[str] = Field(None, description="Article source")
    metadata: Optional[Dict[str, Any]] = Field(default_factory=dict, description="Additional metadata")


class ProcessingStatus(BaseModel):
    """Status model for processing requests."""
    article_id: str
    status: str  # pending, processing, completed, failed
    progress: float  # 0.0 to 1.0
    current_stage: Optional[str] = None
    started_at: str
    completed_at: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class MCPServer:
    """
    MCP Server for the Agentic AI Pipeline.

    Provides tools and resources following the Model Context Protocol specification:
    - Tools: Executable functions for AI model interactions
    - Resources: Data and context for model operations
    - Prompts: Reusable prompt templates
    """

    def __init__(self):
        """Initialize the MCP server."""
        logger.info("Initializing MCP Server")

        self.mcp = FastMCP("SynthoraAI Agentic Pipeline")
        self.pipeline = AgenticPipeline()
        self.processing_jobs: Dict[str, ProcessingStatus] = {}

        # Register tools, resources, and prompts
        self._register_tools()
        self._register_resources()
        self._register_prompts()

        logger.info("MCP Server initialized successfully")

    def _register_tools(self):
        """Register MCP tools."""

        @self.mcp.tool()
        async def process_article(request: ArticleProcessRequest) -> Dict[str, Any]:
            """
            Process an article through the agentic AI pipeline.

            This tool runs the full pipeline including:
            - Content analysis
            - Summarization
            - Classification
            - Sentiment analysis
            - Quality checking

            Args:
                request: Article processing request

            Returns:
                Processing result with summary, topics, sentiment, etc.
            """
            logger.info("Processing article via MCP", article_id=request.article_id)

            # Create job status
            job = ProcessingStatus(
                article_id=request.article_id,
                status="processing",
                progress=0.0,
                started_at=datetime.utcnow().isoformat()
            )
            self.processing_jobs[request.article_id] = job

            try:
                # Process through pipeline
                article_data = {
                    "id": request.article_id,
                    "content": request.content,
                    "url": request.url or "",
                    "source": request.source or "",
                    **request.metadata
                }

                result = await self.pipeline.process_article(article_data)

                # Update job status
                job.status = "completed"
                job.progress = 1.0
                job.completed_at = datetime.utcnow().isoformat()
                job.result = result

                return result

            except Exception as e:
                logger.error("Article processing failed", error=str(e), article_id=request.article_id)
                job.status = "failed"
                job.error = str(e)
                job.completed_at = datetime.utcnow().isoformat()

                return {
                    "error": str(e),
                    "article_id": request.article_id
                }

        @self.mcp.tool()
        async def get_processing_status(article_id: str) -> ProcessingStatus:
            """
            Get the processing status of an article.

            Args:
                article_id: Article identifier

            Returns:
                Processing status information
            """
            if article_id not in self.processing_jobs:
                return ProcessingStatus(
                    article_id=article_id,
                    status="not_found",
                    progress=0.0,
                    started_at=datetime.utcnow().isoformat()
                )

            return self.processing_jobs[article_id]

        @self.mcp.tool()
        async def analyze_content(content: str, analysis_type: str = "full") -> Dict[str, Any]:
            """
            Analyze content using a specific agent.

            Args:
                content: Content to analyze
                analysis_type: Type of analysis (content, sentiment, classification)

            Returns:
                Analysis results
            """
            if analysis_type == "content":
                return self.pipeline.content_analyzer.analyze(content)
            elif analysis_type == "sentiment":
                return self.pipeline.sentiment_analyzer.analyze_sentiment(content)
            elif analysis_type == "classification":
                topics = self.pipeline.classifier.classify(content)
                return {"topics": topics}
            else:
                # Full analysis
                return {
                    "content_analysis": self.pipeline.content_analyzer.analyze(content),
                    "sentiment": self.pipeline.sentiment_analyzer.analyze_sentiment(content),
                    "topics": self.pipeline.classifier.classify(content)
                }

        @self.mcp.tool()
        async def generate_summary(content: str, style: str = "standard") -> str:
            """
            Generate a summary of the content.

            Args:
                content: Content to summarize
                style: Summary style (standard, brief, detailed)

            Returns:
                Generated summary
            """
            return self.pipeline.summarizer.summarize(content)

        @self.mcp.tool()
        async def check_pipeline_health() -> Dict[str, Any]:
            """
            Check the health status of the pipeline.

            Returns:
                Health status information
            """
            return {
                "status": "healthy",
                "timestamp": datetime.utcnow().isoformat(),
                "pipeline": "operational",
                "agents": {
                    "content_analyzer": "ready",
                    "summarizer": "ready",
                    "classifier": "ready",
                    "sentiment_analyzer": "ready",
                    "quality_checker": "ready"
                },
                "active_jobs": len([j for j in self.processing_jobs.values() if j.status == "processing"]),
                "completed_jobs": len([j for j in self.processing_jobs.values() if j.status == "completed"])
            }

    def _register_resources(self):
        """Register MCP resources."""

        @self.mcp.resource("config://pipeline")
        async def get_pipeline_config() -> Dict[str, Any]:
            """Get pipeline configuration."""
            return {
                "max_iterations": settings.max_iterations,
                "agent_timeout": settings.agent_timeout,
                "default_model": settings.default_model,
                "temperature": settings.temperature
            }

        @self.mcp.resource("config://topics")
        async def get_available_topics() -> List[str]:
            """Get available topic categories."""
            from ..agents.classifier import ClassifierAgent
            return ClassifierAgent.TOPIC_CATEGORIES

        @self.mcp.resource("stats://processing")
        async def get_processing_stats() -> Dict[str, Any]:
            """Get processing statistics."""
            total_jobs = len(self.processing_jobs)
            completed = len([j for j in self.processing_jobs.values() if j.status == "completed"])
            failed = len([j for j in self.processing_jobs.values() if j.status == "failed"])
            processing = len([j for j in self.processing_jobs.values() if j.status == "processing"])

            return {
                "total_jobs": total_jobs,
                "completed": completed,
                "failed": failed,
                "processing": processing,
                "success_rate": completed / total_jobs if total_jobs > 0 else 0
            }

    def _register_prompts(self):
        """Register MCP prompts."""

        @self.mcp.prompt()
        async def summarize_article_prompt(article_content: str) -> str:
            """Prompt template for article summarization."""
            return f"""Please provide a concise summary of the following article.
Focus on the main points, key facts, and important takeaways.

Article:
{article_content}

Summary:"""

        @self.mcp.prompt()
        async def analyze_sentiment_prompt(content: str) -> str:
            """Prompt template for sentiment analysis."""
            return f"""Analyze the sentiment and emotional tone of the following content.
Consider objectivity, urgency, and controversy level.

Content:
{content}

Analysis:"""

    async def start(self):
        """Start the MCP server."""
        logger.info(f"Starting MCP server on port {settings.mcp_port}")
        await self.mcp.run(
            host=settings.api_host,
            port=settings.mcp_port
        )

    def run(self):
        """Run the MCP server (blocking)."""
        asyncio.run(self.start())


# Factory function
def create_mcp_server() -> MCPServer:
    """Create and return an MCP server instance."""
    return MCPServer()


# CLI entry point
if __name__ == "__main__":
    server = create_mcp_server()
    server.run()
