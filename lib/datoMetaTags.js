const htmlTag = require('html-tag')
const { modifyNodes } = require('reshape-plugin-util')

module.exports = function datoMetaTags () {
  return function datoMetaTagsPlugin (tree, ctx) {
    if (ctx) {
      Object.assign(ctx.runtime, { htmlTag })
    }

    return modifyNodes(
      tree,
      (node) => node.name === 'dato-meta-tags',
      (node) => {
        if (!(node.attrs && node.attrs.record)) {
          throw new ctx.PluginError({
            message: 'dato-meta-tags tag has no "record" attribute',
            plugin: 'spike-datocms',
            location: node.location
          })
        }

        return {
          type: 'code',
          content: `(function() {
            const record = locals.${node.attrs.record[0].content};
            if (!record || !record.seoMetaTags) { return null; }
            return record.seoMetaTags.map(tag => (
              __runtime.htmlTag(tag.tagName, tag.attributes || {}, tag.content)
            )).join('');
          })()`
        }
      }
    )
  }
}
