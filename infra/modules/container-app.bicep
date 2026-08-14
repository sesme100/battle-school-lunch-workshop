targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param tags object = {}
param serviceName string
param environmentId string
param registryServer string
param targetPort int
param externalIngress bool
param environmentVariables array = []
param userAssignedIdentityId string = ''
param keyVaultSecretUri string = ''

var hasUserAssignedIdentity = !empty(userAssignedIdentityId)
var hasKeyVaultSecret = !empty(keyVaultSecretUri)
var placeholderImage = 'mcr.microsoft.com/azuredocs/containerapps-helloworld:latest'

resource app 'Microsoft.App/containerApps@2024-03-01' = {
  name: name
  location: location
  tags: tags
  identity: hasUserAssignedIdentity
    ? {
        type: 'SystemAssigned, UserAssigned'
        userAssignedIdentities: {
          '${userAssignedIdentityId}': {}
        }
      }
    : {
        type: 'SystemAssigned'
      }
  properties: {
    environmentId: environmentId
    configuration: {
      activeRevisionsMode: 'Single'
      registries: [
        {
          server: registryServer
          identity: 'system'
        }
      ]
      ingress: {
        external: externalIngress
        targetPort: targetPort
        transport: 'auto'
        allowInsecure: false
      }
      secrets: hasKeyVaultSecret
        ? [
            {
              name: 'neis-api-key'
              keyVaultUrl: keyVaultSecretUri
              identity: userAssignedIdentityId
            }
          ]
        : []
    }
    template: {
      containers: [
        {
          name: serviceName
          image: placeholderImage
          env: concat(
            environmentVariables,
            hasKeyVaultSecret
              ? [
                  {
                    name: 'NEIS_API_KEY'
                    secretRef: 'neis-api-key'
                  }
                ]
              : []
          )
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 2
        rules: [
          {
            name: 'http-scaling'
            http: {
              metadata: {
                concurrentRequests: '50'
              }
            }
          }
        ]
      }
    }
  }
}

output fqdn string = app.properties.configuration.ingress.fqdn
output systemAssignedPrincipalId string = app.identity.principalId
