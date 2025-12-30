#!/bin/bash
# Logic Apps MCP Server and AI Assistant - Deployment Script
#
# This script deploys the Logic Apps MCP server and AI assistant to Azure:
# 1. Creates infrastructure (Function App, Storage, App Insights, Managed Identity)
# 2. Optionally creates Azure OpenAI resource and model deployment
# 3. Configures Easy Auth to restrict access to the deployer
# 4. Builds and deploys the function code
# 5. Grants RBAC for Azure OpenAI access
#
# After deployment, grant the managed identity RBAC access to your Logic Apps.
#
# Usage:
#   ./deploy.sh -g <resource-group> --ai-endpoint <endpoint>
#   ./deploy.sh -g <resource-group> --create-ai-resource
#
# Examples:
#   # Use existing Azure OpenAI
#   ./deploy.sh -g lamcp-rg -p lamcp --ai-endpoint https://my-openai.openai.azure.com
#
#   # Create new Azure OpenAI resource
#   ./deploy.sh -g lamcp-rg -p lamcp --create-ai-resource --create-rg

set -e

# Default values
RESOURCE_GROUP=""
PREFIX=""
APP_LOCATION="westus2"
AI_LOCATION="eastus"
AI_FOUNDRY_ENDPOINT=""
AI_FOUNDRY_DEPLOYMENT="gpt-4o"
CREATE_AI_RESOURCE=false
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
        -l|--app-location)
            APP_LOCATION="$2"
            shift 2
            ;;
        --ai-location)
            AI_LOCATION="$2"
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
        --create-ai-resource)
            CREATE_AI_RESOURCE=true
            shift
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
            echo "Usage: $0 -g <resource-group> [--ai-endpoint <endpoint> | --create-ai-resource]"
            echo ""
            echo "Required:"
            echo "  -g, --resource-group    Resource group name"
            echo "  --ai-endpoint           Azure OpenAI endpoint URL (if using existing)"
            echo "    OR"
            echo "  --create-ai-resource    Create a new Azure OpenAI resource"
            echo ""
            echo "Optional:"
            echo "  -p, --prefix            Resource name prefix"
            echo "  -l, --app-location      Function App region (default: westus2)"
            echo "  --ai-location           Azure OpenAI region (default: eastus)"
            echo "  --ai-deployment         AI deployment name (default: gpt-4o)"
            echo "  --create-rg             Create resource group if it doesn't exist"
            echo "  --skip-code-deploy      Skip building and deploying function code"
            echo "  -y, --yes               Skip confirmation prompt"
            echo ""
            echo "Examples:"
            echo "  # Use existing Azure OpenAI:"
            echo "  $0 -g my-rg --ai-endpoint https://my-openai.openai.azure.com"
            echo ""
            echo "  # Create new Azure OpenAI resource:"
            echo "  $0 -g my-rg --create-ai-resource --create-rg"
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

if [ -z "$AI_FOUNDRY_ENDPOINT" ] && [ "$CREATE_AI_RESOURCE" = false ]; then
    echo "Error: Either --ai-endpoint or --create-ai-resource is required."
    echo ""
    echo "Usage:"
    echo "  # Use existing Azure OpenAI:"
    echo "  $0 -g <rg> --ai-endpoint https://my-openai.openai.azure.com"
    echo ""
    echo "  # Create new Azure OpenAI resource:"
    echo "  $0 -g <rg> --create-ai-resource"
    exit 1
fi

echo "============================================"
echo "Logic Apps MCP Server & AI Assistant"
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

SUB_ID=$(echo "$ACCOUNT" | jq -r '.id')

echo ""
echo "Subscription: $SUB_NAME"
echo "Sub ID:       $SUB_ID"
if [ -n "$AI_FOUNDRY_ENDPOINT" ]; then
    echo "AI Endpoint:  $AI_FOUNDRY_ENDPOINT (existing)"
else
    echo "AI Endpoint:  Will be created"
fi
echo "AI Model:     $AI_FOUNDRY_DEPLOYMENT"
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
    echo "Creating resource group '$RESOURCE_GROUP' in '$APP_LOCATION'..."
    az group create --name "$RESOURCE_GROUP" --location "$APP_LOCATION" > /dev/null
    echo "Resource group created."
    echo ""
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(dirname "$SCRIPT_DIR")"

# Generate effective prefix for naming
if [ -n "$PREFIX" ]; then
    EFFECTIVE_PREFIX=$(echo "$PREFIX" | tr '[:upper:]' '[:lower:]')
else
    EFFECTIVE_PREFIX=$(echo -n "$RESOURCE_GROUP" | sha256sum | cut -c1-8)
fi

# Create Azure OpenAI resource if requested
OPENAI_RESOURCE_NAME=""
if [ "$CREATE_AI_RESOURCE" = true ]; then
    OPENAI_RESOURCE_NAME="oai-$EFFECTIVE_PREFIX"
    echo "Creating Azure OpenAI resource '$OPENAI_RESOURCE_NAME'..."

    # Check if resource already exists
    EXISTING_RESOURCE=$(az cognitiveservices account show --name "$OPENAI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP" 2>/dev/null) || true
    if [ -n "$EXISTING_RESOURCE" ]; then
        echo "  Azure OpenAI resource already exists, reusing."
        AI_FOUNDRY_ENDPOINT=$(echo "$EXISTING_RESOURCE" | jq -r '.properties.endpoint')
    else
        # Create the resource
        # Create in AI_LOCATION (may differ from Function App location)
        if ! az cognitiveservices account create \
            --name "$OPENAI_RESOURCE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --location "$AI_LOCATION" \
            --kind OpenAI \
            --sku S0 \
            --custom-domain "$OPENAI_RESOURCE_NAME" 2>&1; then
            echo "Error creating Azure OpenAI resource."
            echo ""
            echo "Note: Azure OpenAI may not be available in all regions."
            echo "Try a different location with -l (e.g., eastus, westus, swedencentral)"
            exit 1
        fi

        OPENAI_RESOURCE=$(az cognitiveservices account show --name "$OPENAI_RESOURCE_NAME" --resource-group "$RESOURCE_GROUP")
        AI_FOUNDRY_ENDPOINT=$(echo "$OPENAI_RESOURCE" | jq -r '.properties.endpoint')
        echo "  Created: $AI_FOUNDRY_ENDPOINT"
    fi

    # Create model deployment
    echo "Creating model deployment '$AI_FOUNDRY_DEPLOYMENT'..."
    EXISTING_DEPLOYMENT=$(az cognitiveservices account deployment show \
        --name "$OPENAI_RESOURCE_NAME" \
        --resource-group "$RESOURCE_GROUP" \
        --deployment-name "$AI_FOUNDRY_DEPLOYMENT" 2>/dev/null) || true

    if [ -n "$EXISTING_DEPLOYMENT" ]; then
        echo "  Model deployment already exists, reusing."
    else
        az cognitiveservices account deployment create \
            --name "$OPENAI_RESOURCE_NAME" \
            --resource-group "$RESOURCE_GROUP" \
            --deployment-name "$AI_FOUNDRY_DEPLOYMENT" \
            --model-name "gpt-4o" \
            --model-version "2024-08-06" \
            --model-format OpenAI \
            --sku-name Standard \
            --sku-capacity 80 > /dev/null

        if [ $? -ne 0 ]; then
            echo "Error creating model deployment. The model may not be available in this region."
            exit 1
        fi
        echo "  Model deployment created."
    fi
    echo ""
fi

# Build parameters
PARAMS="location=$APP_LOCATION aiFoundryEndpoint=$AI_FOUNDRY_ENDPOINT aiFoundryDeployment=$AI_FOUNDRY_DEPLOYMENT enableEasyAuth=true deployerObjectId=$DEPLOYER_OBJECT_ID"

if [ -n "$PREFIX" ]; then
    PARAMS="$PARAMS prefix=$PREFIX"
fi

# Deploy Bicep template
echo "Deploying infrastructure..."
echo "  Resource Group: $RESOURCE_GROUP"

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
MANAGED_IDENTITY_PRINCIPAL_ID=$(echo "$RESULT" | jq -r '.managedIdentityPrincipalId.value')
MANAGED_IDENTITY_CLIENT_ID=$(echo "$RESULT" | jq -r '.managedIdentityClientId.value')
MANAGED_IDENTITY_RESOURCE_ID=$(echo "$RESULT" | jq -r '.managedIdentityId.value')
echo "Infrastructure deployed."
echo ""

# Grant RBAC for Azure OpenAI if we created it
if [ "$CREATE_AI_RESOURCE" = true ] && [ -n "$OPENAI_RESOURCE_NAME" ]; then
    echo "Granting managed identity access to Azure OpenAI..."
    OPENAI_RESOURCE_ID="/subscriptions/$SUB_ID/resourceGroups/$RESOURCE_GROUP/providers/Microsoft.CognitiveServices/accounts/$OPENAI_RESOURCE_NAME"

    # Check if role assignment already exists
    EXISTING_ASSIGNMENT=$(az role assignment list \
        --assignee "$MANAGED_IDENTITY_PRINCIPAL_ID" \
        --scope "$OPENAI_RESOURCE_ID" \
        --role "Cognitive Services OpenAI User" 2>/dev/null) || true

    if [ -n "$EXISTING_ASSIGNMENT" ] && [ "$(echo "$EXISTING_ASSIGNMENT" | jq 'length')" -gt 0 ]; then
        echo "  Role assignment already exists."
    else
        az role assignment create \
            --assignee-object-id "$MANAGED_IDENTITY_PRINCIPAL_ID" \
            --assignee-principal-type ServicePrincipal \
            --role "Cognitive Services OpenAI User" \
            --scope "$OPENAI_RESOURCE_ID" > /dev/null
        echo "  Granted Cognitive Services OpenAI User role."
    fi
    echo ""
fi

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

echo "============================================"
echo "Deployment Complete!"
echo "============================================"
echo ""
echo "Function App: $FUNCTION_APP_NAME"
echo "AI Endpoint:  $AI_FOUNDRY_ENDPOINT"
echo ""
echo "--------------------------------------------"
echo "IMPORTANT: Save these for granting RBAC:"
echo ""
echo "  Principal ID (for az role assignment): $MANAGED_IDENTITY_PRINCIPAL_ID"
echo "  Resource ID (for Azure Portal):        $MANAGED_IDENTITY_RESOURCE_ID"
echo "  Client ID:                             $MANAGED_IDENTITY_CLIENT_ID"
echo ""
echo "--------------------------------------------"
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

if [ "$CREATE_AI_RESOURCE" = true ]; then
    echo "============================================"
    echo "NEXT STEP: Grant Logic Apps access"
    echo "============================================"
    echo ""
    echo "Grant the managed identity Reader access to subscriptions with Logic Apps:"
    echo ""
    echo "az role assignment create \\"
    echo "  --assignee $MANAGED_IDENTITY_PRINCIPAL_ID \\"
    echo "  --role 'Reader' \\"
    echo "  --scope /subscriptions/<subscription-id>"
else
    echo "============================================"
    echo "NEXT STEPS: Grant RBAC access"
    echo "============================================"
    echo ""
    echo "1. Grant access to Azure OpenAI:"
    echo "   az role assignment create \\"
    echo "     --assignee $MANAGED_IDENTITY_PRINCIPAL_ID \\"
    echo "     --role 'Cognitive Services OpenAI User' \\"
    echo "     --scope <your-openai-resource-id>"
    echo ""
    echo "2. Grant access to Logic Apps:"
    echo "   az role assignment create \\"
    echo "     --assignee $MANAGED_IDENTITY_PRINCIPAL_ID \\"
    echo "     --role 'Reader' \\"
    echo "     --scope /subscriptions/<subscription-id>"
fi
echo ""
