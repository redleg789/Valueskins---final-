#!/bin/bash
# Deploy script for Kubernetes infrastructure

set -e

ENVIRONMENT=${1:-dev}
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "=== ValueSkins K8s Deploy ==="
echo "Environment: $ENVIRONMENT"
echo ""

# Check prerequisites
command -v kubectl >/dev/null 2>&1 || { echo "kubectl required"; exit 1; }
command -v helm >/dev/null 2>&1 || { echo "helm required"; exit 1; }

# Apply base configs
echo "Applying base configurations..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/00-namespace.yaml"
kubectl apply -f "$SCRIPT_DIR/k8s/base/08-secrets.yaml"

# Apply environment-specific overlays
if [ -d "$SCRIPT_DIR/k8s/overlays/$ENVIRONMENT" ]; then
    echo "Applying $ENVIRONMENT overlay..."
    kubectl apply -k "$SCRIPT_DIR/k8s/overlays/$ENVIRONMENT"
fi

# Deploy infrastructure components
echo "Deploying Redis..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/03-redis.yaml"

echo "Deploying PgBouncer..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/04-pgbouncer.yaml"

# Deploy application
echo "Deploying API Gateway..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/01-api-gateway.yaml"

echo "Deploying Frontend..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/02-frontend.yaml"

# Deploy ingress
echo "Deploying Ingress..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/05-ingress.yaml"

# Deploy network policies
echo "Applying Network Policies..."
kubectl apply -f "$SCRIPT_DIR/k8s/base/06-network-policies.yaml"

# Wait for deployments
echo "Waiting for pods to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/api-gateway -n valueskins
kubectl wait --for=condition=available --timeout=300s deployment/frontend -n valueskins

# Show status
echo ""
echo "=== Deployment Complete ==="
kubectl get pods -n valueskins
kubectl get services -n valueskins
kubectl get hpa -n valueskins

echo ""
echo "=== Scaling Configuration ==="
echo "API Gateway: 3-50 replicas (auto-scaled at 70% CPU)"
echo "Frontend: 3-30 replicas (auto-scaled at 70% CPU)"
echo "Redis: 3-10 replicas (auto-scaled at 80% memory)"
echo "PgBouncer: 2-6 replicas"

echo ""
echo "=== Estimated Capacity ==="
echo "API Gateway: 1000-5000 concurrent requests/pod × 50 pods = 100K+ users"
echo "Frontend: 1000 requests/pod × 30 pods = 30K+ users"
echo "Database: PgBouncer pool 25 × 6 pods = 150 connections"
echo "Redis: 1K+ connections per instance"