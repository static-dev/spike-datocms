const SpikeUtil = require('spike-util')
const W = require('when')
const Joi = require('joi')
const {SiteClient} = require('datocms-client')

module.exports = class SpikeDatoCMS {
  constructor (opts) {
    Object.assign(this, this.validate(opts))
    this.client = new SiteClient(opts.token)
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)
    this.util.runAll(compiler, this.run.bind(this, compiler))
  }

  run (compiler, compilation, done) {
    return W.reduce(this.models, (memo, model) => {
      // format options
      const options = {}
      if (model.type) { options['filter[type]'] = model.type }
      if (model.ids) { options['filter[ids]'] = model.ids }
      if (model.query) { options['filter[query]'] = model.query }
      if (model.offset) { options['page[offset]'] = model.offset }
      if (model.limit) { options['page[limit]'] = model.limit }
      const transformFn = model.transform ? model.transform : (x) => x

      // fetch items
      return W(this.client.items.all(options))
        // transform if necessary
        .then((res) => W.map(res, (entry) => transformFn(entry)))
        // add resolved item to the response
        .tap((res) => { memo[model.type || 'all'] = res })
        .yield(memo)
    }, {}).done((res) => {
      // add to the locals
      this.addDataTo = Object.assign(this.addDataTo, { dato: res })
      done()
    }, done)
  }

  /**
   * Validate options
   * @private
   */
  validate (opts = {}) {
    const schema = Joi.object().keys({
      token: Joi.string().required(),
      addDataTo: Joi.object().required(),
      json: Joi.string(),
      models: Joi.array().items(
        Joi.object().keys({
          type: Joi.string().default(Joi.ref('name')),
          name: Joi.string(), // this is an alias for type
          ids: Joi.array().single(),
          query: Joi.string(),
          offset: Joi.number(),
          limit: Joi.number(),
          transform: Joi.func(),
          json: Joi.string()
        })
      )
    })

    const res = Joi.validate(opts, schema, {
      language: {
        messages: { wrapArrays: false },
        object: { child: '!![spike-datocms constructor] option {{reason}}' }
      }
    })
    if (res.error) { throw new Error(res.error) }
    return res.value
  }
}
