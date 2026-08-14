targetScope = 'resourceGroup'

param name string
param location string = resourceGroup().location
param resourceSuffix string
param tags object = {}

var registryName = take('crbsl${replace(name, '-', '')}${resourceSuffix}', 50)

resource registry 'Microsoft.ContainerRegistry/registries@2023-07-01' = {
  name: registryName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  properties: {
    adminUserEnabled: false
    dataEndpointEnabled: false
    publicNetworkAccess: 'Enabled'
  }
}

output name string = registry.name
output loginServer string = registry.properties.loginServer
