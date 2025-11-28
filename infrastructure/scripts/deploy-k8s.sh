#!/bin/bash

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
NAMESPACE=${1:-ai-curator}
SERVICE=${2:-all}
ACTION=${3:-deploy}  # deploy, rollback, promote, abort, status
IMAGE_TAG=${4:-latest}

echo -e "${GREEN}=== AI Curator Kubernetes Deployment ===${NC}"
echo "Namespace: $NAMESPACE"
echo "Service: $SERVICE"
echo "Action: $ACTION"
echo "Image Tag: $IMAGE_TAG"
echo ""

# Check if kubectl is installed
if ! command -v kubectl &> /dev/null; then
    echo -e "${RED}Error: kubectl is not installed${NC}"
    exit 1
fi

# Check if kubectl-argo-rollouts is installed
if ! command -v kubectl-argo-rollouts &> /dev/null; then
    echo -e "${YELLOW}Warning: kubectl-argo-rollouts plugin not installed${NC}"
    echo "Install with: curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64"
fi

# Function to deploy infrastructure
deploy_infrastructure() {
    echo -e "${YELLOW}Deploying Kubernetes infrastructure...${NC}"

    # Create namespace
    kubectl create namespace $NAMESPACE --dry-run=client -o yaml | kubectl apply -f -

    # Create namespace for monitoring
    kubectl create namespace monitoring --dry-run=client -o yaml | kubectl apply -f -

    # Install Istio (if not already installed)
    if ! kubectl get namespace istio-system &> /dev/null; then
        echo -e "${YELLOW}Installing Istio...${NC}"
        curl -L https://istio.io/downloadIstio | sh -
        cd istio-*
        export PATH=$PWD/bin:$PATH
        istioctl install --set profile=default -y
        cd ..
    else
        echo -e "${GREEN}Istio already installed${NC}"
    fi

    # Label namespace for Istio injection
    kubectl label namespace $NAMESPACE istio-injection=enabled --overwrite

    # Install Argo Rollouts (if not already installed)
    if ! kubectl get namespace argo-rollouts &> /dev/null; then
        echo -e "${YELLOW}Installing Argo Rollouts...${NC}"
        kubectl create namespace argo-rollouts
        kubectl apply -n argo-rollouts -f https://github.com/argoproj/argo-rollouts/releases/latest/download/install.yaml
    else
        echo -e "${GREEN}Argo Rollouts already installed${NC}"
    fi

    # Deploy monitoring stack
    echo -e "${YELLOW}Deploying Prometheus and Grafana...${NC}"
    kubectl apply -f infrastructure/kubernetes/monitoring/

    # Deploy Istio gateway and virtual services
    echo -e "${YELLOW}Deploying Istio configuration...${NC}"
    kubectl apply -f infrastructure/kubernetes/istio/

    echo -e "${GREEN}Infrastructure deployment complete${NC}"
}

# Function to update secrets
update_secrets() {
    echo -e "${YELLOW}Updating secrets...${NC}"

    # Prompt for secret values if not set
    if [ -z "$MONGODB_URI" ]; then
        read -sp "Enter MongoDB URI: " MONGODB_URI
        echo ""
    fi

    if [ -z "$GOOGLE_AI_API_KEY" ]; then
        read -sp "Enter Google AI API Key: " GOOGLE_AI_API_KEY
        echo ""
    fi

    if [ -z "$RESEND_API_KEY" ]; then
        read -sp "Enter Resend API Key: " RESEND_API_KEY
        echo ""
    fi

    if [ -z "$NEWS_API_KEY" ]; then
        read -sp "Enter News API Key: " NEWS_API_KEY
        echo ""
    fi

    # Create secrets
    kubectl create secret generic backend-secrets \
        --namespace=$NAMESPACE \
        --from-literal=MONGODB_URI="$MONGODB_URI" \
        --from-literal=GOOGLE_AI_API_KEY="$GOOGLE_AI_API_KEY" \
        --from-literal=RESEND_API_KEY="$RESEND_API_KEY" \
        --from-literal=NEWS_API_KEY="$NEWS_API_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic crawler-secrets \
        --namespace=$NAMESPACE \
        --from-literal=MONGODB_URI="$MONGODB_URI" \
        --from-literal=GOOGLE_AI_API_KEY="$GOOGLE_AI_API_KEY" \
        --from-literal=NEWS_API_KEY="$NEWS_API_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -

    kubectl create secret generic newsletter-secrets \
        --namespace=$NAMESPACE \
        --from-literal=MONGODB_URI="$MONGODB_URI" \
        --from-literal=RESEND_API_KEY="$RESEND_API_KEY" \
        --dry-run=client -o yaml | kubectl apply -f -

    echo -e "${GREEN}Secrets updated${NC}"
}

# Function to deploy a service
deploy_service() {
    local service_name=$1

    echo -e "${YELLOW}Deploying $service_name service...${NC}"

    # Update image tag in the deployment
    sed "s/:latest/:$IMAGE_TAG/g" infrastructure/kubernetes/$service_name/deployment.yaml | kubectl apply -f -

    # Wait for rollout to start
    sleep 5

    # Show rollout status
    kubectl argo rollouts get rollout $service_name -n $NAMESPACE --watch

    echo -e "${GREEN}$service_name deployed successfully${NC}"
}

# Function to deploy cron jobs
deploy_cronjobs() {
    echo -e "${YELLOW}Deploying cron jobs...${NC}"

    kubectl apply -f infrastructure/kubernetes/cronjobs/

    echo -e "${GREEN}Cron jobs deployed${NC}"
}

# Function to check rollout status
check_status() {
    local service_name=$1

    echo -e "${BLUE}=== Rollout Status for $service_name ===${NC}"

    kubectl argo rollouts get rollout $service_name -n $NAMESPACE

    echo ""
    echo -e "${BLUE}=== Pods ===${NC}"
    kubectl get pods -n $NAMESPACE -l app=$service_name

    echo ""
    echo -e "${BLUE}=== Services ===${NC}"
    kubectl get svc -n $NAMESPACE -l app=$service_name
}

# Function to promote a canary deployment
promote_deployment() {
    local service_name=$1

    echo -e "${YELLOW}Promoting $service_name canary deployment...${NC}"

    kubectl argo rollouts promote $service_name -n $NAMESPACE

    echo -e "${GREEN}Deployment promoted${NC}"
}

# Function to abort a deployment
abort_deployment() {
    local service_name=$1

    echo -e "${RED}Aborting $service_name deployment...${NC}"

    kubectl argo rollouts abort $service_name -n $NAMESPACE

    echo -e "${GREEN}Deployment aborted${NC}"
}

# Function to rollback a deployment
rollback_deployment() {
    local service_name=$1

    echo -e "${YELLOW}Rolling back $service_name...${NC}"

    # Get previous revision
    PREVIOUS_REVISION=$(kubectl argo rollouts history $service_name -n $NAMESPACE | tail -n 2 | head -n 1 | awk '{print $1}')

    if [ -z "$PREVIOUS_REVISION" ]; then
        echo -e "${RED}No previous revision found${NC}"
        exit 1
    fi

    echo "Rolling back to revision: $PREVIOUS_REVISION"

    # Undo to previous revision
    kubectl argo rollouts undo $service_name -n $NAMESPACE --to-revision=$PREVIOUS_REVISION

    # Wait for rollout to complete
    kubectl argo rollouts get rollout $service_name -n $NAMESPACE --watch

    echo -e "${GREEN}Rollback completed${NC}"
}

# Function to restart a deployment
restart_deployment() {
    local service_name=$1

    echo -e "${YELLOW}Restarting $service_name...${NC}"

    kubectl argo rollouts restart $service_name -n $NAMESPACE

    echo -e "${GREEN}$service_name restarted${NC}"
}

# Function to check deployment health
check_health() {
    local service_name=$1
    local path="/health"

    if [ "$service_name" == "frontend" ]; then
        path="/api/health"
    fi

    echo -e "${YELLOW}Checking health for $service_name...${NC}"

    # Get service endpoint
    INGRESS_IP=$(kubectl get svc istio-ingressgateway -n istio-system -o jsonpath='{.status.loadBalancer.ingress[0].ip}')

    if [ -z "$INGRESS_IP" ]; then
        echo -e "${YELLOW}Ingress IP not available yet, using port-forward...${NC}"
        kubectl port-forward -n $NAMESPACE svc/$service_name 8080:80 &
        PF_PID=$!
        sleep 5
        ENDPOINT="http://localhost:8080$path"
    else
        ENDPOINT="http://$INGRESS_IP$path"
    fi

    # Check health endpoint
    for i in {1..30}; do
        if curl -sf "$ENDPOINT" > /dev/null; then
            echo -e "${GREEN}Health check passed${NC}"
            if [ ! -z "$PF_PID" ]; then
                kill $PF_PID
            fi
            return 0
        fi
        echo "Attempt $i: Waiting for service to be healthy..."
        sleep 10
    done

    if [ ! -z "$PF_PID" ]; then
        kill $PF_PID
    fi

    echo -e "${RED}Health check failed${NC}"
    return 1
}

# Main logic
case "$ACTION" in
    deploy)
        case "$SERVICE" in
            backend)
                deploy_service "backend"
                check_health "backend"
                ;;
            frontend)
                deploy_service "frontend"
                check_health "frontend"
                ;;
            cronjobs)
                deploy_cronjobs
                ;;
            all)
                update_secrets
                deploy_service "backend"
                deploy_service "frontend"
                deploy_cronjobs
                check_health "backend"
                check_health "frontend"
                ;;
            infrastructure)
                deploy_infrastructure
                ;;
            *)
                echo -e "${RED}Unknown service: $SERVICE${NC}"
                echo "Services: backend, frontend, cronjobs, all, infrastructure"
                exit 1
                ;;
        esac
        ;;
    status)
        if [ "$SERVICE" == "all" ]; then
            check_status "backend"
            echo ""
            check_status "frontend"
        else
            check_status "$SERVICE"
        fi
        ;;
    promote)
        promote_deployment "$SERVICE"
        ;;
    abort)
        abort_deployment "$SERVICE"
        ;;
    rollback)
        rollback_deployment "$SERVICE"
        ;;
    restart)
        restart_deployment "$SERVICE"
        ;;
    *)
        echo -e "${RED}Unknown action: $ACTION${NC}"
        echo "Actions: deploy, rollback, promote, abort, status, restart"
        exit 1
        ;;
esac

echo -e "${GREEN}=== Operation Complete ===${NC}"
