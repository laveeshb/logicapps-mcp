#!/bin/bash
# Logic Apps MCP Server - Deployment Script
#
# This script deploys the Logic Apps AI Assistant infrastructure to Azure.
# Easy Auth is always enabled to restrict access to the deployer.
#
# Usage:
#   ./deploy.sh -g <resource-group> -p <prefix>
#
# Examples:
#   ./deploy.sh -g lamcp-rg -p lamcp
#   ./deploy.sh -g lamcp-rg -p lamcp -l eastus2

set -e

# Default values
RESOURCE_GROUP=""
PREFIX=""
LOCATION="eastus"
AI_FOUNDRY_ENDPOINT=""
AI_FOUNDRY_DEPLOYMENT="gpt-4o"
CREATE_RG=false

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
        -h|--help)
            echo "Usage: $0 -g <resource-group> [-p <prefix>] [-l <location>]"
            echo ""
            echo "Options:"
            echo "  -g, --resource-group  Resource group name (required)"
            echo "  -p, --prefix          Resource name prefix"
            echo "  -l, --location        Azure region (default: eastus)"
            echo "  --ai-endpoint         Azure AI Foundry endpoint URL"
            echo "  --ai-deployment       AI deployment name (default: gpt-4o)"
            echo "  --create-rg           Create resource group if it doesn't exist"
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
echo "Logic Apps MCP Server - Deployment"
echo "============================================"
echo ""

# Check if logged in to Azure
echo "Checking Azure login status..."
ACCOUNT=$(az account show 2>/dev/null) || {
    echo "Not logged in to Azure. Please run 'az login' first."
    exit 1
}
USER_NAME=$(echo "$ACCOUNT" | jq -r '.user.name')
SUB_NAME=$(echo "$ACCOUNT" | jq -r '.name')
SUB_ID=$(echo "$ACCOUNT" | jq -r '.id')
echo "Logged in as: $USER_NAME"
echo "Subscription: $SUB_NAME ($SUB_ID)"
echo ""

# Get deployer's object ID for Easy Auth (required)
echo "Fetching your Azure AD object ID for Easy Auth..."
DEPLOYER_OBJECT_ID=$(az ad signed-in-user show --query id -o tsv 2>/dev/null) || true
if [ -z "$DEPLOYER_OBJECT_ID" ]; then
    echo "Error: Could not fetch your Azure AD object ID. Easy Auth requires this."
    echo "Make sure you're logged in with 'az login' and have Azure AD access."
    exit 1
fi
echo "Your Object ID: $DEPLOYER_OBJECT_ID"
echo "Easy Auth will be configured to allow only you to access the API."
echo ""

# Create resource group if requested
if [ "$CREATE_RG" = true ]; then
    echo "Creating resource group '$RESOURCE_GROUP' in '$LOCATION'..."
    az group create --name "$RESOURCE_GROUP" --location "$LOCATION" > /dev/null
    echo "Resource group created."
    echo ""
fi

# Build parameters
PARAMS="location=$LOCATION"

if [ -n "$PREFIX" ]; then
    PARAMS="$PARAMS prefix=$PREFIX"
fi

if [ -n "$AI_FOUNDRY_ENDPOINT" ]; then
    PARAMS="$PARAMS aiFoundryEndpoint=$AI_FOUNDRY_ENDPOINT"
fi

if [ -n "$AI_FOUNDRY_DEPLOYMENT" ]; then
    PARAMS="$PARAMS aiFoundryDeployment=$AI_FOUNDRY_DEPLOYMENT"
fi

PARAMS="$PARAMS enableEasyAuth=true deployerObjectId=$DEPLOYER_OBJECT_ID"

# Deploy Bicep template
echo "Deploying infrastructure..."
echo "Resource Group: $RESOURCE_GROUP"
echo "Parameters: $PARAMS"
echo ""

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TEMPLATE_PATH="$SCRIPT_DIR/bicep/main.bicep"

RESULT=$(az deployment group create \
    --resource-group "$RESOURCE_GROUP" \
    --template-file "$TEMPLATE_PATH" \
    --parameters $PARAMS \
    --query "properties.outputs" \
    -o json)

if [ $? -ne 0 ]; then
    echo "Deployment failed!"
    exit 1
fi

echo ""
echo "============================================"
echo "Deployment Successful!"
echo "============================================"
echo ""

FUNCTION_APP_NAME=$(echo "$RESULT" | jq -r '.functionAppName.value')
FUNCTION_APP_URL=$(echo "$RESULT" | jq -r '.functionAppUrl.value')
LOGIC_APP_NAME=$(echo "$RESULT" | jq -r '.logicAppName.value')
APP_INSIGHTS_NAME=$(echo "$RESULT" | jq -r '.appInsightsName.value')
HEALTH_ENDPOINT=$(echo "$RESULT" | jq -r '.healthEndpoint.value')
MCP_ENDPOINT=$(echo "$RESULT" | jq -r '.mcpServerEndpoint.value')
DEPLOYER_ID=$(echo "$RESULT" | jq -r '.deployerObjectId.value')
DEPLOY_CMD=$(echo "$RESULT" | jq -r '.deployCommand.value')

echo "Resources created:"
echo "  Function App:  $FUNCTION_APP_NAME"
echo "  Function URL:  $FUNCTION_APP_URL"
echo "  Logic App:     $LOGIC_APP_NAME"
echo "  App Insights:  $APP_INSIGHTS_NAME"
echo ""
echo "Endpoints:"
echo "  Health:  $HEALTH_ENDPOINT"
echo "  MCP:     $MCP_ENDPOINT"
echo ""

echo "Easy Auth: ENABLED"
echo "  Allowed User: $DEPLOYER_ID"
echo ""
echo "To call the API:"
echo '  TOKEN=$(az account get-access-token --resource https://management.azure.com --query accessToken -o tsv)'
echo '  curl -H "Authorization: Bearer $TOKEN" <endpoint>'
echo ""

echo "Next steps:"
echo "  1. Deploy the function code:"
echo "     $DEPLOY_CMD"
echo ""
echo "  2. Configure AI settings (if not already set):"
echo "     az functionapp config appsettings set --name $FUNCTION_APP_NAME --resource-group $RESOURCE_GROUP --settings AI_FOUNDRY_ENDPOINT=<your-endpoint>"
echo ""
