"""
Azure Functions handler for the Agentic AI Pipeline.
Processes articles using Azure serverless architecture.
"""
import json
import logging
import os
import sys
from typing import Dict, Any

import azure.functions as func

# Add parent directory to path for imports
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from core.pipeline import AgenticPipeline

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize pipeline (singleton for warm starts)
pipeline = None


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

        # Validate required fields
        required_fields = ["article_id", "content"]
        for field in required_fields:
            if field not in req_body:
                return func.HttpResponse(
                    json.dumps({"error": f"Missing required field: {field}"}),
                    status_code=400,
                    mimetype="application/json"
                )

        # Get pipeline and process
        pipeline_instance = get_pipeline()

        # Process article
        import asyncio
        result = asyncio.run(pipeline_instance.process_article(req_body))

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

        # Process article
        import asyncio
        result = asyncio.run(pipeline_instance.process_article(message_data))

        logger.info(f"Queue processing completed for article: {message_data.get('article_id')}")

        # Store result in blob storage or database
        # TODO: Implement result storage

    except Exception as e:
        logger.error(f"Queue processing failed: {str(e)}", exc_info=True)
        # Message will be automatically moved to poison queue after max retries
