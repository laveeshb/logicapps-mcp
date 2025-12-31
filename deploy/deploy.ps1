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
#   ./deploy.ps1 -ResourceGroup <rg-name> -AiFoundryEndpoint <endpoint>
#   ./deploy.ps1 -ResourceGroup <rg-name> -CreateAiResource
#
# Examples:
#   # Use existing Azure OpenAI
#   ./deploy.ps1 -ResourceGroup lamcp-rg -Prefix lamcp -AiFoundryEndpoint https://my-openai.openai.azure.com
#
#   # Create new Azure OpenAI resource
#   ./deploy.ps1 -ResourceGroup lamcp-rg -Prefix lamcp -CreateAiResource -CreateResourceGroup

param(
    [Parameter(Mandatory=$true)]
    [string]$ResourceGroup,

    [Parameter(Mandatory=$false)]
    [string]$Prefix = "",

    [Parameter(Mandatory=$false)]
    [string]$AppLocation = "westus2",

    [Parameter(Mandatory=$false)]
    [string]$AiLocation = "eastus",

    [Parameter(Mandatory=$false)]
    [string]$AiFoundryEndpoint = "",

    [Parameter(Mandatory=$false)]
    [string]$AiFoundryDeployment = "gpt-4o",

    [Parameter(Mandatory=$false)]
    [switch]$CreateAiResource,

    [Parameter(Mandatory=$false)]
    [switch]$CreateResourceGroup,

    [Parameter(Mandatory=$false)]
    [switch]$SkipCodeDeploy,

    [Parameter(Mandatory=$false)]
    [switch]$Yes
)

$ErrorActionPreference = "Stop"

Write-Host "============================================" -ForegroundColor Cyan
Write-Host "Logic Apps MCP Server & AI Assistant" -ForegroundColor Cyan
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""

# Validate parameters
if (-not $AiFoundryEndpoint -and -not $CreateAiResource) {
    Write-Host "Error: Either -AiFoundryEndpoint or -CreateAiResource is required." -ForegroundColor Red
    Write-Host ""
    Write-Host "Usage:" -ForegroundColor Yellow
    Write-Host "  # Use existing Azure OpenAI:" -ForegroundColor Gray
    Write-Host "  ./deploy.ps1 -ResourceGroup <rg> -AiFoundryEndpoint https://my-openai.openai.azure.com" -ForegroundColor Gray
    Write-Host ""
    Write-Host "  # Create new Azure OpenAI resource:" -ForegroundColor Gray
    Write-Host "  ./deploy.ps1 -ResourceGroup <rg> -CreateAiResource" -ForegroundColor Gray
    exit 1
}

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
Write-Host "Sub ID:       $($account.id)" -ForegroundColor Cyan
if ($AiFoundryEndpoint) {
    Write-Host "AI Endpoint:  $AiFoundryEndpoint (existing)" -ForegroundColor Cyan
} else {
    Write-Host "AI Endpoint:  Will be created" -ForegroundColor Cyan
}
Write-Host "AI Model:     $AiFoundryDeployment" -ForegroundColor Cyan
Write-Host ""

# Ask for consent before creating resources (skip if -Yes flag)
if (-not $Yes) {
    Write-Host "This will create resources in the subscription above." -ForegroundColor Yellow
    $consent = Read-Host "Do you want to continue? (y/N)"
    if ($consent -ne "y" -and $consent -ne "Y") {
        Write-Host "Deployment cancelled." -ForegroundColor Red
        exit 0
    }
    Write-Host ""
}

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
    Write-Host "Creating resource group '$ResourceGroup' in '$AppLocation'..." -ForegroundColor Yellow
    az group create --name $ResourceGroup --location $AppLocation | Out-Null
    Write-Host "Resource group created." -ForegroundColor Green
    Write-Host ""
}

$scriptPath = Split-Path -Parent $MyInvocation.MyCommand.Path
$repoRoot = Split-Path -Parent $scriptPath

# Generate effective prefix for naming
$effectivePrefix = if ($Prefix) { $Prefix.ToLower() } else {
    $hash = [System.BitConverter]::ToString([System.Security.Cryptography.SHA256]::Create().ComputeHash([System.Text.Encoding]::UTF8.GetBytes($ResourceGroup))).Replace("-", "").Substring(0, 8).ToLower()
    $hash
}

# Create Azure OpenAI resource if requested
$openAiResourceName = ""
if ($CreateAiResource) {
    $openAiResourceName = "oai-$effectivePrefix"
    Write-Host "Creating Azure OpenAI resource '$openAiResourceName'..." -ForegroundColor Yellow

    # Check if resource already exists (suppress error output)
    $ErrorActionPreference = "SilentlyContinue"
    $existingResourceJson = az cognitiveservices account show --name $openAiResourceName --resource-group $ResourceGroup 2>&1
    $ErrorActionPreference = "Stop"
    $existingResource = $null
    if ($LASTEXITCODE -eq 0) {
        $existingResource = $existingResourceJson | ConvertFrom-Json
    }
    if ($existingResource) {
        Write-Host "  Azure OpenAI resource already exists, reusing." -ForegroundColor Yellow
        $AiFoundryEndpoint = $existingResource.properties.endpoint
    } else {
        # Create the resource (in AiLocation, which may differ from Function App location)
        $openAiResult = az cognitiveservices account create `
            --name $openAiResourceName `
            --resource-group $ResourceGroup `
            --location $AiLocation `
            --kind OpenAI `
            --sku S0 `
            --custom-domain $openAiResourceName `
            2>&1

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error creating Azure OpenAI resource: $openAiResult" -ForegroundColor Red
            Write-Host ""
            Write-Host "Note: Azure OpenAI may not be available in all regions." -ForegroundColor Yellow
            Write-Host "Try a different location with -Location (e.g., eastus, westus, swedencentral)" -ForegroundColor Yellow
            exit 1
        }

        $openAiResource = az cognitiveservices account show --name $openAiResourceName --resource-group $ResourceGroup | ConvertFrom-Json
        $AiFoundryEndpoint = $openAiResource.properties.endpoint
        Write-Host "  Created: $AiFoundryEndpoint" -ForegroundColor Green
    }

    # Create model deployment
    Write-Host "Creating model deployment '$AiFoundryDeployment'..." -ForegroundColor Yellow
    $ErrorActionPreference = "SilentlyContinue"
    $existingDeployment = az cognitiveservices account deployment show `
        --name $openAiResourceName `
        --resource-group $ResourceGroup `
        --deployment-name $AiFoundryDeployment 2>&1
    $ErrorActionPreference = "Stop"

    if ($LASTEXITCODE -eq 0 -and $existingDeployment) {
        Write-Host "  Model deployment already exists, reusing." -ForegroundColor Yellow
    } else {
        az cognitiveservices account deployment create `
            --name $openAiResourceName `
            --resource-group $ResourceGroup `
            --deployment-name $AiFoundryDeployment `
            --model-name "gpt-4o" `
            --model-version "2024-08-06" `
            --model-format OpenAI `
            --sku-name Standard `
            --sku-capacity 1000 | Out-Null  # Request max 1M TPM (will use available quota)

        if ($LASTEXITCODE -ne 0) {
            Write-Host "Error creating model deployment. The model may not be available in this region." -ForegroundColor Red
            exit 1
        }
        Write-Host "  Model deployment created." -ForegroundColor Green
    }
    Write-Host ""
}

# Build parameters for Bicep
$params = @(
    "location=$AppLocation",
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
$managedIdentityPrincipalId = $deploymentResult.managedIdentityPrincipalId.value
$managedIdentityClientId = $deploymentResult.managedIdentityClientId.value
$managedIdentityResourceId = $deploymentResult.managedIdentityId.value
Write-Host "Infrastructure deployed." -ForegroundColor Green
Write-Host ""

# Grant RBAC for Azure OpenAI if we created it
if ($CreateAiResource -and $openAiResourceName) {
    Write-Host "Granting managed identity access to Azure OpenAI..." -ForegroundColor Yellow
    $openAiResourceId = "/subscriptions/$($account.id)/resourceGroups/$ResourceGroup/providers/Microsoft.CognitiveServices/accounts/$openAiResourceName"

    # Check if role assignment already exists
    $existingAssignment = az role assignment list `
        --assignee $managedIdentityPrincipalId `
        --scope $openAiResourceId `
        --role "Cognitive Services OpenAI User" 2>$null | ConvertFrom-Json

    if ($existingAssignment -and $existingAssignment.Count -gt 0) {
        Write-Host "  Role assignment already exists." -ForegroundColor Yellow
    } else {
        az role assignment create `
            --assignee-object-id $managedIdentityPrincipalId `
            --assignee-principal-type ServicePrincipal `
            --role "Cognitive Services OpenAI User" `
            --scope $openAiResourceId | Out-Null
        Write-Host "  Granted Cognitive Services OpenAI User role." -ForegroundColor Green
    }
    Write-Host ""
}

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
Write-Host "AI Endpoint:  $AiFoundryEndpoint" -ForegroundColor White
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Yellow
Write-Host "IMPORTANT: Save these for granting RBAC:" -ForegroundColor Yellow
Write-Host ""
Write-Host "  Principal ID (for az role assignment): $managedIdentityPrincipalId" -ForegroundColor Cyan
Write-Host "  Resource ID (for Azure Portal):        $managedIdentityResourceId" -ForegroundColor Cyan
Write-Host "  Client ID:                             $managedIdentityClientId" -ForegroundColor Gray
Write-Host ""
Write-Host "--------------------------------------------" -ForegroundColor Yellow
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
Write-Host "  curl -H `"Authorization: Bearer `$token`" $($deploymentResult.healthEndpoint.value)" -ForegroundColor Gray
Write-Host ""

if ($CreateAiResource) {
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "NEXT STEP: Grant Logic Apps access" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Grant the managed identity Reader access to subscriptions with Logic Apps:" -ForegroundColor White
    Write-Host ""
    Write-Host "az role assignment create ``" -ForegroundColor Gray
    Write-Host "  --assignee $managedIdentityPrincipalId ``" -ForegroundColor Gray
    Write-Host "  --role 'Reader' ``" -ForegroundColor Gray
    Write-Host "  --scope /subscriptions/<subscription-id>" -ForegroundColor Gray
} else {
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host "NEXT STEPS: Grant RBAC access" -ForegroundColor Yellow
    Write-Host "============================================" -ForegroundColor Yellow
    Write-Host ""
    Write-Host "1. Grant access to Azure OpenAI:" -ForegroundColor Cyan
    Write-Host "   az role assignment create ``" -ForegroundColor Gray
    Write-Host "     --assignee $managedIdentityPrincipalId ``" -ForegroundColor Gray
    Write-Host "     --role 'Cognitive Services OpenAI User' ``" -ForegroundColor Gray
    Write-Host "     --scope <your-openai-resource-id>" -ForegroundColor Gray
    Write-Host ""
    Write-Host "2. Grant access to Logic Apps:" -ForegroundColor Cyan
    Write-Host "   az role assignment create ``" -ForegroundColor Gray
    Write-Host "     --assignee $managedIdentityPrincipalId ``" -ForegroundColor Gray
    Write-Host "     --role 'Reader' ``" -ForegroundColor Gray
    Write-Host "     --scope /subscriptions/<subscription-id>" -ForegroundColor Gray
}
Write-Host ""
