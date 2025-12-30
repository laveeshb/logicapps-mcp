#!/bin/bash
# Logic Apps MCP Server - Deployment Script
#
# This script deploys the Logic Apps AI Assistant to Azure:
# 1. Creates infrastructure (Function App, Storage, App Insights, Managed Identity)
# 2. Configures Easy Auth to restrict access to the deployer
# 3. Builds and deploys the function code
#
# After deployment, grant the managed identity RBAC access to your Logic Apps.
#
# Usage:
#   ./deploy.sh -g <resource-group> --ai-endpoint <endpoint>
#
# Examples:
#   ./deploy.sh -g lamcp-rg -p lamcp --ai-endpoint https://my-openai.openai.azure.com

set -e

# Default values
RESOURCE_GROUP=""
PREFIX=""
LOCATION="eastus"
AI_FOUNDRY_ENDPOINT=""
AI_FOUNDRY_DEPLOYMENT="gpt-4o"
CREATE_RG=false
SKIP_CODE_DEPLOY=false

# Parse arguments
while [[ $# -gt 0 ]]; do
    case $1 in
        -g|--resource-group)
            RESOURCE_GROUP="$2"
            shift 2
            ;;
        -p|--prefix)
            PREFIX="$2"
            shift 2
            ;;
        -l|--location)
            LOCATION="$2"
            shift 2
            ;;
        --ai-endpoint)
            AI_FOUNDRY_ENDPOINT="$2"
            shift 2
            ;;
        --ai-deployment)
            AI_FOUNDRY_DEPLOYMENT="$2"
            shift 2
            ;;
        --create-rg)
            CREATE_RG=true
            shift
            ;;
        --skip-code-deploy)
            SKIP_CODE_DEPLOY=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 -g <resource-group> --ai-endpoint <endpoint> [-p <prefix>] [-l <location>]"
            echo ""
            echo "Required:"
            echo "  -g, --resource-group  Resource group name"
            echo "  --ai-endpoint         Azure OpenAI endpoint URL"
            echo ""
            echo "Optional:"
            echo "  -p, --prefix          Resource name prefix"
            echo "  -l, --location        Azure region (default: eastus)"
            echo "  --ai-deployment       AI deployment name (default: gpt-4o)"
            echo "  --create-rg           Create resource group if it doesn't exist"
            echo "  --skip-code-deploy    Skip building and deploying function code"
            exit 0
            ;;
        *)
            echo "Unknown option: $1"
            exit 1
            ;;
    esac
done

# Validate required parameters
if [ -z "$RESOURCE_GROUP" ]; then
    echo "Error: Resource group is required. Use -g or --resource-group."
    exit 1
fi

if [ -z "$AI_FOUNDRY_ENDPOINT" ]; then
    echo "Error: AI endpoint is required. Use --ai-endpoint."
    exit 1
fi

echo "============================================"
echo "Logic Apps MCP Server - Deployment"
echo "============================================"
echo ""

# Check prerequisites
echo "Checking prerequisites..."

# Check Azure CLI
ACCOUNT=$(az account show 2>/dev/null) || {
    echo "Error: Not logged in to Azure. Please run 'az login' first."
    exit 1
}
USER_NAME=$(echo "$ACCOUNT" | jq -r '.user.name')
SUB_NAME=$(echo "$ACCOUNT" | jq -r '.name')
echo "  Azure CLI: Logged in as $USER_NAME"

# Check Azure Functions Core Tools
if [ "$SKIP_CODE_DEPLOY" = false ]; then
    FUNC_VERSION=$(func --version 2>/dev/null) || {
        echo "Error: Azure Functions Core Tools not found."
        echo "Install from: https://learn.microsoft.com/azure/azure-functions/functions-run-local"
        exit 1
    }
    echo "  Functions Core Tools: v$FUNC_VERSION"
fi

# Check npm
if [ "$SKIP_CODE_DEPLOY" = false ]; then
    NPM_VERSION=$(npm --version 2>/dev/null) || {
        echo "Error: npm not found. Please install Node.js."
        exit 1
    }
    echo "  npm: v$NPM_VERSION"
fi

echo ""
echo "Subscription: $SUB_NAME"
echo "AI Endpoint:  $AI_FOUNDRY_ENDPOINT"
echo "AI Model:     $AI_FOUNDRY_DEPLOYMENT"
echo ""

# Get deployer's object ID for Easy Auth (required)
echo "Fetching your Azure AD object ID for Easy Auth..."
DEPLOYER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv 2>/dev/null) || true
if [ -z "$DEPLOYER_OBJECT_ID" ]; then
    echo "Error: Could not fetch your Azure AD object ID."
    echo "Make sure you're logged in with 'az login' and have Azure AD access."
    exit 1
fi
echo "Your Object ID: $DEPLOYER_OBJECT_ID"
echo ""

# Create resource group if requested
if [ "$CREATE_RG" = true ]; then
    echo "Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" > /dev/null
    echo "Resource group created."
    echo ""
fi

# Build parameters
PARAMS="location=$LOCATION aiFoundryEndpoint=$AI_FOUNDRY_ENDPOINT aiFoundryDeployment=$AI_FOUNDRY_DEPLOYMENT enableEasyAuth=true deployerObjectId=$DEPLOYER_OBJECT_ID"

if [ -n "$PREFIX" ]; then
    PARAMS="$PARAMS prefix=$PREFIX"
fi

# Deploy Bicep template
echo "Deploying infrastructure..."
echo "  Resource Group: $RESOURCE_GROUP"

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"
TEMPLATE_PATH="$SCRIPT_DIR/bicep/main.bicep"

RESULT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$TEMPLATE_PATH" \
    --parameters $PARAMS \
    --query "properties.outputs" \
    -o json)

if [ $? -ne 0 ]; then
    echo "Infrastructure deployment failed!"
    exit 1
fi

FUNCTION_APP_NAME=$(echo "$RESULT" | jq -r '.functionAppName.value')
echo "Infrastructure deployed."
echo ""

# Build and deploy function code
if [ "$SKIP_CODE_DEPLOY" = false ]; then
    echo "Building function code..."
    cd "$REPO_ROOT"
    npm ci --silent 2>/dev/null || npm install --silent
    npm run build
    if [ $? -ne 0 ]; then
        echo "Build failed!"
        exit 1
    fi
    echo "Build completed."
    echo ""

    echo "Deploying function code to $FUNCTION_APP_NAME..."
    func azure functionapp publish "$FUNCTION_APP_NAME"
    if [ $? -ne 0 ]; then
        echo "Code deployment failed!"
        exit 1
    fi
    echo "Code deployed."
    echo ""
fi

# Output results
FUNCTION_APP_URL=$(echo "$RESULT" | jq -r '.functionAppUrl.value')
HEALTH_ENDPOINT=$(echo "$RESULT" | jq -r '.healthEndpoint.value')
MCP_ENDPOINT=$(echo "$RESULT" | jq -r '.mcpServerEndpoint.value')
MANAGED_IDENTITY_PRINCIPAL_ID=$(echo "$RESULT" | jq -r '.managedIdentityPrincipalId.value')

echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Function App:     $FUNCTION_APP_NAME"
echo "Managed Identity: $MANAGED_IDENTITY_PRINCIPAL_ID"
echo ""
echo "Endpoints:"
echo "  Health: $HEALTH_ENDPOINT"
echo "  MCP:    $MCP_ENDPOINT"
echo "  Agent:  ${FUNCTION_APP_URL}/api/agent"
echo ""
echo "Easy Auth: ENABLED (only you can access)"
echo ""
echo "To call the API:"
echo '  TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)'
echo "  curl -H \"Authorization: Bearer \$TOKEN\" $HEALTH_ENDPOINT"
echo ""
echo "============================================"
echo "NEXT STEP: Grant RBAC access"
echo "============================================"
echo ""
echo "The managed identity needs access to your Logic Apps and Azure OpenAI."
echo ""
echo "1. Grant access to Azure OpenAI:"
echo "   az role assignment create \\"
echo "     --assignee $MANAGED_IDENTITY_PRINCIPAL_ID \\"
echo "     --role 'Cognitive Services OpenAI User' \\"
echo "     --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<openai-resource>"
echo ""
echo "2. Grant access to Logic Apps (repeat for each subscription):"
echo "   az role assignment create \\"
echo "     --assignee $MANAGED_IDENTITY_PRINCIPAL_ID \\"
echo "     --role 'Reader' \\"
echo "     --scope /subscriptions/<subscription-id>"
echo ""
