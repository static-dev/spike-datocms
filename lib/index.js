const SpikeUtil = require('spike-util')
const W = require('when')
const node = require('when/node')
const Joi = require('joi')
const path = require('path')
const fs = require('fs')
const reshape = require('reshape')
const loader = require('reshape-loader')
const {SiteClient} = require('datocms-client')
const bindAllClass = require('es6bindall')

module.exports = class SpikeDatoCMS {
  constructor (opts) {
    Object.assign(this, this.validate(opts))
    this.client = new SiteClient(opts.token)
    bindAllClass(this, ['apply', 'run'])
  }

  apply (compiler) {
    this.util = new SpikeUtil(compiler.options)
    this.util.runAll(compiler, this.run)

    // TODO: this pulls the incorrect loader context
    compiler.plugin('compilation', (compilation) => {
      compilation.plugin('normal-module-loader', (loaderContext) => {
        this.loaderContext = loaderContext
      })
    })

    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        writeJson(compilation, this.json, this.addDataTo.dato)
      }

      this.models.filter((m) => m.json).map((m) => {
        return writeJson(compilation, m.json, this.addDataTo.dato[m.type])
      })

      W.map(this.models.filter((m) => m.template), (contentType) => {
        return writeTemplate.call(this, compiler, compilation, contentType)
      }).done(() => done(), done)
    })
  }

  run (compilation, done) {
    return W.all([
      this.client.site.find(),
      W.reduce(this.models, (memo, model) => {
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
      }, {})
    ]).done(([site, models]) => {
      // add to the locals
      Object.assign(this.addDataTo, { dato: Object.assign(models, { _meta: site }) })
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
          json: Joi.string(),
          template: Joi.object().keys({
            path: Joi.string(),
            output: Joi.func()
          })
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

function writeJson (compilation, filename, data) {
  const src = JSON.stringify(data, null, 2)
  compilation.assets[filename] = {
    source: () => src,
    size: () => src.length
  }
}

// TODO: get rid of this, put the templates through webpack
function writeTemplate (compiler, compilation, model) {
  const data = this.addDataTo.dato[model.type]
  const filePath = path.join(compiler.options.context, model.template.path)

  return node.call(fs.readFile.bind(fs), filePath, 'utf8').then((template) => {
    return W.map(data, (item) => {
      const newLocals = Object.assign({}, this.addDataTo, { item })

      const options = loader.parseOptions.call(this.loaderContext, this.util.getSpikeOptions().reshape, {})

      return reshape(options)
        .process(template)
        .then((res) => {
          const html = res.output(newLocals)
          compilation.assets[model.template.output(item)] = {
            source: () => html,
            size: () => html.length
          }
        })
    })
  })
}
