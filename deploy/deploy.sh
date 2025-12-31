#!/bin/bash
# Logic Apps MCP Server - Deployment Script
#
# Deploys a pure MCP server with passthrough authentication:
# - Function App (MCP server with 30+ Logic Apps tools)
# - Storage Account (for Functions runtime)
# - Application Insights (telemetry)
#
# Authentication: Passthrough - clients must provide ARM-scoped bearer token
# No Azure OpenAI, no managed identity for ARM access.
#
# Usage:
#   ./deploy.sh -g <resource-group>
#   ./deploy.sh -g <resource-group> -p myapp --create-rg

set -e

# Default values
RESOURCE_GROUP=""
PREFIX=""
LOCATION="westus2"
CREATE_RG=false
SKIP_CODE_DEPLOY=false
YES=false

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
        --create-rg)
            CREATE_RG=true
            shift
            ;;
        --skip-code-deploy)
            SKIP_CODE_DEPLOY=true
            shift
            ;;
        -y|--yes)
            YES=true
            shift
            ;;
        -h|--help)
            echo "Usage: $0 -g <resource-group> [options]"
            echo ""
            echo "Required:"
            echo "  -g, --resource-group    Resource group name"
            echo ""
            echo "Optional:"
            echo "  -p, --prefix            Resource name prefix (auto-generated if not provided)"
            echo "  -l, --location          Azure region (default: westus2)"
            echo "  --create-rg             Create resource group if it doesn't exist"
            echo "  --skip-code-deploy      Skip building and deploying function code"
            echo "  -y, --yes               Skip confirmation prompt"
            echo ""
            echo "Examples:"
            echo "  # Basic deployment:"
            echo "  $0 -g my-rg"
            echo ""
            echo "  # With custom prefix and new resource group:"
            echo "  $0 -g my-rg -p lamcp --create-rg"
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

echo "============================================"
echo "Logic Apps MCP Server"
echo "(Passthrough Authentication)"
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
echo "Location:     $LOCATION"
echo ""

# Ask for consent before creating resources (skip if --yes flag)
if [ "$YES" = false ]; then
    echo "This will create resources in the subscription above."
    read -p "Do you want to continue? (y/N) " consent
    if [ "$consent" != "y" ] && [ "$consent" != "Y" ]; then
        echo "Deployment cancelled."
        exit 0
    fi
    echo ""
fi

# Create resource group if requested
if [ "$CREATE_RG" = true ]; then
    echo "Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" > /dev/null
    echo "Resource group created."
    echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Build parameters
PARAMS="location=$LOCATION"

if [ -n "$PREFIX" ]; then
    PARAMS="$PARAMS prefix=$PREFIX"
fi

# Deploy Bicep template
echo "Deploying infrastructure..."

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
MCP_ENDPOINT=$(echo "$RESULT" | jq -r '.mcpEndpoint.value')
HEALTH_ENDPOINT=$(echo "$RESULT" | jq -r '.healthEndpoint.value')

echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Function App: $FUNCTION_APP_NAME"
echo ""
echo "Endpoints:"
echo "  MCP:    $MCP_ENDPOINT"
echo "  Health: $HEALTH_ENDPOINT"
echo ""
echo "--------------------------------------------"
echo "Authentication: PASSTHROUGH"
echo ""
echo "Clients must provide ARM-scoped bearer token:"
echo '  Authorization: Bearer <token>'
echo ""
echo "Get token:"
echo '  az account get-access-token --resource https://management.azure.com --query accessToken -o tsv'
echo ""
echo "Test:"
echo '  TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)'
echo "  curl -H \"Authorization: Bearer \$TOKEN\" $HEALTH_ENDPOINT"
echo ""
