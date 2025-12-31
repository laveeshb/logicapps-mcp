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
#   ./deploy.ps1 -ResourceGroup <rg-name>
#   ./deploy.ps1 -ResourceGroup <rg-name> -Prefix myapp -CreateResourceGroup

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory=$false)]
    [string]$Prefix = "",

    [Parameter(Mandatory=$false)]
    [string]$Location = "westus2",

    [Parameter(Mandatory=$false)]
    [switch]$CreateResourceGroup,

    [Parameter(Mandatory=$false)]
    [switch]$SkipCodeDeploy,

    [Parameter(Mandatory=$false)]
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Logic Apps MCP Server" -ForegroundColor Cyan
Write-Host "(Passthrough Authentication)" -ForegroundColor Cyan
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

# Check Azure Functions Core Tools
if (-not $SkipCodeDeploy) {
    $funcVersion = func --version 2>$null
    if (-not $funcVersion) {
        Write-Host "Error: Azure Functions Core Tools not found." -ForegroundColor Red
        Write-Host "Install from: https://learn.microsoft.com/azure/azure-functions/functions-run-local" -ForegroundColor Yellow
        exit 1
    }
    Write-Host "  Functions Core Tools: v$funcVersion" -ForegroundColor Green
}

# Check npm
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
Write-Host "Location:     $Location" -ForegroundColor Cyan
Write-Host ""

# Ask for consent
if (-not $Yes) {
    Write-Host "This will create resources in the subscription above." -ForegroundColor Yellow
    $consent = Read-Host "Do you want to continue? (y/N)"
    if ($consent -ne "y" -and $consent -ne "Y") {
        Write-Host "Deployment cancelled." -ForegroundColor Red
        exit 0
    }
    Write-Host ""
}

# Create resource group if requested
if ($CreateResourceGroup) {
    Write-Host "Creating resource group '$ResourceGroup' in '$Location'..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $Location | Out-Null
    Write-Host "Resource group created." -ForegroundColor Green
    Write-Host ""
}

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptPath

# Build parameters for Bicep
$params = @("location=$Location")

if ($Prefix) {
    $params += "prefix=$Prefix"
}

# Deploy Bicep template
Write-Host "Deploying infrastructure..." -ForegroundColor Yellow

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
Write-Host "Function App: $functionAppName" -ForegroundColor White
Write-Host ""
Write-Host "Endpoints:" -ForegroundColor Cyan
Write-Host "  MCP:    $($deploymentResult.mcpEndpoint.value)" -ForegroundColor White
Write-Host "  Health: $($deploymentResult.healthEndpoint.value)" -ForegroundColor White
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Yellow
Write-Host "Authentication: PASSTHROUGH" -ForegroundColor Yellow
Write-Host ""
Write-Host "Clients must provide ARM-scoped bearer token:" -ForegroundColor White
Write-Host '  Authorization: Bearer <token>' -ForegroundColor Gray
Write-Host ""
Write-Host "Get token:" -ForegroundColor Cyan
Write-Host '  az account get-access-token --resource https://management.azure.com --query accessToken -o tsv' -ForegroundColor Gray
Write-Host ""
Write-Host "Test:" -ForegroundColor Cyan
Write-Host '  $token = az account get-access-token --resource https://management.azure.com --query accessToken -o tsv' -ForegroundColor Gray
Write-Host "  curl -H `"Authorization: Bearer `$token`" $($deploymentResult.healthEndpoint.value)" -ForegroundColor Gray
Write-Host ""
