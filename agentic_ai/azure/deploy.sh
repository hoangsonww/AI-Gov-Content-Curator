#!/bin/bash
# Azure Deployment Script for SynthoraAI Agentic Pipeline

set -e

# Configuration
ENVIRONMENT=${1:-production}
RESOURCE_GROUP="synthora-ai-${ENVIRONMENT}"
LOCATION=${AZURE_LOCATION:-eastus}
APP_NAME="synthora-ai-agentic"

echo "=========================================="
echo "SynthoraAI Agentic Pipeline - Azure Deployment"
echo "=========================================="
echo "Environment: ${ENVIRONMENT}"
echo "Location: ${LOCATION}"
echo "Resource Group: ${RESOURCE_GROUP}"
echo ""

# Check for required tools
command -v az >/dev/null 2>&1 || { echo "Azure CLI not found. Please install it first."; exit 1; }
command -v func >/dev/null 2>&1 || { echo "Azure Functions Core Tools not found. Please install it first."; exit 1; }

# Check for required environment variables
if [ -z "$MONGODB_URI" ] || [ -z "$GOOGLE_AI_API_KEY" ] || [ -z "$PINECONE_API_KEY" ]; then
    echo "Error: Required environment variables not set"
    echo "Please set: MONGODB_URI, GOOGLE_AI_API_KEY, PINECONE_API_KEY"
    exit 1
fi

# Login to Azure (if not already logged in)
echo "Checking Azure login status..."
az account show >/dev/null 2>&1 || az login

# Create resource group
echo ""
echo "Creating resource group..."
az group create \
    --name "${RESOURCE_GROUP}" \
    --location "${LOCATION}"

# Deploy infrastructure using Bicep
echo ""
echo "Deploying infrastructure..."
az deployment group create \
    --resource-group "${RESOURCE_GROUP}" \
    --template-file bicep-template.bicep \
    --parameters \
        environment="${ENVIRONMENT}" \
        location="${LOCATION}" \
        appName="${APP_NAME}" \
        mongoDbUri="${MONGODB_URI}" \
        googleAiApiKey="${GOOGLE_AI_API_KEY}" \
        pineconeApiKey="${PINECONE_API_KEY}"

# Get deployment outputs
echo ""
echo "Getting deployment outputs..."
FUNCTION_APP_NAME=$(az deployment group show \
    --resource-group "${RESOURCE_GROUP}" \
    --name bicep-template \
    --query 'properties.outputs.functionAppName.value' \
    --output tsv)

FUNCTION_APP_URL=$(az deployment group show \
    --resource-group "${RESOURCE_GROUP}" \
    --name bicep-template \
    --query 'properties.outputs.functionAppUrl.value' \
    --output tsv)

# Install Python dependencies
echo ""
echo "Installing dependencies..."
cd ..
pip install -r requirements.txt --target .python_packages/lib/site-packages

# Deploy function code
echo ""
echo "Deploying function code..."
cd azure
func azure functionapp publish "${FUNCTION_APP_NAME}" --python

echo ""
echo "=========================================="
echo "Deployment Complete!"
echo "=========================================="
echo "Function App: ${FUNCTION_APP_NAME}"
echo "URL: ${FUNCTION_APP_URL}"
echo ""
echo "Test the endpoint:"
echo "  curl -X POST ${FUNCTION_APP_URL}/api/process \\"
echo "    -H 'Content-Type: application/json' \\"
echo "    -d '{\"article_id\":\"test\",\"content\":\"Test article\"}'"
echo ""
