"""
AWS Lambda handler for the Agentic AI Pipeline.
Processes articles using serverless architecture.
"""
import json
import os
import sys
import asyncio
from typing import Dict, Any, Optional

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import AgenticPipeline
from config.settings import settings
import structlog

logger = structlog.get_logger()

# Initialize pipeline (cold start)
pipeline = None


def _run_async(coro):
    """
    Run async code safely from synchronous Lambda handler.
    """
    return asyncio.run(coro)


def _validate_payload(payload: Dict[str, Any]) -> Optional[str]:
    if not isinstance(payload.get("article_id"), str) or not payload["article_id"].strip():
        return "Missing or invalid required field: article_id"
    if not isinstance(payload.get("content"), str) or not payload["content"].strip():
        return "Missing or invalid required field: content"
    if len(payload["content"]) > settings.mcp_max_content_chars:
        return f"content exceeds max length ({settings.mcp_max_content_chars})"
    return None


def get_pipeline() -> AgenticPipeline:
    """Get or create pipeline instance (singleton pattern for Lambda)."""
    global pipeline
    if pipeline is None:
        logger.info("Initializing pipeline (cold start)")
        pipeline = AgenticPipeline()
    return pipeline


def lambda_handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    AWS Lambda handler for article processing.

    Expected event format:
    {
        "article_id": "...",
        "content": "...",
        "url": "...",
        "source": "..."
    }

    Returns:
        Processed article data with summary, topics, sentiment, etc.
    """
    try:
        logger.info("Lambda invoked", request_id=context.request_id)

        # Parse event
        if isinstance(event, str):
            event = json.loads(event)

        # Handle API Gateway proxy format
        if "body" in event:
            body = event["body"]
            if isinstance(body, str):
                body = json.loads(body)
            event = body

        validation_error = _validate_payload(event)
        if validation_error:
            return {
                "statusCode": 400,
                "body": json.dumps({"error": validation_error})
            }

        # Get pipeline and process
        pipeline_instance = get_pipeline()

        # Process article
        result = _run_async(pipeline_instance.process_article(event))

        logger.info("Processing completed", article_id=event["article_id"])

        # Return success response
        return {
            "statusCode": 200,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps(result)
        }

    except Exception as e:
        logger.error("Lambda execution failed", error=str(e))
        return {
            "statusCode": 500,
            "headers": {
                "Content-Type": "application/json",
                "Access-Control-Allow-Origin": "*"
            },
            "body": json.dumps({
                "error": str(e),
                "message": "Internal server error"
            })
        }
