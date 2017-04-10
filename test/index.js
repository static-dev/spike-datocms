const SpikeDatoCMS = require('..')
const test = require('ava')

test.cb('basic', (t) => {
  const locals = {}
  const plugin = new SpikeDatoCMS({
    token: 'cb1f960dfb4f14a7ae93',
    addDataTo: locals,
    models: [{ name: 'post' }]
  })
  return plugin.run({}, {}, () => {
    t.truthy(locals.dato.post.length > 0)
    t.end()
  })
})
