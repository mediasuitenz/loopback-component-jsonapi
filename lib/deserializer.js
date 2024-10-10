'use strict'

const _ = require('lodash')

function defaultBeforeDeserialize (options, cb) {
  cb(null, options)
}

function defaultDeserialize (options, cb) {
  options.result = options.data.data.attributes || {}
  cb(null, options)
}

function defaultAfterDeserialize (options, cb) {
  cb(null, options)
}

/**
 * Deserializes the requests data.
 * @public
 * @type {Function}
 * @param {Object} data The request data
 * @param {Object} serverRelations
 * @return {Object}
 */
module.exports = function deserializer (options, cb) {
  const model = options.model

  const beforeDeserialize = typeof model.beforeJsonApiDeserialize === 'function'
    ? model.beforeJsonApiDeserialize
    : defaultBeforeDeserialize

  const deserialize = typeof model.jsonApiDeserialize === 'function'
    ? model.jsonApiDeserialize
    : defaultDeserialize

  const afterDeserialize = typeof model.afterJsonApiDeserialize === 'function'
    ? model.afterJsonApiDeserialize
    : defaultAfterDeserialize

  const deserializeOptions = _.cloneDeep(options)

  beforeDeserialize(deserializeOptions, function (err, deserializeOptions) {
    if (err) return cb(err)
    deserialize(deserializeOptions, function (err, deserializeOptions) {
      if (err) return cb(err)
      afterDeserialize(deserializeOptions, function (err, deserializeOptions) {
        if (err) return cb(err)

        belongsToRelationships(deserializeOptions)
        return cb(null, deserializeOptions)
      })
    })
  })
}

function belongsToRelationships (options) {
  const data = options.data
  const model = options.model

  if (!data || !data.data || !model || !data.data.relationships) {
    return
  }

  _.each(data.data.relationships, function (relationship, name) {
    const serverRelation = model.relations[name]
    if (!serverRelation) return
    const type = serverRelation.type

    // only handle belongsTo
    if (type !== 'belongsTo') return

    const fkName = serverRelation.keyFrom
    const modelTo = serverRelation.modelFrom

    if (!modelTo) return false

    if (!relationship.data) {
      options.result[fkName] = null
    } else {
      options.result[fkName] = relationship.data.id
    }
  })
}
