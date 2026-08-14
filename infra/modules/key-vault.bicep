targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param resourceSuffix string
param tags object = {}

@secure()
param secretValue string

param readerPrincipalId string

var vaultName = 'kv-${take(replace(toLower(name), '-', ''), 12)}-${resourceSuffix}'
var keyVaultSecretsUserRoleId = subscriptionResourceId(
  'Microsoft.Authorization/roleDefinitions',
  '4633458b-17de-408a-b874-0445c86b69e6'
)

resource vault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: vaultName
  location: location
  tags: tags
  properties: {
    tenantId: subscription().tenantId
    sku: {
      family: 'A'
      name: 'standard'
    }
    accessPolicies: []
    enablePurgeProtection: true
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

resource neisApiKey 'Microsoft.KeyVault/vaults/secrets@2023-07-01' = {
  parent: vault
  name: 'neis-api-key'
  properties: {
    value: secretValue
    attributes: {
      enabled: true
    }
  }
}

resource secretsReaderRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(vault.id, readerPrincipalId, keyVaultSecretsUserRoleId)
  scope: vault
  properties: {
    roleDefinitionId: keyVaultSecretsUserRoleId
    principalId: readerPrincipalId
    principalType: 'ServicePrincipal'
  }
}

output name string = vault.name
output neisApiKeySecretUri string = neisApiKey.properties.secretUriWithVersion
