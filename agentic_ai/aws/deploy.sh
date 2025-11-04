#!/bin/bash
# AWS Deployment Script for SynthoraAI Agentic Pipeline

set -e

# Configuration
ENVIRONMENT=${1:-production}
STACK_NAME="synthora-ai-agentic-${ENVIRONMENT}"
REGION=${AWS_REGION:-us-east-1}
S3_BUCKET="synthora-ai-deployment-${AWS_ACCOUNT_ID}"

echo "=========================================="
echo "SynthoraAI Agentic Pipeline - AWS Deployment"
echo "=========================================="
echo "Environment: ${ENVIRONMENT}"
echo "Region: ${REGION}"
echo "Stack Name: ${STACK_NAME}"
echo ""

# Check for required tools
command -v aws >/dev/null 2>&1 || { echo "AWS CLI not found. Please install it first."; exit 1; }
command -v sam >/dev/null 2>&1 || { echo "AWS SAM CLI not found. Please install it first."; exit 1; }

# Check for required environment variables
if [ -z "$AWS_ACCOUNT_ID" ]; then
    echo "Getting AWS Account ID..."
    AWS_ACCOUNT_ID=$(aws sts get-caller-identity --query Account --output text)
    echo "AWS Account ID: ${AWS_ACCOUNT_ID}"
fi

# Create deployment bucket if it doesn't exist
echo "Checking deployment bucket..."
if ! aws s3 ls "s3://${S3_BUCKET}" 2>/dev/null; then
    echo "Creating deployment bucket: ${S3_BUCKET}"
    aws s3 mb "s3://${S3_BUCKET}" --region "${REGION}"
fi

# Build Lambda layer for dependencies
echo ""
echo "Building Lambda layer..."
cd ..
mkdir -p aws/lambda-layer/python
pip install -r requirements.txt -t aws/lambda-layer/python/ --upgrade
cd aws

# Package the application
echo ""
echo "Packaging application..."
sam package \
    --template-file cloudformation.yaml \
    --output-template-file packaged.yaml \
    --s3-bucket "${S3_BUCKET}" \
    --region "${REGION}"

# Deploy the stack
echo ""
echo "Deploying stack..."
sam deploy \
    --template-file packaged.yaml \
    --stack-name "${STACK_NAME}" \
    --capabilities CAPABILITY_IAM \
    --region "${REGION}" \
    --parameter-overrides \
        Environment="${ENVIRONMENT}" \
        MongoDBURI="${MONGODB_URI}" \
        GoogleAIAPIKey="${GOOGLE_AI_API_KEY}" \
        PineconeAPIKey="${PINECONE_API_KEY}" \
        RedisHost="${REDIS_HOST}" \
    --no-fail-on-empty-changeset

# Get stack outputs
echo ""
echo "Deployment complete!"
echo ""
echo "Stack Outputs:"
aws cloudformation describe-stacks \
    --stack-name "${STACK_NAME}" \
    --region "${REGION}" \
    --query 'Stacks[0].Outputs' \
    --output table

echo ""
echo "=========================================="
echo "Deployment Summary:"
echo "=========================================="
echo "Stack Name: ${STACK_NAME}"
echo "Region: ${REGION}"
echo "Environment: ${ENVIRONMENT}"
echo ""
echo "To test the endpoint:"
echo "  API_ENDPOINT=\$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --query 'Stacks[0].Outputs[?OutputKey==\`ApiEndpoint\`].OutputValue' --output text)"
echo "  curl -X POST \${API_ENDPOINT}/process -H 'Content-Type: application/json' -d '{\"article_id\":\"test\",\"content\":\"Test article\"}'"
echo ""
