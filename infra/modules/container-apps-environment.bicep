targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param resourceSuffix string
param tags object = {}
param logAnalyticsCustomerId string

@secure()
param logAnalyticsSharedKey string

var environmentName = 'cae-${take(name, 17)}-${resourceSuffix}'

resource environment 'Microsoft.App/managedEnvironments@2024-03-01' = {
  name: environmentName
  location: location
  tags: tags
  properties: {
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalyticsCustomerId
        sharedKey: logAnalyticsSharedKey
      }
    }
  }
}

output id string = environment.id
