.PHONY: help aws-deploy aws-rollback k8s-deploy k8s-rollback k8s-promote terraform-init terraform-plan terraform-apply terraform-destroy splunk-deploy splunk-status splunk-logs splunk-health splunk-restart splunk-remove splunk-update-token terraform-validate terraform-output aws-deploy-backend aws-deploy-frontend aws-rollback-backend aws-rollback-frontend aws-status k8s-install-tools k8s-deploy-infrastructure k8s-deploy-backend k8s-deploy-frontend k8s-deploy-all k8s-restart k8s-logs k8s-shell k8s-abort monitoring-dashboard monitoring-prometheus monitoring-alerts validate-health build-images push-images clean quick-deploy-aws quick-deploy-k8s full-deploy

# Colors
RED    := $(shell tput -Txterm setaf 1)
GREEN  := $(shell tput -Txterm setaf 2)
YELLOW := $(shell tput -Txterm setaf 3)
WHITE  := $(shell tput -Txterm setaf 7)
CYAN   := $(shell tput -Txterm setaf 6)
RESET  := $(shell tput -Txterm sgr0)

# Variables
ENVIRONMENT ?= dev
SERVICE ?= all
IMAGE_TAG ?= $(error IMAGE_TAG is required — use a commit SHA or version tag, not 'latest')

help: ## Show this help
	@echo ''
	@echo 'Usage:'
	@echo '  ${YELLOW}make${RESET} ${GREEN}<target>${RESET}'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} { \
		if (/^[a-zA-Z_-]+:.*?##.*$$/) {printf "  ${YELLOW}%-30s${GREEN}%s${RESET}\n", $$1, $$2} \
		else if (/^## .*$$/) {printf "  ${CYAN}%s${RESET}\n", substr($$1,4)} \
		}' $(MAKEFILE_LIST)

##
## Terraform Commands
##

terraform-init: ## Initialize Terraform
	@echo "${GREEN}Initializing Terraform...${RESET}"
	cd terraform && terraform init -upgrade

terraform-validate: ## Validate Terraform configuration
	@echo "${GREEN}Validating Terraform configuration...${RESET}"
	cd terraform && terraform validate

terraform-plan: terraform-init terraform-validate ## Plan Terraform changes
	@echo "${GREEN}Planning Terraform changes for ${ENVIRONMENT}...${RESET}"
	cd terraform && terraform plan -var="environment=${ENVIRONMENT}" -out=tfplan

terraform-apply: ## Apply Terraform changes
	@echo "${GREEN}Applying Terraform changes for ${ENVIRONMENT}...${RESET}"
	cd terraform && terraform apply tfplan

terraform-destroy: ## Destroy Terraform infrastructure
	@echo "${YELLOW}WARNING: This will destroy all infrastructure!${RESET}"
	@read -p "Are you sure? [y/N] " -n 1 -r; \
	echo; \
	if [[ $$REPLY =~ ^[Yy]$$ ]]; then \
		cd terraform && terraform destroy -var="environment=${ENVIRONMENT}"; \
	fi

terraform-output: ## Show Terraform outputs
	@cd terraform && terraform output

##
## AWS Deployment Commands
##

aws-deploy: ## Deploy to AWS ECS with blue/green strategy
	@echo "${GREEN}Deploying ${SERVICE} to AWS ${ENVIRONMENT} environment...${RESET}"
	@chmod +x scripts/deploy-aws.sh
	@./scripts/deploy-aws.sh ${ENVIRONMENT} ${SERVICE} blue-green

aws-deploy-backend: ## Deploy backend to AWS
	@$(MAKE) aws-deploy SERVICE=backend

aws-deploy-frontend: ## Deploy frontend to AWS
	@$(MAKE) aws-deploy SERVICE=frontend

aws-rollback-backend: ## Rollback backend deployment on AWS
	@echo "${YELLOW}Rolling back backend on AWS...${RESET}"
	@chmod +x scripts/deploy-aws.sh
	@./scripts/deploy-aws.sh ${ENVIRONMENT} rollback-backend

aws-rollback-frontend: ## Rollback frontend deployment on AWS
	@echo "${YELLOW}Rolling back frontend on AWS...${RESET}"
	@chmod +x scripts/deploy-aws.sh
	@./scripts/deploy-aws.sh ${ENVIRONMENT} rollback-frontend

aws-status: ## Check AWS deployment status
	@echo "${CYAN}Checking AWS deployment status...${RESET}"
	@aws ecs describe-services \
		--cluster ai-curator-${ENVIRONMENT} \
		--services ai-curator-${ENVIRONMENT}-backend ai-curator-${ENVIRONMENT}-frontend \
		--query 'services[*].[serviceName,status,runningCount,desiredCount]' \
		--output table

##
## Kubernetes Deployment Commands
##

k8s-install-tools: ## Install Kubernetes deployment tools
	@echo "${GREEN}Installing kubectl and Argo Rollouts...${RESET}"
	@curl -LO "https://dl.k8s.io/release/$$(curl -L -s https://dl.k8s.io/release/stable.txt)/bin/linux/amd64/kubectl"
	@chmod +x kubectl && sudo mv kubectl /usr/local/bin/
	@curl -LO https://github.com/argoproj/argo-rollouts/releases/latest/download/kubectl-argo-rollouts-linux-amd64
	@chmod +x kubectl-argo-rollouts-linux-amd64 && sudo mv kubectl-argo-rollouts-linux-amd64 /usr/local/bin/kubectl-argo-rollouts

k8s-deploy-infrastructure: ## Deploy Kubernetes infrastructure (Istio, Argo Rollouts, Monitoring)
	@echo "${GREEN}Deploying Kubernetes infrastructure...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator infrastructure deploy

k8s-deploy: ## Deploy services to Kubernetes with canary strategy
	@echo "${GREEN}Deploying ${SERVICE} to Kubernetes...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator ${SERVICE} deploy ${IMAGE_TAG}

k8s-deploy-backend: ## Deploy backend to Kubernetes
	@$(MAKE) k8s-deploy SERVICE=backend

k8s-deploy-frontend: ## Deploy frontend to Kubernetes
	@$(MAKE) k8s-deploy SERVICE=frontend

k8s-deploy-all: ## Deploy all services to Kubernetes
	@$(MAKE) k8s-deploy SERVICE=all

k8s-status: ## Check Kubernetes deployment status
	@echo "${CYAN}Checking Kubernetes deployment status...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator ${SERVICE} status

k8s-promote: ## Promote canary deployment to stable
	@echo "${GREEN}Promoting ${SERVICE} canary deployment...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator ${SERVICE} promote

k8s-abort: ## Abort canary deployment
	@echo "${RED}Aborting ${SERVICE} canary deployment...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator ${SERVICE} abort

k8s-rollback: ## Rollback Kubernetes deployment
	@echo "${YELLOW}Rolling back ${SERVICE} on Kubernetes...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator ${SERVICE} rollback

k8s-restart: ## Restart Kubernetes deployment
	@echo "${GREEN}Restarting ${SERVICE} on Kubernetes...${RESET}"
	@chmod +x scripts/deploy-k8s.sh
	@./scripts/deploy-k8s.sh ai-curator ${SERVICE} restart

k8s-logs: ## Tail logs from Kubernetes deployment
	@kubectl logs -f -l app=${SERVICE} -n ai-curator --tail=100

k8s-shell: ## Get shell access to a pod
	@kubectl exec -it $$(kubectl get pod -n ai-curator -l app=${SERVICE} -o jsonpath='{.items[0].metadata.name}') -n ai-curator -- /bin/sh

##
## Monitoring Commands
##

monitoring-dashboard: ## Open Grafana dashboard
	@echo "${CYAN}Opening Grafana dashboard...${RESET}"
	@echo "Access Grafana at: http://localhost:3000"
	@kubectl port-forward -n monitoring svc/grafana 3000:3000

monitoring-prometheus: ## Open Prometheus UI
	@echo "${CYAN}Opening Prometheus UI...${RESET}"
	@echo "Access Prometheus at: http://localhost:9090"
	@kubectl port-forward -n monitoring svc/prometheus 9090:9090

monitoring-alerts: ## View active alerts
	@echo "${CYAN}Fetching active alerts...${RESET}"
	@kubectl get prometheusrules -A

##
## Splunk Observability Commands
##

splunk-deploy: ## Deploy Splunk OTEL Collector to Kubernetes
	@echo "${GREEN}Deploying Splunk OTEL Collector...${RESET}"
	@kubectl apply -f kubernetes/monitoring/splunk-otel-collector.yaml
	@echo "${GREEN}Splunk OTEL Collector deployed${RESET}"

splunk-status: ## Check Splunk OTEL Collector status
	@echo "${CYAN}Checking Splunk OTEL Collector status...${RESET}"
	@echo "--- DaemonSet (node agents) ---"
	@kubectl get daemonset -n splunk-monitoring -l app.kubernetes.io/name=splunk-otel-collector
	@echo ""
	@echo "--- Cluster Receiver ---"
	@kubectl get deployment -n splunk-monitoring -l app.kubernetes.io/component=cluster-receiver
	@echo ""
	@echo "--- All Pods ---"
	@kubectl get pods -n splunk-monitoring
	@echo ""
	@echo "--- Collector Service ---"
	@kubectl get svc -n splunk-monitoring

splunk-logs: ## Tail Splunk OTEL Collector logs
	@echo "${CYAN}Tailing Splunk OTEL Collector agent logs...${RESET}"
	@kubectl logs -f -l app.kubernetes.io/name=splunk-otel-collector -n splunk-monitoring --tail=100

splunk-health: ## Check Splunk OTEL Collector health
	@echo "${CYAN}Checking OTEL Collector health...${RESET}"
	@kubectl exec -n splunk-monitoring $$(kubectl get pod -n splunk-monitoring -l app.kubernetes.io/component=agent -o jsonpath='{.items[0].metadata.name}') -- curl -sf http://localhost:13133/ && echo "Healthy" || echo "Unhealthy"

splunk-restart: ## Restart Splunk OTEL Collector
	@echo "${YELLOW}Restarting Splunk OTEL Collector...${RESET}"
	@kubectl rollout restart daemonset/splunk-otel-collector-agent -n splunk-monitoring
	@kubectl rollout restart deployment/splunk-otel-collector-cluster-receiver -n splunk-monitoring
	@echo "${GREEN}Restart initiated${RESET}"

splunk-remove: ## Remove Splunk OTEL Collector from Kubernetes
	@echo "${YELLOW}Removing Splunk OTEL Collector...${RESET}"
	@kubectl delete -f kubernetes/monitoring/splunk-otel-collector.yaml --ignore-not-found
	@echo "${GREEN}Splunk OTEL Collector removed${RESET}"

splunk-update-token: ## Update Splunk HEC token secret
	@echo "${YELLOW}Updating Splunk HEC token...${RESET}"
	@read -sp "Enter Splunk HEC Token: " TOKEN; \
	echo; \
	kubectl create secret generic splunk-otel-collector \
		--namespace=splunk-monitoring \
		--from-literal=splunk_hec_token="$$TOKEN" \
		--from-literal=splunk_observability_access_token="$$TOKEN" \
		--dry-run=client -o yaml | kubectl apply -f -
	@echo "${GREEN}Splunk HEC token updated${RESET}"

##
## Utility Commands
##

validate-health: ## Validate health of all services
	@echo "${CYAN}Checking service health...${RESET}"
	@echo "Backend health:"
	@curl -f http://backend.ai-curator.svc.cluster.local/health || echo "Backend unhealthy"
	@echo "\nFrontend health:"
	@curl -f http://frontend.ai-curator.svc.cluster.local/api/health || echo "Frontend unhealthy"

build-images: ## Build all Docker images locally
	@echo "${GREEN}Building Docker images...${RESET}"
	@cd ../backend && docker build -t ghcr.io/hoangsonww/ai-curator-backend:${IMAGE_TAG} .
	@cd ../frontend && docker build -t ghcr.io/hoangsonww/ai-curator-frontend:${IMAGE_TAG} .
	@cd ../crawler && docker build -t ghcr.io/hoangsonww/ai-curator-crawler:${IMAGE_TAG} .
	@cd ../newsletters && docker build -t ghcr.io/hoangsonww/ai-curator-newsletters:${IMAGE_TAG} .

push-images: ## Push Docker images to registry
	@echo "${GREEN}Pushing Docker images...${RESET}"
	@docker push ghcr.io/hoangsonww/ai-curator-backend:${IMAGE_TAG}
	@docker push ghcr.io/hoangsonww/ai-curator-frontend:${IMAGE_TAG}
	@docker push ghcr.io/hoangsonww/ai-curator-crawler:${IMAGE_TAG}
	@docker push ghcr.io/hoangsonww/ai-curator-newsletters:${IMAGE_TAG}

clean: ## Clean up temporary files (preserves .terraform.lock.hcl)
	@echo "${YELLOW}Cleaning up...${RESET}"
	@cd terraform && rm -f tfplan
	@rm -rf .terraform/modules .terraform/providers

##
## Quick Deploy Commands
##

quick-deploy-aws: terraform-plan terraform-apply aws-deploy ## Quick deploy to AWS
	@echo "${GREEN}AWS deployment complete!${RESET}"

quick-deploy-k8s: k8s-deploy-all ## Quick deploy to Kubernetes
	@echo "${GREEN}Kubernetes deployment complete!${RESET}"

full-deploy: quick-deploy-aws quick-deploy-k8s ## Deploy to both AWS and Kubernetes
	@echo "${GREEN}Full deployment complete!${RESET}"
