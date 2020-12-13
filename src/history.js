const RIGHT_ARROW = '→'
const EVENT = {
    RELOAD: 'reload',
    REFRESH: 'refresh',
    FORWARD: 'forward',
    BACKWARD: 'backward',
    ALL: 'all'
}

export {EVENT as events}

function saveEntries() {
    const { settings, entries } = this
    window.sessionStorage.setItem(settings.storageKey, JSON.stringify(entries))
}

function clearArrow() {
    const { settings, entries, hisPointer } = this
    if (!entries[hisPointer]) return
    entries[hisPointer] = entries[hisPointer].replace(RIGHT_ARROW, '')
}

function appendArrow() {
    const { settings, entries, hisPointer } = this
    entries[hisPointer] = RIGHT_ARROW + entries[hisPointer]
}

function setHistoryPointer(index) {
    clearArrow.call(this)
    this.hisPointer = index
    appendArrow.call(this)
}

export default class History {
    constructor({ Vue, router, storageKey, keyName, messager }) {
        const eventBus = new Vue()
        this.entries = JSON.parse(window.sessionStorage[storageKey] || '[]')
        // get last state when reload
        this.hisPointer = this.entries.length ? this.entries.findIndex(i => i.startsWith(RIGHT_ARROW)) : 0
        this.settings = { storageKey, keyName }
        this.messager = messager
        this.router = router
        this._inited = false;

        // register event dispatcher methods
        ['$on', '$emit', '$once', '$off'].forEach(m => {
            this[m] = function (...args) {
                return eventBus[m](...args)
            }
        })
    }

    init() {
        if (this._inited) return
        this._inited = true
        // $watch api turns to be valid after vue component instance has been created
        this.router.app.$on('hook:created', () => {
            this.unwatchRoute = this.router.app.$watch('$route', this.notifyRouteChange.bind(this))
        })
    }

    notifyRouteChange(current, prev) {
        const { keyName } = this.settings
        const { entries } = this
        const replace = this.messager.isReplace()
        const routeKey = current.query[keyName]
        const resolveLast = function () {
            if (entries.length) {
                entries[entries.length - 1] = routeKey
            } else {
                entries.push(routeKey)
            }
            setHistoryPointer.call(this, entries.length - 1)
        }

        this.messager.reset()

        let event = ''
        const removedKeys = []
        if (current && prev.query[keyName] === undefined) {
            // page reload
            event = EVENT.RELOAD
            !entries.length && resolveLast.call(this)
        } else if (replace) {
            // vue-router replace
            removedKeys.push(entries[entries.length - 1].replace(RIGHT_ARROW, ''))
            event = EVENT.REFRESH
            resolveLast.call(this)
        } else {
            const index = entries.indexOf(routeKey)
            let l = entries.length - 1

            if (index > -1) {
                // navigator backward or forward
                while (l > index) {
                    removedKeys.push(entries[l--].replace(RIGHT_ARROW, ''))
                }
                setHistoryPointer.call(this, index)
                event = EVENT.BACKWARD
            } else {
                while (l > this.hisPointer) {
                    const deleted = entries.splice(l--, 1)
                    removedKeys.push(deleted[0].replace(RIGHT_ARROW, ''))
                }
                entries.push(current.query[keyName])
                setHistoryPointer.call(this, entries.length - 1)
                event = EVENT.FORWARD
            }
        }

        saveEntries.call(this)
        this.$emit(event, { removedKeys }) 
        this.$emit(EVENT.ALL, { event, removedKeys }) 
    }
}