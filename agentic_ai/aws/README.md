# AWS Deployment Guide

This directory contains AWS deployment configurations for the SynthoraAI Agentic AI Pipeline.

## Architecture

The AWS deployment uses serverless architecture with:
- **AWS Lambda**: For processing articles through the pipeline
- **API Gateway**: REST API endpoint for invoking the pipeline
- **S3**: Storage for processing artifacts and models
- **SQS**: Queue for asynchronous processing
- **Secrets Manager**: Secure storage for API keys
- **CloudWatch**: Monitoring and logging

## Prerequisites

1. **AWS CLI** installed and configured:
   ```bash
   aws configure
   ```

2. **AWS SAM CLI** installed:
   ```bash
   pip install aws-sam-cli
   ```

3. **Environment variables** set:
   ```bash
   export AWS_ACCOUNT_ID=your-account-id
   export AWS_REGION=us-east-1
   export MONGODB_URI=your-mongodb-uri
   export GOOGLE_AI_API_KEY=your-google-api-key
   export PINECONE_API_KEY=your-pinecone-key
   export REDIS_HOST=your-redis-host
   ```

## Deployment

### Quick Deploy

```bash
chmod +x deploy.sh
./deploy.sh production
```

### Manual Deployment

1. **Build dependencies layer**:
   ```bash
   mkdir -p lambda-layer/python
   pip install -r ../requirements.txt -t lambda-layer/python/
   ```

2. **Package the application**:
   ```bash
   sam package \
       --template-file cloudformation.yaml \
       --output-template-file packaged.yaml \
       --s3-bucket your-deployment-bucket
   ```

3. **Deploy the stack**:
   ```bash
   sam deploy \
       --template-file packaged.yaml \
       --stack-name synthora-ai-agentic-production \
       --capabilities CAPABILITY_IAM \
       --parameter-overrides \
           Environment=production \
           MongoDBURI=$MONGODB_URI \
           GoogleAIAPIKey=$GOOGLE_AI_API_KEY \
           PineconeAPIKey=$PINECONE_API_KEY \
           RedisHost=$REDIS_HOST
   ```

## Testing

Test the deployed endpoint:

```bash
# Get API endpoint
API_ENDPOINT=$(aws cloudformation describe-stacks \
    --stack-name synthora-ai-agentic-production \
    --query 'Stacks[0].Outputs[?OutputKey==`ApiEndpoint`].OutputValue' \
    --output text)

# Test article processing
curl -X POST ${API_ENDPOINT}/process \
    -H 'Content-Type: application/json' \
    -d '{
        "article_id": "test-123",
        "content": "Government announces new infrastructure bill...",
        "url": "https://example.com/article",
        "source": "government"
    }'
```

## Monitoring

View logs:
```bash
sam logs -n ArticleProcessorFunction --stack-name synthora-ai-agentic-production --tail
```

View CloudWatch metrics:
```bash
aws cloudwatch get-metric-statistics \
    --namespace AWS/Lambda \
    --metric-name Invocations \
    --dimensions Name=FunctionName,Value=synthora-ai-processor-production \
    --start-time 2024-01-01T00:00:00Z \
    --end-time 2024-01-02T00:00:00Z \
    --period 3600 \
    --statistics Sum
```

## Cost Optimization

- Lambda is billed per request and duration
- Consider using Reserved Concurrency for predictable workloads
- Use S3 lifecycle policies to archive old data
- Monitor CloudWatch costs and adjust retention policies

## Cleanup

To remove all resources:

```bash
aws cloudformation delete-stack --stack-name synthora-ai-agentic-production
```

## Troubleshooting

### Lambda Timeout
- Increase timeout in cloudformation.yaml (max 900s)
- Consider breaking into smaller functions

### Memory Issues
- Increase MemorySize in cloudformation.yaml
- Optimize model loading in cold starts

### Dependencies Too Large
- Use Lambda Layers for common dependencies
- Consider Lambda Container Images for large dependencies
