// Azure Bicep template for SynthoraAI Agentic Pipeline

@description('Environment name')
@allowed([
  'development'
  'staging'
  'production'
])
param environment string = 'production'

@description('Location for all resources')
param location string = resourceGroup().location

@description('Application name')
param appName string = 'synthora-ai-agentic'

@description('MongoDB URI')
@secure()
param mongoDbUri string

@description('Google AI API Key')
@secure()
param googleAiApiKey string

@description('Pinecone API Key')
@secure()
param pineconeApiKey string

// Variables
var functionAppName = '${appName}-${environment}'
var storageAccountName = 'synthoraai${uniqueString(resourceGroup().id)}'
var appInsightsName = '${appName}-insights-${environment}'
var appServicePlanName = '${appName}-plan-${environment}'
var keyVaultName = '${appName}-kv-${uniqueString(resourceGroup().id)}'

// Storage Account
resource storageAccount 'Microsoft.Storage/storageAccounts@2023-01-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    supportsHttpsTrafficOnly: true
    minimumTlsVersion: 'TLS1_2'
    encryption: {
      services: {
        blob: {
          enabled: true
        }
        file: {
          enabled: true
        }
      }
      keySource: 'Microsoft.Storage'
    }
  }
}

// Queue for async processing
resource queue 'Microsoft.Storage/storageAccounts/queueServices/queues@2023-01-01' = {
  name: '${storageAccount.name}/default/article-processing'
  properties: {}
}

// Application Insights
resource appInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: appInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

// App Service Plan (Consumption/Premium)
resource appServicePlan 'Microsoft.Web/serverfarms@2023-01-01' = {
  name: appServicePlanName
  location: location
  sku: {
    name: 'EP1'  // Elastic Premium for production
    tier: 'ElasticPremium'
    size: 'EP1'
    family: 'EP'
    capacity: 1
  }
  properties: {
    reserved: true  // Linux
    maximumElasticWorkerCount: 20
  }
}

// Key Vault for secrets
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: subscription().tenantId
    enabledForDeployment: false
    enabledForDiskEncryption: false
    enabledForTemplateDeployment: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 90
    enableRbacAuthorization: true
  }
}

// Store secrets in Key Vault
resource mongoDbUriSecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'mongodb-uri'
  properties: {
    value: mongoDbUri
  }
}

resource googleApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'google-ai-api-key'
  properties: {
    value: googleAiApiKey
  }
}

resource pineconeApiKeySecret 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: keyVault
  name: 'pinecone-api-key'
  properties: {
    value: pineconeApiKey
  }
}

// Function App
resource functionApp 'Microsoft.Web/sites@2023-01-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appServicePlan.id
    siteConfig: {
      linuxFxVersion: 'Python|3.11'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTAZUREFILECONNECTIONSTRING'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storageAccount.name};AccountKey=${storageAccount.listKeys().keys[0].value};EndpointSuffix=core.windows.net'
        }
        {
          name: 'WEBSITE_CONTENTSHARE'
          value: toLower(functionAppName)
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'python'
        }
        {
          name: 'APPINSIGHTS_INSTRUMENTATIONKEY'
          value: appInsights.properties.InstrumentationKey
        }
        {
          name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
          value: appInsights.properties.ConnectionString
        }
        {
          name: 'ENVIRONMENT'
          value: environment
        }
        {
          name: 'MONGODB_URI'
          value: '@Microsoft.KeyVault(SecretUri=${mongoDbUriSecret.properties.secretUri})'
        }
        {
          name: 'GOOGLE_AI_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${googleApiKeySecret.properties.secretUri})'
        }
        {
          name: 'PINECONE_API_KEY'
          value: '@Microsoft.KeyVault(SecretUri=${pineconeApiKeySecret.properties.secretUri})'
        }
      ]
      cors: {
        allowedOrigins: [
          '*'
        ]
      }
      use32BitWorkerProcess: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      http20Enabled: true
    }
    httpsOnly: true
  }
}

// Grant Function App access to Key Vault
resource keyVaultAccessPolicy 'Microsoft.KeyVault/vaults/accessPolicies@2023-07-01' = {
  parent: keyVault
  name: 'add'
  properties: {
    accessPolicies: [
      {
        tenantId: subscription().tenantId
        objectId: functionApp.identity.principalId
        permissions: {
          secrets: [
            'get'
            'list'
          ]
        }
      }
    ]
  }
}

// Outputs
output functionAppName string = functionApp.name
output functionAppUrl string = 'https://${functionApp.properties.defaultHostName}'
output storageAccountName string = storageAccount.name
output keyVaultName string = keyVault.name
output appInsightsName string = appInsights.name
