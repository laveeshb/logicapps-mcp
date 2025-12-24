/**
 * Azure cloud endpoint configurations.
 * Supports public, government, China, and custom clouds.
 */

export interface AzureCloudEndpoints {
  name: string;
  authentication: {
    loginEndpoint: string;
    tokenAudience: string;
  };
  resourceManager: string;
  suffixes: {
    azureWebsites: string;
  };
}

export const AZURE_CLOUDS: Record<string, AzureCloudEndpoints> = {
  AzurePublic: {
    name: "AzurePublic",
    authentication: {
      loginEndpoint: "https://login.microsoftonline.com",
      tokenAudience: "https://management.azure.com",
    },
    resourceManager: "https://management.azure.com",
    suffixes: {
      azureWebsites: ".azurewebsites.net",
    },
  },
  AzureGovernment: {
    name: "AzureGovernment",
    authentication: {
      loginEndpoint: "https://login.microsoftonline.us",
      tokenAudience: "https://management.usgovcloudapi.net",
    },
    resourceManager: "https://management.usgovcloudapi.net",
    suffixes: {
      azureWebsites: ".azurewebsites.us",
    },
  },
  AzureChina: {
    name: "AzureChina",
    authentication: {
      loginEndpoint: "https://login.chinacloudapi.cn",
      tokenAudience: "https://management.chinacloudapi.cn",
    },
    resourceManager: "https://management.chinacloudapi.cn",
    suffixes: {
      azureWebsites: ".chinacloudsites.cn",
    },
  },
};

export function getCloudEndpoints(cloudName?: string): AzureCloudEndpoints {
  const name = cloudName ?? process.env.AZURE_CLOUD ?? "AzurePublic";
  const cloud = AZURE_CLOUDS[name];
  if (!cloud) {
    throw new Error(
      `Unknown Azure cloud: ${name}. Valid options: ${Object.keys(AZURE_CLOUDS).join(", ")}`
    );
  }
  return cloud;
}
