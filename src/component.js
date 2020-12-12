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
  const { settings, history } = this
  window.sessionStorage.setItem(settings.storageKey, JSON.stringify(history))
}

function clearArrow() {
  const { settings, history, hisPointer } = this
  if (!history[hisPointer]) return
  history[hisPointer] = history[hisPointer].replace(RIGHT_ARROW, '')
}

function appendArrow() {
  const { settings, history, hisPointer } = this
  history[hisPointer] = RIGHT_ARROW + history[hisPointer]
}

function setHistoryPointer(index) {
  clearArrow.call(this)
  this.hisPointer = index
  appendArrow.call(this)
}

function onRouteChange(current, prev, messager) {
  const { keyName } = this.settings
  const { history } = this
  const replace = messager.isReplace()
  const routeKey = current.query[keyName]
  const resolveLast = function () {
    if (history.length) {
      history[history.length - 1] = routeKey
    } else {
      history.push(routeKey)
    }
    setHistoryPointer.call(this, history.length - 1)
  }

  messager.reset()

  let event = ''
  const removedKeys = []
  if (current && prev.query[keyName] === undefined) {
    // page reload
    event = EVENT.RELOAD
    !history.length && resolveLast.call(this)
  } else if (replace) {
    // vue-router replace
    removedKeys.push(history[history.length - 1])
    event = EVENT.REFRESH
    resolveLast.call(this)
  } else {
    const index = history.indexOf(routeKey)
    let l = history.length - 1

    if (index > -1) {
      // navigator backward or forward
      while (l > index) {
        removedKeys.push(history[l--])
      }
      setHistoryPointer.call(this, index)
      event = EVENT.BACKWARD
    } else {
      while (l > this.hisPointer) {
        let deleted = history.splice(l--, 1)
        removedKeys.push(deleted[0])
      }
      history.push(current.query[keyName])
      setHistoryPointer.call(this, history.length - 1)
      event = EVENT.FORWARD
    }
  }

  this.$nextTick(() => {
    // using $nextTick in case that current node needs to be removed
    if (removedKeys.length) {
      let l = removedKeys.length - 1
      while (l >= 0) {
        pruneRouteKeyRelation.call(this, removedKeys[l--])
      }
    }

    this.printRelations()
  })
  this.$emit(event)
  saveHistory.call(this)
}

function pruneCache(aliveInstance, filter) {
  const { cache, cachedKeys, _vnode } = aliveInstance
  for (const key in cache) {
    const cachedNode = cache[key]
    if (cachedNode) {
      const name = getComponentName(cachedNode.componentOptions)
      if (name && !filter(name)) {
        pruneCacheEntry.call(aliveInstance, cache, key, cachedKeys, _vnode)
      }
    }
  }
}

function pruneCacheEntry(cache, key, cachedKeys, current) {
  const cached = cache[key]
  if (cached && (!current || cached.tag !== current.tag)) {
    cached.componentInstance.$destroy()
  }
  delete cache[key]
  remove(cachedKeys, key)
  pruneCacheKeyRelation.call(this, key)
}

function addKeyRelation(routeKey, cacheKey) {
  const { keyRelations } = this
  const { routeToCache, cacheToRoute } = keyRelations
  if (routeToCache[routeKey]) return

  routeToCache[routeKey] = cacheKey
  if (!cacheToRoute[cacheKey]) {
    cacheToRoute[cacheKey] = []
  }

  cacheToRoute[cacheKey].push(routeKey)
}

function pruneRouteKeyRelation(routeKey) {
  routeKey = routeKey.replace(RIGHT_ARROW, '')
  const { keyRelations } = this
  const { routeToCache, cacheToRoute } = keyRelations
  if (!routeToCache[routeKey]) return

  const cacheKey = routeToCache[routeKey]
  const current = cacheToRoute[cacheKey]
  current.splice(current.indexOf(routeKey), 1)
  delete routeToCache[routeKey]
  if (current.length === 0) {
    const { cache, cachedKeys, _vnode } = this
    pruneCacheEntry.call(this, cache, cacheKey, cachedKeys, _vnode)
  }
}

function pruneCacheKeyRelation(cacheKey) {
  const { keyRelations } = this
  const { routeToCache, cacheToRoute } = keyRelations
  if (!cacheToRoute[cacheKey]) return

  const current = cacheToRoute[cacheKey]
  let l = current.length - 1
  while (l >= 0) {
    delete routeToCache[current[l--]]
  }
  delete cacheToRoute[cacheKey]
}

const EVENT = {
  RELOAD: 'reload',
  REFRESH: 'refresh',
  FORWARD: 'forward',
  BACKWARD: 'backward'
}

export default function ({ componentName, keyName, storageKey, messager, debug }) {
  return {
    name: componentName,
    abstract: !debug,

    props: {
      include: [RegExp, Function, Array],
      exclude: [RegExp, Function, Array],
      max: [String, Number],
      test: [Function]
    },

    data() {
      return {
        keyRelations: {}
      }
    },

    created() {
      this.settings = {
        keyName,
        storageKey
      }
      this.cache = Object.create(null)
      this.cachedKeys = []
      this.keyRelations = {
        routeToCache: {},
        cacheToRoute: {}
      }
      this.history = JSON.parse(window.sessionStorage[storageKey] || '[]')
      // get last state when reload
      this.hisPointer = this.history.length ? this.history.findIndex(i => i.startsWith(RIGHT_ARROW)) : 0;
    },

    watch: {
      $route(current, prev) {
        onRouteChange.call(this, current, prev, messager)
      }
    },

    methods: {
      printRelations() {
        if (!debug) return
        console.group("routeToCache")
        console.table(this.keyRelations.routeToCache)
        console.groupEnd()

        console.group("cacheToRoute")
        console.table(this.keyRelations.cacheToRoute)
        console.groupEnd()
      }
    },

    destroyed() {
      for (const key in this.cache) {
        pruneCacheEntry.call(this, this.cache, key, this.cachedKeys)
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
        const { cache, cachedKeys, $route, max } = this
        const routeKey = $route.query[keyName]
        // generate cache key just like what keep-alive did
        const cacheKey = vnode.key == null
          ? componentOptions.Ctor.cid + (componentOptions.tag ? `::${componentOptions.tag}` : '')
          : vnode.key

        // build relation when keep-alive is working
        const prepatch = vnode.data.hook.prepatch
        vnode.data.hook.prepatch = (_, vnode) => {
          addKeyRelation.call(this, routeKey, cacheKey)
          return prepatch.call(this, _, vnode)
        }

        // build relation when component inited
        const init = vnode.data.hook.init
        vnode.data.hook.init = (vnode) => {
          addKeyRelation.call(this, routeKey, cacheKey)
          return init.call(this, vnode)
        }

        // check pattern
        const name = getComponentName(componentOptions)
        const { include, exclude, test } = this
        if (
          // not included
          (include && (!name || !matches(include, name))) ||
          // excluded
          (exclude && name && matches(exclude, name)) ||
          // completely customized according to routing
          test && !test($route)
        ) {
          return vnode
        }

        if (cache[cacheKey]) {
          vnode.componentInstance = cache[cacheKey].componentInstance
        } else {
          cache[cacheKey] = vnode
          cachedKeys.push(cacheKey)
          // prune earliest entry
          if (max && cachedKeys.length > parseInt(max)) {
            pruneCacheEntry.call(this, cache, cachedKeys[0], cachedKeys, this._vnode)
          }
        }

        vnode.data.keepAlive = true
      }
      return vnode || (slot && slot[0])
    }
  }
}