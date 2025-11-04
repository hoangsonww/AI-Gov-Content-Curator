"""
AWS Lambda handler for the Agentic AI Pipeline.
Processes articles using serverless architecture.
"""
import json
import os
import sys
from typing import Dict, Any

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import AgenticPipeline
import structlog

logger = structlog.get_logger()

# Initialize pipeline (cold start)
pipeline = None


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

        # Validate input
        required_fields = ["article_id", "content"]
        for field in required_fields:
            if field not in event:
                return {
                    "statusCode": 400,
                    "body": json.dumps({"error": f"Missing required field: {field}"})
                }

        # Get pipeline and process
        pipeline_instance = get_pipeline()

        # Process article (use sync version for Lambda)
        import asyncio
        result = asyncio.run(pipeline_instance.process_article(event))

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
