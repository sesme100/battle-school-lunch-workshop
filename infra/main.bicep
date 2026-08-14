targetScope = 'subscription'

@minLength(2)
@maxLength(24)
param environmentName string

param location string

@secure()
param neisApiKey string

param tags object = {}

var normalizedEnvironmentName = toLower(replace(replace(environmentName, '_', '-'), ' ', '-'))
var resourceSuffix = take(uniqueString(subscription().id, environmentName, location), 6)
var resourceGroupName = 'rg-${normalizedEnvironmentName}'
var commonTags = union(tags, {
  'azd-env-name': environmentName
  workload: 'battle-school-lunch'
})

resource resourceGroup 'Microsoft.Resources/resourceGroups@2024-03-01' = {
  name: resourceGroupName
  location: location
  tags: commonTags
}

module monitoring './modules/monitoring.bicep' = {
  name: 'monitoring'
  scope: resourceGroup
  params: {
    name: normalizedEnvironmentName
    location: location
    resourceSuffix: resourceSuffix
    tags: commonTags
  }
}

module registry './modules/container-registry.bicep' = {
  name: 'containerRegistry'
  scope: resourceGroup
  params: {
    name: normalizedEnvironmentName
    location: location
    resourceSuffix: resourceSuffix
    tags: commonTags
  }
}

module backendIdentity './modules/managed-identity.bicep' = {
  name: 'backendIdentity'
  scope: resourceGroup
  params: {
    name: 'id-${take(normalizedEnvironmentName, 16)}-backend-${resourceSuffix}'
    location: location
    tags: commonTags
  }
}

module secrets './modules/key-vault.bicep' = {
  name: 'keyVault'
  scope: resourceGroup
  params: {
    name: normalizedEnvironmentName
    location: location
    resourceSuffix: resourceSuffix
    tags: commonTags
    secretValue: neisApiKey
    readerPrincipalId: backendIdentity.outputs.principalId
  }
}

module containerEnvironment './modules/container-apps-environment.bicep' = {
  name: 'containerAppsEnvironment'
  scope: resourceGroup
  params: {
    name: normalizedEnvironmentName
    location: location
    resourceSuffix: resourceSuffix
    tags: commonTags
    logAnalyticsCustomerId: monitoring.outputs.logAnalyticsCustomerId
    logAnalyticsSharedKey: monitoring.outputs.logAnalyticsSharedKey
  }
}

module backend './modules/container-app.bicep' = {
  name: 'backend'
  scope: resourceGroup
  params: {
    name: 'ca-${take(normalizedEnvironmentName, 15)}-api-${resourceSuffix}'
    location: location
    tags: union(commonTags, {
      'azd-service-name': 'backend'
    })
    serviceName: 'backend'
    environmentId: containerEnvironment.outputs.id
    registryServer: registry.outputs.loginServer
    targetPort: 80
    externalIngress: false
    userAssignedIdentityId: backendIdentity.outputs.id
    keyVaultSecretUri: secrets.outputs.neisApiKeySecretUri
    environmentVariables: [
      {
        name: 'UVICORN_PORT'
        value: '80'
      }
      {
        name: 'NEIS_BASE_URL'
        value: 'https://open.neis.go.kr'
      }
      {
        name: 'CORS_ORIGINS'
        value: ''
      }
      {
        name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
        value: monitoring.outputs.applicationInsightsConnectionString
      }
    ]
  }
}

module frontend './modules/container-app.bicep' = {
  name: 'frontend'
  scope: resourceGroup
  params: {
    name: 'ca-${take(normalizedEnvironmentName, 15)}-web-${resourceSuffix}'
    location: location
    tags: union(commonTags, {
      'azd-service-name': 'frontend'
    })
    serviceName: 'frontend'
    environmentId: containerEnvironment.outputs.id
    registryServer: registry.outputs.loginServer
    targetPort: 80
    externalIngress: true
    environmentVariables: [
      {
        name: 'BACKEND_URL'
        value: 'https://${backend.outputs.fqdn}'
      }
    ]
  }
}

module backendAcrPull './modules/acr-pull-role.bicep' = {
  name: 'backendAcrPull'
  scope: resourceGroup
  params: {
    acrName: registry.outputs.name
    principalId: backend.outputs.systemAssignedPrincipalId
  }
}

module frontendAcrPull './modules/acr-pull-role.bicep' = {
  name: 'frontendAcrPull'
  scope: resourceGroup
  params: {
    acrName: registry.outputs.name
    principalId: frontend.outputs.systemAssignedPrincipalId
  }
}

output AZURE_RESOURCE_GROUP string = resourceGroup.name
output AZURE_CONTAINER_REGISTRY_ENDPOINT string = registry.outputs.loginServer
output AZURE_KEY_VAULT_NAME string = secrets.outputs.name
output AZURE_LOG_ANALYTICS_WORKSPACE_ID string = monitoring.outputs.logAnalyticsWorkspaceId
output BACKEND_URL string = 'https://${backend.outputs.fqdn}'
output WEB_URL string = 'https://${frontend.outputs.fqdn}'
