const fs = require('fs')

const stdin = process.openStdin()

let data = ''
stdin.on('data', chunk => {
  data += chunk
})

stdin.on('end', () => {
  const formatDescription = JSON.parse(data)

  formatDescription.types.forEach(type => {
    if (type.kind === 'object') {
      const object = {
        title: type.type.name,
        type: type.kind,
        properties: {},
        additionalProperties: false,
        required: []
      }

      processProperties(formatDescription, type, object)

      fs.writeFile(
        `../schemas/${object.title}.json`,
        JSON.stringify(object, null, 2),
        err => {}
      )
    }
  })
})

function processProperties(formatDescription, type, object) {
  const supertype = type.type.supertype
  if (supertype) {
    const type = formatDescription.types.find(type => {
      return type.type.name === supertype
    })
    processProperties(formatDescription, type, object)
  }

  type.properties.forEach(property => {
    switch (property.type) {
      case 'Optional':
        if (isPrimitive(property.wrappedType)) {
          object.properties[property.name] = {
            type: convertType(property.wrappedType)
          }
        } else {
          object.properties[property.name] = {
            $ref: `${property.wrappedType}.json`
          }
        }
        break
      case 'Array':
        object.properties[property.name] = {
          type: 'array'
        }
        if (isPrimitive(property.wrappedType)) {
          object.properties[property.name] = {
            items: {type: convertType(property.wrappedType)}
          }
        } else {
          object.properties[property.name] = {
            items: {$ref: `${property.wrappedType}.json`}
          }
        }
        break
      default:
        if (isPrimitive(property.type)) {
          object.properties[property.name] = {
            type: convertType(property.type)
          }
        } else {
          object.properties[property.name] = {
            $ref: `${property.type}.json`
          }
        }
        break
    }
    if (!property.isOptional) {
      object.required.push(property.name)
    }
  })
}

function convertType(type) {
  switch (type) {
    case 'Bool':
      return 'boolean'
    case 'Int':
      return 'integer'
    case 'Double':
      return 'number'
    case 'String':
      return 'string'
    case 'Date':
      return 'string'
    default:
      return type
  }
}

function isPrimitive(type) {
  return (
    type === 'Bool' ||
    type === 'Int' ||
    type === 'Double' ||
    type === 'String' ||
    type === 'Date'
  )
}
