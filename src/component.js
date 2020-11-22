import { isAsyncPlaceholder, isDef, isRegExp, getComponentName, getFirstComponentChild } from './utils'

const RIGHT_ARROW = '→'

function remove(arr, item) {
  if (arr.length) {
    const index = arr.indexOf(item)
    if (index > -1) {
      return arr.splice(index, 1)
    }
  }
}

function matches(pattern, name) {
  if (Array.isArray(pattern)) {
    return pattern.indexOf(name) > -1
  } else if (typeof pattern === 'string') {
    return pattern.split(',').indexOf(name) > -1
  } else if (isRegExp(pattern)) {
    return pattern.test(name)
  }
  return false
}

function saveHistory() {
  window.sessionStorage.setItem(this.settings.storageKey, JSON.stringify(this.history))
}

function clearArrow() {
  if (!this.history[this.hisPointer]) return
  this.history[this.hisPointer] = this.history[this.hisPointer].replace(RIGHT_ARROW, '')
}

function appendArrow() {
  this.history[this.hisPointer] = RIGHT_ARROW + this.history[this.hisPointer]
}

function setHistoryPointer(index) {
  clearArrow.call(this)
  this.hisPointer = index
  appendArrow.call(this)
}

function generateVnodeKey(componentName, routeKey) {
  return `${componentName}-${routeKey}`
}

function onRouteChange(current, prev) {
  const {keyName, componentName} = this.settings
  const routeKey = current.query[keyName]
  const resolveLast = function () {
    if (this.history.length) {
      this.history[this.history.length - 1] = routeKey
    } else {
      this.history.push(routeKey)
    }
    setHistoryPointer.call(this, this.history.length - 1)
  }

  let event = ''
  const deletedKeys = []
  if (current && prev.query[keyName] === undefined) {
    // page reload
    event = EVENT.RELOAD
    resolveLast.call(this)
  } else if (current.query[keyName] === prev.query[keyName]) {
    // vue-router replace
    event = EVENT.REFRESH
    resolveLast.call(this)
  } else {
    const index = this.history.indexOf(routeKey)
    let l = this.history.length

    if (index > -1) {
      // navigator backward or forward
      while (--l > index) {
        deletedKeys.push(this.history[l])
      }
      setHistoryPointer.call(this, index)
      event = EVENT.BACKWARD
    } else {
      while (--l > this.hisPointer) {
        let deleted = this.history.splice(l, 1)
        deletedKeys.push(deleted[0])
      }
      this.history.push(current.query[keyName])
      setHistoryPointer.call(this, this.history.length - 1)
      event = EVENT.FORWARD
    }
  }

  deletedKeys.length && this.$nextTick(() => {
    let l = deletedKeys.length - 1
    let { cache, keys, _vnode } = this
    while (l >= 0) {
      pruneCacheEntry(cache, generateVnodeKey(componentName, deletedKeys[l--]), keys, this._vnode)
    }
  })
  this.$emit(event)
  saveHistory.call(this)
}

function pruneCache(aliveInstance, filter) {
  const { cache, keys, _vnode } = aliveInstance
  for (const key in cache) {
    const cachedNode = cache[key]
    if (cachedNode) {
      const name = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry(cache, key, keys, _vnode)
      }
    }
  }
}

function pruneCacheEntry(
  cache,
  key,
  keys,
  current
) {
  key = key.replace(RIGHT_ARROW, '')
  const cached = cache[key]
  if (cached && (!current || cached.key !== current.key)) {
    cached.componentInstance.$destroy()
  }
  delete cache[key]
  remove(keys, key)
}

const EVENT = {
  RELOAD: 'reload',
  REFRESH: 'refresh',
  FORWARD: 'forward',
  BACKWARD: 'backward'
}

export default function ({ componentName, keyName, storageKey }) {
  return {
    name: componentName,
    abstract: true,

    props: {
      include: [RegExp, Function, Array],
      exclude: [RegExp, Function, Array],
      max: [String, Number],
      testRoute: [Function]
    },

    created() {
      this.settings = {
        keyName,
        storageKey,
        componentName
      }
      this.cache = Object.create(null)
      this.keys = []
      this.lastHistoryIndex = window.history.length
      this.history = JSON.parse(window.sessionStorage[storageKey] || '[]')
      this.hisPointer = this.history.length - 1;
    },

    watch: {
      $route(current, prev) {
        onRouteChange.call(this, current, prev)
      }
    },

    destroyed() {
      for (const key in this.cache) {
        pruneCacheEntry(this.cache, key, this.keys)
      }
    },

    mounted() {
      this.$watch('include', val => {
        pruneCache(this, name => matches(val, name))
      })
      this.$watch('exclude', val => {
        pruneCache(this, name => !matches(val, name))
      })
    },

    render() {
      const slot = this.$slots.default
      const vnode = getFirstComponentChild(slot)
      const componentOptions = vnode && vnode.componentOptions
      if (componentOptions) {
        // check pattern
        const name = getComponentName(componentOptions)
        const { include, exclude, testRoute } = this
        if (
          // not included
          (include && (!name || !matches(include, name))) ||
          // excluded
          (exclude && name && matches(exclude, name)) ||
          // completely customized according to routing
          testRoute && !testRoute(this.$route)
        ) {
          return vnode
        }

        const { cache, keys } = this
        const routeKey = this.$route.query[keyName]
        const key = generateVnodeKey(componentName, routeKey)
        vnode.key = key
        if (cache[key]) {
          vnode.componentInstance = cache[key].componentInstance
        } else {
          cache[key] = vnode
          keys.push(key)
          // prune earliest entry
          if (this.max && keys.length > parseInt(this.max)) {
            pruneCacheEntry(cache, keys[0], keys, this._vnode)
          }
        }

        vnode.data.keepAlive = true
      }
      return vnode || (slot && slot[0])
    }
  }
}