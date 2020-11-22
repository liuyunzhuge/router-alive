export default {
  method: '',
  setReplace() {
    this.method = 'replace'
  },
  isReplace() {
    return this.method === 'replace'
  },
  reset() {
    this.method = ''
  }
}