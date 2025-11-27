#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
ENVIRONMENT=${1:-prod}
SERVICE=${2:-all}
DEPLOYMENT_TYPE=${3:-blue-green}  # blue-green, rolling, or canary

echo -e "${GREEN}=== AI Curator AWS Deployment ===${NC}"
echo "Environment: $ENVIRONMENT"
echo "Service: $SERVICE"
echo "Deployment Type: $DEPLOYMENT_TYPE"
echo ""

# Validate AWS credentials
if ! aws sts get-caller-identity &> /dev/null; then
    echo -e "${RED}Error: AWS credentials not configured${NC}"
    exit 1
fi

# Function to deploy using Terraform
deploy_with_terraform() {
    echo -e "${YELLOW}Starting Terraform deployment...${NC}"

    cd infrastructure/terraform

    # Initialize Terraform
    terraform init -upgrade

    # Validate configuration
    terraform validate

    # Plan deployment
    terraform plan -var="environment=$ENVIRONMENT" -out=tfplan

    # Ask for confirmation
    read -p "Do you want to proceed with the deployment? (yes/no): " confirm
    if [ "$confirm" != "yes" ]; then
        echo -e "${RED}Deployment cancelled${NC}"
        exit 0
    fi

    # Apply Terraform
    terraform apply tfplan

    # Get outputs
    ALB_DNS=$(terraform output -raw alb_dns_name)
    CLUSTER_NAME=$(terraform output -raw ecs_cluster_name)

    echo -e "${GREEN}Infrastructure deployed successfully${NC}"
    echo "ALB DNS: $ALB_DNS"
    echo "ECS Cluster: $CLUSTER_NAME"

    cd ../..
}

# Function to deploy a service with CodeDeploy (Blue/Green)
deploy_service_blue_green() {
    local service_name=$1

    echo -e "${YELLOW}Deploying $service_name with Blue/Green strategy...${NC}"

    # Get CodeDeploy application and deployment group names
    cd infrastructure/terraform
    CODEDEPLOY_APP=$(terraform output -json | jq -r ".${service_name}_codedeploy_app.value")
    DEPLOYMENT_GROUP=$(terraform output -json | jq -r ".${service_name}_codedeploy_deployment_group.value")
    cd ../..

    # Create new task definition revision
    TASK_DEFINITION=$(aws ecs describe-task-definition \
        --task-definition "ai-curator-$ENVIRONMENT-$service_name" \
        --query 'taskDefinition' \
        --output json)

    # Register new task definition with latest image
    NEW_TASK_DEF=$(echo $TASK_DEFINITION | jq --arg IMAGE "ghcr.io/hoangsonww/ai-curator-$service_name:latest" \
        '.containerDefinitions[0].image = $IMAGE | del(.taskDefinitionArn, .revision, .status, .requiresAttributes, .compatibilities, .registeredAt, .registeredBy)' \
        | aws ecs register-task-definition --cli-input-json file:///dev/stdin --query 'taskDefinition.taskDefinitionArn' --output text)

    echo "New task definition: $NEW_TASK_DEF"

    # Create AppSpec for CodeDeploy
    cat > /tmp/appspec.json <<EOF
{
    "version": 1,
    "Resources": [
        {
            "TargetService": {
                "Type": "AWS::ECS::Service",
                "Properties": {
                    "TaskDefinition": "$NEW_TASK_DEF",
                    "LoadBalancerInfo": {
                        "ContainerName": "$service_name",
                        "ContainerPort": 3000
                    },
                    "PlatformVersion": "LATEST"
                }
            }
        }
    ],
    "Hooks": [
        {
            "BeforeInstall": "LambdaFunctionToValidateBeforeInstall"
        },
        {
            "AfterInstall": "LambdaFunctionToValidateAfterInstall"
        },
        {
            "AfterAllowTestTraffic": "LambdaFunctionToValidateAfterTestTraffic"
        },
        {
            "BeforeAllowTraffic": "LambdaFunctionToValidateBeforeAllowTraffic"
        },
        {
            "AfterAllowTraffic": "LambdaFunctionToValidateAfterAllowTraffic"
        }
    ]
}
EOF

    # Create deployment
    DEPLOYMENT_ID=$(aws deploy create-deployment \
        --application-name "$CODEDEPLOY_APP" \
        --deployment-group-name "$DEPLOYMENT_GROUP" \
        --revision "{\"revisionType\":\"AppSpecContent\",\"appSpecContent\":{\"content\":\"$(cat /tmp/appspec.json | jq -c .)\"}}" \
        --deployment-config-name CodeDeployDefault.ECSAllAtOnce \
        --description "Blue/Green deployment for $service_name" \
        --query 'deploymentId' \
        --output text)

    echo -e "${GREEN}Deployment created: $DEPLOYMENT_ID${NC}"

    # Wait for deployment to complete
    echo "Waiting for deployment to complete..."
    aws deploy wait deployment-successful --deployment-id "$DEPLOYMENT_ID"

    echo -e "${GREEN}Deployment completed successfully!${NC}"

    rm /tmp/appspec.json
}

# Function to rollback a deployment
rollback_deployment() {
    local service_name=$1

    echo -e "${YELLOW}Rolling back $service_name...${NC}"

    # Get the previous task definition
    PREVIOUS_TASK_DEF=$(aws ecs describe-services \
        --cluster "ai-curator-$ENVIRONMENT" \
        --services "ai-curator-$ENVIRONMENT-$service_name" \
        --query 'services[0].deployments[1].taskDefinition' \
        --output text)

    if [ -z "$PREVIOUS_TASK_DEF" ] || [ "$PREVIOUS_TASK_DEF" == "None" ]; then
        echo -e "${RED}No previous task definition found${NC}"
        exit 1
    fi

    echo "Rolling back to: $PREVIOUS_TASK_DEF"

    # Update service with previous task definition
    aws ecs update-service \
        --cluster "ai-curator-$ENVIRONMENT" \
        --service "ai-curator-$ENVIRONMENT-$service_name" \
        --task-definition "$PREVIOUS_TASK_DEF" \
        --force-new-deployment

    echo -e "${GREEN}Rollback initiated${NC}"

    # Wait for service to stabilize
    aws ecs wait services-stable \
        --cluster "ai-curator-$ENVIRONMENT" \
        --services "ai-curator-$ENVIRONMENT-$service_name"

    echo -e "${GREEN}Rollback completed successfully!${NC}"
}

# Function to check deployment health
check_health() {
    local service_name=$1
    local alb_dns=$2
    local path="/health"

    if [ "$service_name" == "frontend" ]; then
        path="/api/health"
    fi

    echo -e "${YELLOW}Checking health for $service_name...${NC}"

    # Wait for ALB to be ready
    sleep 10

    # Check health endpoint
    for i in {1..30}; do
        if curl -sf "http://$alb_dns$path" > /dev/null; then
            echo -e "${GREEN}Health check passed${NC}"
            return 0
        fi
        echo "Attempt $i: Waiting for service to be healthy..."
        sleep 10
    done

    echo -e "${RED}Health check failed${NC}"
    return 1
}

# Main deployment logic
case "$SERVICE" in
    backend)
        deploy_service_blue_green "backend"
        ;;
    frontend)
        deploy_service_blue_green "frontend"
        ;;
    all)
        deploy_with_terraform
        echo ""
        deploy_service_blue_green "backend"
        echo ""
        deploy_service_blue_green "frontend"
        ;;
    rollback-backend)
        rollback_deployment "backend"
        ;;
    rollback-frontend)
        rollback_deployment "frontend"
        ;;
    *)
        echo -e "${RED}Unknown service: $SERVICE${NC}"
        echo "Usage: $0 <environment> <service> [deployment-type]"
        echo "Services: backend, frontend, all, rollback-backend, rollback-frontend"
        exit 1
        ;;
esac

echo -e "${GREEN}=== Deployment Complete ===${NC}"
