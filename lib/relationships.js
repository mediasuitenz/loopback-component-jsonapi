'use strict'

const _ = require('lodash')
const utils = require('./utils')
const linkRelatedModels = require(
  './utilities/relationship-utils'
).linkRelatedModels

module.exports = function (app, options) {
  // get remote methods.
  // set strong-remoting for more information
  // https://github.com/strongloop/strong-remoting
  const remotes = app.remotes()
  let id, data, model

  remotes.before('**', function (ctx, next) {
    if (utils.shouldNotApplyJsonApi(ctx, options)) {
      return next()
    }

    const allowedMethodNames = ['updateAttributes', 'patchAttributes']
    const methodName = ctx.method.name
    if (allowedMethodNames.indexOf(methodName) === -1) return next()

    id = ctx.req.params.id
    data = options.data
    model = utils.getModelFromContext(ctx, app)

    relationships(model, id, data).then(() => next()).catch(err => next(err))
  })

  // for create
  remotes.after('**', function (ctx, next) {
    if (utils.shouldNotApplyJsonApi(ctx, options)) {
      return next()
    }

    if (ctx.method.name !== 'create') return next()

    if (ctx.result && ctx.result.data) {
      id = ctx.result.data.id
      data = options.data
      model = utils.getModelFromContext(ctx, app)
      relationships(model, id, data).then(() => next()).catch(err => next(err))
      return
    }

    next()
  })
}

function extractIdsFromResource (resource) {
  if (_.isArray(resource)) {
    return _.map(resource, 'id')
  }
  return _.get(resource, 'id', null)
}

function relationships (model, id, payload) {
  if (!id || !model) return
  const relationships = _.get(payload, 'data.relationships', {})

  return Promise.all(
    Object.keys(relationships).map(relationName => {
      const relationship = relationships[relationName]
      const relationDefn = model.relations[relationName]
      if (!relationDefn) return undefined

      const type = relationDefn.type
      const modelTo = relationDefn.modelTo

      // don't handle belongsTo in relationships function
      if (!modelTo || type === 'belongsTo') return undefined

      const data = extractIdsFromResource(relationship.data)
      const from = { model, id }
      const to = { model: modelTo, data }
      return linkRelatedModels(relationName, from, to)
    })
  )
}
