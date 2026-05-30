#!/bin/bash
# Pre-deployment validation for 100K scale
# Run this before ANY production deploy

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Pre-Deployment Validation ===${NC}\n"

FAILED=0

# 1. Check git status
echo "1. Checking git status..."
if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}✗ Uncommitted changes exist. Commit before deploying.${NC}"
    git status
    FAILED=$((FAILED+1))
else
    echo -e "${GREEN}✓ Git working tree clean${NC}"
fi

# 2. Check all tests pass
echo -e "\n2. Running tests..."
if cargo test --release 2>/dev/null; then
    echo -e "${GREEN}✓ All tests pass${NC}"
else
    echo -e "${RED}✗ Tests failed. Fix before deploying.${NC}"
    FAILED=$((FAILED+1))
fi

# 3. Check secrets are NOT in code
echo -e "\n3. Checking for exposed secrets..."
if git-secrets --scan 2>/dev/null; then
    echo -e "${GREEN}✓ No secrets detected${NC}"
else
    echo -e "${RED}✗ Secrets found in code. Remove before deploying.${NC}"
    FAILED=$((FAILED+1))
fi

# 4. Check dependencies
echo -e "\n4. Checking dependencies..."
if cargo audit 2>/dev/null | grep -q "0 vulnerabilities"; then
    echo -e "${GREEN}✓ No vulnerable dependencies${NC}"
else
    echo -e "${RED}✗ Vulnerable dependencies found. Run: cargo audit fix${NC}"
    FAILED=$((FAILED+1))
fi

# 5. Check Kubernetes manifests
echo -e "\n5. Validating Kubernetes manifests..."
for file in ../k8s/*.yaml; do
    if kubectl apply -f "$file" --dry-run=client -o yaml > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $file is valid${NC}"
    else
        echo -e "${RED}✗ $file is invalid${NC}"
        FAILED=$((FAILED+1))
    fi
done

# 6. Check Terraform
echo -e "\n6. Validating Terraform..."
if terraform validate ../terraform/ > /dev/null 2>&1; then
    echo -e "${GREEN}✓ Terraform valid${NC}"
else
    echo -e "${RED}✗ Terraform has errors. Run: terraform validate${NC}"
    FAILED=$((FAILED+1))
fi

# 7. Check environment variables
echo -e "\n7. Checking environment variables..."
REQUIRED_VARS=("DATABASE_URL" "REDIS_URL" "JWT_SECRET" "AWS_REGION")
for var in "${REQUIRED_VARS[@]}"; do
    if [ -z "${!var}" ]; then
        echo -e "${RED}✗ Missing: $var${NC}"
        FAILED=$((FAILED+1))
    else
        echo -e "${GREEN}✓ $var set${NC}"
    fi
done

# 8. Check image availability
echo -e "\n8. Checking Docker images..."
if docker image inspect valueskins/api-gateway:latest > /dev/null 2>&1; then
    echo -e "${GREEN}✓ API Gateway image ready${NC}"
else
    echo -e "${RED}✗ API Gateway image not built. Run: docker build -t valueskins/api-gateway:latest .${NC}"
    FAILED=$((FAILED+1))
fi

# 9. Check load test readiness
echo -e "\n9. Checking load test setup..."
if [ -f "../load-tests/k6-load-test.js" ]; then
    echo -e "${GREEN}✓ Load test script ready${NC}"
else
    echo -e "${RED}✗ Load test script missing${NC}"
    FAILED=$((FAILED+1))
fi

# 10. Check monitoring setup
echo -e "\n10. Checking monitoring setup..."
if [ -f "../monitoring/prometheus-rules.yaml" ]; then
    echo -e "${GREEN}✓ Prometheus rules ready${NC}"
else
    echo -e "${RED}✗ Prometheus rules missing${NC}"
    FAILED=$((FAILED+1))
fi

# Summary
echo -e "\n${YELLOW}=== Validation Summary ===${NC}"
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✓ All checks passed. Safe to deploy.${NC}"
    exit 0
else
    echo -e "${RED}✗ $FAILED checks failed. Fix before deploying.${NC}"
    exit 1
fi
