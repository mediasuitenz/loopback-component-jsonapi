'use strict'

const utils = require('./utils')

module.exports = function (app, options) {
  const remotes = app.remotes()
  remotes.before('**', async (ctx) => {
    if (utils.shouldNotApplyJsonApi(ctx, options)) {
      return
    }
    const query = ctx.req.query
    ctx.args.filter = ctx.args.filter || {}
    if (typeof query.page === 'object') {
      [
        { from: 'offset', to: 'skip' },
        { from: 'limit', to: 'limit' }
      ].forEach(function (p) {
        if (typeof query.page[p.from] === 'string') {
          ctx.args.filter[p.to] = query.page[p.from]
        }
      })
    }
  })
}
