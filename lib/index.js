const SpikeUtil = require('spike-util')
const W = require('when')
const Joi = require('joi')
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
    let templatePairs

    // if there are single template pages, configure them here
    compiler.plugin('before-loader-process', (ctx, options) => {
      // map each template path to its config position
      if (!templatePairs) {
        templatePairs = this.models.reduce((m, model, idx) => {
          if (!model.template) return m
          if (!model.template.path) {
            throw new Error(`${model.name}.template must have a "path" property`)
          }
          if (!model.template.output) {
            throw new Error(`${model.name}.template must have an "output" function`)
          }
          m[model.template.path] = idx
          return m
        }, {})
      }

      // get the relative path of the file currently being compiled
      const p = ctx.resourcePath.replace(`${compiler.options.context}/`, '')

      // match this path to the template pairs to get the model's full config
      if (typeof templatePairs[p] === 'undefined') return
      const conf = this.models[templatePairs[p]]
      const data = this.addDataTo.dato[conf.name]

      // add a reshape multi option to compile each template separately
      options.multi = data.map((d) => {
        return { locals: { item: d }, name: conf.template.output(d) }
      })
      return options
    })

    compiler.plugin('emit', (compilation, done) => {
      if (this.json) {
        writeJson(compilation, this.json, this.addDataTo.dato)
      }

      this.models.filter((m) => m.json).map((m) => {
        return writeJson(compilation, m.json, this.addDataTo.dato[m.type])
      })

      done()
    })
  }

  run (compilation, done) {
    if (this.addDataTo.dato && !this.aggressiveRefresh) return done()
    return W.all([
      this.client.site.find(),
      W.reduce(this.models, (memo, model) => {
        // format options
        const options = {}
        if (model.ids) { options['filter[ids]'] = model.ids }
        if (model.query) { options['filter[query]'] = model.query }
        if (model.offset) { options['page[offset]'] = model.offset }
        if (model.limit) { options['page[limit]'] = model.limit }
        const transformFn = model.transform ? model.transform : (x) => x

        // fetch items and itemTypes
        return W.all([
          W(this.client.items.all(options)),
          W(this.client.itemTypes.all())
        ])
          // make sure linked entries are resolved
          .then(resolveLinks)
          // filter to the model type, if necessary
          .then(([records, itemTypes]) => {
            if (!model.type) return records
            const t = itemTypes.find((it) => it.apiKey === model.type)
            let modelRecords = records.filter((r) => r.itemType === t.id)

            // if model has position key to sort by, use it to sort
            if (modelRecords[0].position) {
              modelRecords = modelRecords.sort((a, b) => a.position - b.position)
            }

            return modelRecords
          })
          // transform if necessary
          .then((res) => W.map(res, (entry) => transformFn(entry)))
          // add resolved item to the response
          .tap((res) => { memo[model.type || 'all'] = res })
          .yield(memo)
      }, {})
    ]).done(([site, models]) => {
      // clear existing locals, add new data
      if (this.addDataTo.dato) { delete this.addDataTo.dato }
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

// TODO: use proxies so there can be no infinite loopz
function resolveLinks ([records, itemTypes]) {
  // find all model ids
  const recordIds = records.map((r) => r.id)
  // scan all model values
  records.map((r) => {
    for (let k in r) {
      if (k === 'id') continue
      // check to see if it is a model id, which means it's a link
      // if so, replace the id with the actual item
      if (Array.isArray(r[k])) {
        r[k] = r[k].map(resolveLink.bind(null, recordIds, records))
      } else {
        r[k] = resolveLink(recordIds, records, r[k])
      }
    }
  })
  return [records, itemTypes]
}

function resolveLink (ids, records, record) {
  if (ids.indexOf(record) > -1) {
    return records.find((r2) => r2.id === record)
  } else {
    return record
  }
}

function writeJson (compilation, filename, data) {
  const src = JSON.stringify(data, null, 2)
  compilation.assets[filename] = {
    source: () => src,
    size: () => src.length
  }
}
