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
#   ./deploy.ps1 -ResourceGroup <rg-name> -AiFoundryEndpoint <endpoint>
#
# Examples:
#   ./deploy.ps1 -ResourceGroup lamcp-rg -Prefix lamcp -AiFoundryEndpoint https://my-openai.openai.azure.com

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory=$true)]
    [string]$AiFoundryEndpoint,

    [Parameter(Mandatory=$false)]
    [string]$Prefix = "",

    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",

    [Parameter(Mandatory=$false)]
    [string]$AiFoundryDeployment = "gpt-4o",

    [Parameter(Mandatory=$false)]
    [switch]$CreateResourceGroup,

    [Parameter(Mandatory=$false)]
    [switch]$SkipCodeDeploy
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Logic Apps MCP Server - Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

# Check Azure CLI
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Error: Not logged in to Azure. Please run 'az login' first." -ForegroundColor Red
    exit 1
}
Write-Host "  Azure CLI: Logged in as $($account.user.name)" -ForegroundColor Green

# Check Azure Functions Core Tools (needed for deployment)
if (-not $SkipCodeDeploy) {
    $funcVersion = func --version 2>$null
    if (-not $funcVersion) {
        Write-Host "Error: Azure Functions Core Tools not found." -ForegroundColor Red
        Write-Host "Install from: https://learn.microsoft.com/azure/azure-functions/functions-run-local" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  Functions Core Tools: v$funcVersion" -ForegroundColor Green
}

# Check npm (needed for build)
if (-not $SkipCodeDeploy) {
    $npmVersion = npm --version 2>$null
    if (-not $npmVersion) {
        Write-Host "Error: npm not found. Please install Node.js." -ForegroundColor Red
        exit 1
    }
    Write-Host "  npm: v$npmVersion" -ForegroundColor Green
}

Write-Host ""
Write-Host "Subscription: $($account.name)" -ForegroundColor Cyan
Write-Host "AI Endpoint:  $AiFoundryEndpoint" -ForegroundColor Cyan
Write-Host "AI Model:     $AiFoundryDeployment" -ForegroundColor Cyan
Write-Host ""

# Get deployer's object ID for Easy Auth (required)
Write-Host "Fetching your Azure AD object ID for Easy Auth..." -ForegroundColor Yellow
$deployerObjectId = az ad signed-in-user show --query id -o tsv 2>$null
if (-not $deployerObjectId) {
    Write-Host "Error: Could not fetch your Azure AD object ID." -ForegroundColor Red
    Write-Host "Make sure you're logged in with 'az login' and have Azure AD access." -ForegroundColor Red
    exit 1
}
Write-Host "Your Object ID: $deployerObjectId" -ForegroundColor Green
Write-Host ""

# Create resource group if requested
if ($CreateResourceGroup) {
    Write-Host "Creating resource group '$ResourceGroup' in '$Location'..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location | Out-Null
    Write-Host "Resource group created." -ForegroundColor Green
    Write-Host ""
}

# Build parameters
$params = @(
    "location=$Location",
    "aiFoundryEndpoint=$AiFoundryEndpoint",
    "aiFoundryDeployment=$AiFoundryDeployment",
    "enableEasyAuth=true",
    "deployerObjectId=$deployerObjectId"
)

if ($Prefix) {
    $params += "prefix=$Prefix"
}

# Deploy Bicep template
Write-Host "Deploying infrastructure..." -ForegroundColor Yellow
Write-Host "  Resource Group: $ResourceGroup" -ForegroundColor Gray

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptPath
$templatePath = Join-Path $scriptPath "bicep\main.bicep"

$deploymentResult = az deployment group create `
    --resource-group $ResourceGroup `
    --template-file $templatePath `
    --parameters $params `
    --query "properties.outputs" `
    -o json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "Infrastructure deployment failed!" -ForegroundColor Red
    exit 1
}

$functionAppName = $deploymentResult.functionAppName.value
Write-Host "Infrastructure deployed." -ForegroundColor Green
Write-Host ""

# Build and deploy function code
if (-not $SkipCodeDeploy) {
    Write-Host "Building function code..." -ForegroundColor Yellow
    Push-Location $repoRoot
    try {
        npm ci --silent 2>$null
        if ($LASTEXITCODE -ne 0) {
            npm install --silent
        }
        npm run build
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Build failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host "Build completed." -ForegroundColor Green
        Write-Host ""

        Write-Host "Deploying function code to $functionAppName..." -ForegroundColor Yellow
        func azure functionapp publish $functionAppName
        if ($LASTEXITCODE -ne 0) {
            Write-Host "Code deployment failed!" -ForegroundColor Red
            exit 1
        }
        Write-Host "Code deployed." -ForegroundColor Green
        Write-Host ""
    }
    finally {
        Pop-Location
    }
}

# Output results
Write-Host "============================================" -ForegroundColor Green
Write-Host "Deployment Complete!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Function App:     $functionAppName" -ForegroundColor White
Write-Host "Managed Identity: $($deploymentResult.managedIdentityPrincipalId.value)" -ForegroundColor White
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Cyan
Write-Host "  Health: $($deploymentResult.healthEndpoint.value)" -ForegroundColor White
Write-Host "  MCP:    $($deploymentResult.mcpServerEndpoint.value)" -ForegroundColor White
Write-Host "  Agent:  $($deploymentResult.functionAppUrl.value)/api/agent" -ForegroundColor White
Write-Host ""
Write-Host "Easy Auth: ENABLED (only you can access)" -ForegroundColor Green
Write-Host ""
Write-Host "To call the API:" -ForegroundColor Cyan
Write-Host '  $token = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv' -ForegroundColor Gray
Write-Host '  curl -H "Authorization: Bearer $token" ' + "$($deploymentResult.healthEndpoint.value)" -ForegroundColor Gray
Write-Host ""
Write-Host "============================================" -ForegroundColor Yellow
Write-Host "NEXT STEP: Grant RBAC access" -ForegroundColor Yellow
Write-Host "============================================" -ForegroundColor Yellow
Write-Host ""
Write-Host "The managed identity needs access to your Logic Apps and Azure OpenAI." -ForegroundColor White
Write-Host ""
Write-Host "1. Grant access to Azure OpenAI:" -ForegroundColor Cyan
Write-Host "   az role assignment create ``" -ForegroundColor Gray
Write-Host "     --assignee $($deploymentResult.managedIdentityPrincipalId.value) ``" -ForegroundColor Gray
Write-Host "     --role 'Cognitive Services OpenAI User' ``" -ForegroundColor Gray
Write-Host "     --scope /subscriptions/<sub>/resourceGroups/<rg>/providers/Microsoft.CognitiveServices/accounts/<openai-resource>" -ForegroundColor Gray
Write-Host ""
Write-Host "2. Grant access to Logic Apps (repeat for each subscription):" -ForegroundColor Cyan
Write-Host "   az role assignment create ``" -ForegroundColor Gray
Write-Host "     --assignee $($deploymentResult.managedIdentityPrincipalId.value) ``" -ForegroundColor Gray
Write-Host "     --role 'Reader' ``" -ForegroundColor Gray
Write-Host "     --scope /subscriptions/<subscription-id>" -ForegroundColor Gray
Write-Host ""
