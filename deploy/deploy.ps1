# Logic Apps MCP Server - Deployment Script
#
# This script deploys the Logic Apps AI Assistant infrastructure to Azure.
# Easy Auth is always enabled to restrict access to the deployer.
#
# Usage:
#   ./deploy.ps1 -ResourceGroup <rg-name> -Prefix <prefix>
#
# Examples:
#   ./deploy.ps1 -ResourceGroup lamcp-rg -Prefix lamcp
#   ./deploy.ps1 -ResourceGroup lamcp-rg -Prefix lamcp -Location eastus2

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory=$false)]
    [string]$Prefix = "",

    [Parameter(Mandatory=$false)]
    [string]$Location = "eastus",

    [Parameter(Mandatory=$false)]
    [string]$AiFoundryEndpoint = "",

    [Parameter(Mandatory=$false)]
    [string]$AiFoundryDeployment = "gpt-4o",

    [Parameter(Mandatory=$false)]
    [switch]$CreateResourceGroup
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Logic Apps MCP Server - Deployment" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Check if logged in to Azure
Write-Host "Checking Azure login status..." -ForegroundColor Yellow
$account = az account show 2>$null | ConvertFrom-Json
if (-not $account) {
    Write-Host "Not logged in to Azure. Please run 'az login' first." -ForegroundColor Red
    exit 1
}
Write-Host "Logged in as: $($account.user.name)" -ForegroundColor Green
Write-Host "Subscription: $($account.name) ($($account.id))" -ForegroundColor Green
Write-Host ""

# Get deployer's object ID for Easy Auth (required)
Write-Host "Fetching your Azure AD object ID for Easy Auth..." -ForegroundColor Yellow
$deployerObjectId = az ad signed-in-user show --query id -o tsv 2>$null
if (-not $deployerObjectId) {
    Write-Host "Error: Could not fetch your Azure AD object ID. Easy Auth requires this." -ForegroundColor Red
    Write-Host "Make sure you're logged in with 'az login' and have Azure AD access." -ForegroundColor Red
    exit 1
}
Write-Host "Your Object ID: $deployerObjectId" -ForegroundColor Green
Write-Host "Easy Auth will be configured to allow only you to access the API." -ForegroundColor Green
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
    "location=$Location"
)

if ($Prefix) {
    $params += "prefix=$Prefix"
}

if ($AiFoundryEndpoint) {
    $params += "aiFoundryEndpoint=$AiFoundryEndpoint"
}

if ($AiFoundryDeployment) {
    $params += "aiFoundryDeployment=$AiFoundryDeployment"
}

$params += "enableEasyAuth=true"
$params += "deployerObjectId=$deployerObjectId"

# Deploy Bicep template
Write-Host "Deploying infrastructure..." -ForegroundColor Yellow
Write-Host "Resource Group: $ResourceGroup" -ForegroundColor Gray
Write-Host "Parameters: $($params -join ', ')" -ForegroundColor Gray
Write-Host ""

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$templatePath = Join-Path $scriptPath "bicep\main.bicep"

$deploymentResult = az deployment group create `
    --resource-group $ResourceGroup `
    --template-file $templatePath `
    --parameters $params `
    --query "properties.outputs" `
    -o json | ConvertFrom-Json

if ($LASTEXITCODE -ne 0) {
    Write-Host "Deployment failed!" -ForegroundColor Red
    exit 1
}

Write-Host ""
Write-Host "============================================" -ForegroundColor Green
Write-Host "Deployment Successful!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Green
Write-Host ""
Write-Host "Resources created:" -ForegroundColor Cyan
Write-Host "  Function App:  $($deploymentResult.functionAppName.value)" -ForegroundColor White
Write-Host "  Function URL:  $($deploymentResult.functionAppUrl.value)" -ForegroundColor White
Write-Host "  Logic App:     $($deploymentResult.logicAppName.value)" -ForegroundColor White
Write-Host "  App Insights:  $($deploymentResult.appInsightsName.value)" -ForegroundColor White
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Cyan
Write-Host "  Health:  $($deploymentResult.healthEndpoint.value)" -ForegroundColor White
Write-Host "  MCP:     $($deploymentResult.mcpServerEndpoint.value)" -ForegroundColor White
Write-Host ""

Write-Host "Easy Auth: ENABLED" -ForegroundColor Green
Write-Host "  Allowed User: $($deploymentResult.deployerObjectId.value)" -ForegroundColor White
Write-Host ""
Write-Host "To call the API:" -ForegroundColor Cyan
Write-Host '  $token = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv' -ForegroundColor Gray
Write-Host '  Invoke-RestMethod -Uri "<endpoint>" -Headers @{Authorization = "Bearer $token"}' -ForegroundColor Gray
Write-Host ""

Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "  1. Deploy the function code:" -ForegroundColor White
Write-Host "     $($deploymentResult.deployCommand.value)" -ForegroundColor Gray
Write-Host ""
Write-Host "  2. Configure AI settings (if not already set):" -ForegroundColor White
Write-Host "     az functionapp config appsettings set --name $($deploymentResult.functionAppName.value) --resource-group $ResourceGroup --settings AI_FOUNDRY_ENDPOINT=<your-endpoint>" -ForegroundColor Gray
Write-Host ""
