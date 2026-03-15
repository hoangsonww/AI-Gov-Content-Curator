"""
Azure Functions handler for the Agentic AI Pipeline.
Processes articles using Azure serverless architecture.
"""
import json
import logging
import os
import sys
import asyncio
from typing import Dict, Any, Optional

import azure.functions as func

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import AgenticPipeline
from config.settings import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize pipeline (singleton for warm starts)
pipeline = None


def _run_async(coro):
    """
    Run async code safely from a synchronous Azure Function handler.
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
    """Get or create pipeline instance."""
    global pipeline
    if pipeline is None:
        logger.info("Initializing pipeline (cold start)")
        pipeline = AgenticPipeline()
    return pipeline


def main(req: func.HttpRequest) -> func.HttpResponse:
    """
    Azure Function HTTP trigger for article processing.

    Expected request body:
    {
        "article_id": "...",
        "content": "...",
        "url": "...",
        "source": "..."
    }

    Returns:
        JSON response with processed article data
    """
    logger.info('Processing article request')

    try:
        # Parse request body
        try:
            req_body = req.get_json()
        except ValueError:
            return func.HttpResponse(
                json.dumps({"error": "Invalid JSON in request body"}),
                status_code=400,
                mimetype="application/json"
            )

        validation_error = _validate_payload(req_body)
        if validation_error:
            return func.HttpResponse(
                json.dumps({"error": validation_error}),
                status_code=400,
                mimetype="application/json"
            )

        # Get pipeline and process
        pipeline_instance = get_pipeline()

        # Process article
        result = _run_async(pipeline_instance.process_article(req_body))

        logger.info(f"Processing completed for article: {req_body['article_id']}")

        # Return success response
        return func.HttpResponse(
            json.dumps(result),
            status_code=200,
            mimetype="application/json",
            headers={
                "Access-Control-Allow-Origin": "*",
                "Access-Control-Allow-Methods": "POST, OPTIONS",
                "Access-Control-Allow-Headers": "Content-Type"
            }
        )

    except Exception as e:
        logger.error(f"Function execution failed: {str(e)}", exc_info=True)
        return func.HttpResponse(
            json.dumps({
                "error": str(e),
                "message": "Internal server error"
            }),
            status_code=500,
            mimetype="application/json"
        )


# Queue trigger for async processing
def queue_process(msg: func.QueueMessage) -> None:
    """
    Azure Queue trigger for asynchronous article processing.

    Message format: Same as HTTP request body
    """
    logger.info('Processing queue message')

    try:
        # Parse message
        message_data = json.loads(msg.get_body().decode('utf-8'))

        # Get pipeline and process
        pipeline_instance = get_pipeline()

        validation_error = _validate_payload(message_data)
        if validation_error:
            raise ValueError(validation_error)

        # Process article
        result = _run_async(pipeline_instance.process_article(message_data))

        logger.info(f"Queue processing completed for article: {message_data.get('article_id')}")

        # Store result in blob storage or database
        # TODO: Implement result storage

    except Exception as e:
        logger.error(f"Queue processing failed: {str(e)}", exc_info=True)
        # Message will be automatically moved to poison queue after max retries
