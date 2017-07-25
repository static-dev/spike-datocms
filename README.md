# Spike DatoCMS Plugin

[![npm](https://img.shields.io/npm/v/spike-datocms.svg?style=flat-square)](https://npmjs.com/package/spike-datocms)
[![tests](https://img.shields.io/travis/static-dev/spike-datocms.svg?style=flat-square)](https://travis-ci.org/static-dev/spike-datocms?branch=master)
[![dependencies](https://img.shields.io/david/static-dev/spike-datocms.svg?style=flat-square)](https://david-dm.org/static-dev/spike-datocms)
[![coverage](https://img.shields.io/codecov/c/github/static-dev/spike-datocms.svg?style=flat-square)](https://codecov.io/gh/static-dev/spike-datocms)

A quick and easy interface to DatoCMS content

> **Note:** This project is in early development, and versioning is a little different. [Read this](http://markup.im/#q4_cRZ1Q) for more details.

### Installation

`npm install spike-datocms -S`

### Usage

Sometimes the best way to see how to use something is an example!

```js
const htmlStandards = require('reshape-standard')
const SpikeDatoCMS = require('spike-datocms')
const locals = {}

module.exports = {
  reshape: htmlStandards({ locals }),
  plugins: [
    new SpikeDatoCMS({
      addDataTo: locals,
      token: 'xxx',
      models: [{
        type: 'post', // if you leave this off, it will pull content from all models
        ids: [10, 13], // (optional) only return specific records
        query: 'foo', // (optional) text query for records
        offset: 3, // (optional) offset results
        limit: 10, // (optional) limit number of results returned
        transform: (record) => {
          // each record is passed through this function, if provided
          // change it however you want and return the modified result!
          return record
        }
      }, {
        type: 'author'
      }]
    })
  ]
}
```

Now, in your views, you can see your records as such:

```
p {{{ JSON.stringify(dato) }}}
```

Or, for example, loop through one of your models:

```
ul
  each(loop='post in dato.post')
    li post.title
```

This plugin will also automatically pull the meta information for the site, including the site title, SEO fields, etc. that you control via the "Settings" menu, and assign it as `dato._meta`. This makes it super easy to reflect CMS-controlled SEO fields in your layouts.

### Single Template Render

Using the template option allows you to write records returned from Dato to single page templates. For example, if you are trying to render a blog as static, you might want each post returned from the API to be rendered as a single page by itself.

The `template` option is an object with `path` and `output` keys. The `path` is an absolute or relative path to a template to be used to render each item, and output is a function with the currently iterated item as a parameter, which should return a string representing a path relative to the project root where the single view should be rendered. For example:

```js
new SpikeDatoCMS({
  addDataTo: locals,
  token: 'xxx',
  models: [{
    name: 'posts',
    template: {
      path: 'templates/post.html',
      output: (post) => { return `posts/${post.slug}.html` }
    }
  }]
})
```

Your template must use the `item` variable as seen below.

> **Note:** you also will need to prevent Spike from attempting to render your template file normally by adding your templates to Spike's `ignore` option, or adding an underscore to the file name.

```html
<p>{{ item.title }}</p>
```

### JSON Output

Finally, if you'd like to have the output written locally to a JSON file so that it's cached locally, you can pass the name of the file, resolved relative to your project's output, as a `json` option to the plugin. For example:

```js
new SpikeDatoCMS({
  addDataTo: locals,
  token: 'xxx',
  models: [{ name: 'posts' }],
  json: 'data.json'
})
```

You may also choose to have the output written specifically for any content type:

```js
new SpikeDatoCMS({
  addDataTo: locals,
  token: 'xxx',
  models: [
    { name: 'posts',

      json: 'posts.json'
    },
    {
      name: 'press',
      id: '4Em9bQeIQxxxxxxxxx'
      // No JSON output needed for this content type
    }
  ],
  // Save all content types data in one file
  json: 'alldata.json'
})
```

### Aggressive Refresh

By default, this plugin will only fetch data once when you start your watcher, for development speed purposes. This means that if you change your data, you will have to restart the watcher to pick up the changes. If you are in a phase where you are making frequent data changes and would like a more aggressive updating strategy, you can set the `aggressiveRefresh` option to `true`, and your dreams will come true. However, note that this will slow down your local development, as it will fetch and link all entires every time you save a file, so it's only recommended for temporary use.

### License & Contributing

- Details on the license [can be found here](LICENSE.md)
- Details on running tests and contributing [can be found here](contributing.md)
