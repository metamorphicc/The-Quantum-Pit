import assert from 'node:assert/strict'
import { after, beforeEach, test } from 'node:test'
import { createServer } from 'vite'

// Load the production TypeScript with Vite's own resolver, without an HTTP server.
const vite = await createServer({ configFile: false, server: { middlewareMode: true, hmr: false } })
after(() => vite.close())
const storage = new Map()
const timers = new Map()
let timerId = 0
globalThis.localStorage = {
  getItem: (key) => storage.get(key) ?? null,
  setItem: (key, value) => storage.set(key, value),
  removeItem: (key) => storage.delete(key),
}
globalThis.window = {
  setTimeout: (fn, ms) => { timers.set(++timerId, { fn, ms }); return timerId },
  clearTimeout: (id) => timers.delete(id),
}

const load = (file) => vite.ssrLoadModule(file)
const actions = await load('/src/game/actions.ts')
const store = await load('/src/game/store.ts')
const config = await load('/src/game/config.ts')
const persistence = await load('/src/game/persistence.ts')
const habits = await load('/src/game/badHabits.ts')
const tasks = await load('/src/game/tasks.ts')
const http = await load('/api/_lib/http.ts')
const baseVerify = (await load('/api/checkout/base-verify.ts')).default
const baseCheckout = (await load('/api/checkout/base-cosmetic.ts')).default
const products = (await load('/api/_lib/products.ts')).PRODUCTS
const payments = await load('/src/payments/cosmeticCheckout.ts')
const paymentStore = await load('/api/_lib/store.ts')
const baseRpc = await load('/api/_lib/base-rpc.ts')
const telegram = (await load('/api/telegram.ts')).default

function response() {
  return {
    code: 200, body: undefined,
    status(code) { this.code = code; return this },
    json(body) { this.body = body },
    end() {},
  }
}

function settleFill() {
  for (const [id, timer] of [...timers]) {
    if (timer.ms === config.BET.resolveDelayMs) {
      timers.delete(id)
      timer.fn()
    }
  }
}

beforeEach(() => {
  storage.clear()
  timers.clear()
  delete window.ethereum
  store.resetState()
  store.setState({ settings: { sound: false, haptics: false, reduceMotion: true } })
})

test('invalid stakes, sides and quantities cannot mutate the game', () => {
  const before = store.getState()
  const market = config.MARKETS[0].id
  for (const stake of [-1, 0, NaN, Infinity, -Infinity, '20']) {
    assert.equal(actions.placeSimBet(market, 'yes', stake).ok, false)
  }
  assert.equal(actions.placeSimBet(market, 'invalid', 10).ok, false)
  assert.equal(actions.placeSimBet('toString', 'yes', 10).ok, false)
  for (const qty of [-1, 0, 0.5, NaN, Infinity, '1']) {
    assert.equal(actions.buySupply('primer', qty).ok, false)
  }
  assert.equal(actions.buySupply('constructor').ok, false)
  assert.deepEqual(store.getState(), before)
})

test('valid trade resolves exactly once and cooldown clearing cannot open a second fill', () => {
  const market = config.MARKETS[0].id
  assert.equal(actions.placeSimBet(market, 'yes', 10).ok, true)
  store.setState({ cooldowns: {} })
  assert.equal(actions.placeSimBet(market, 'yes', 10).ok, false)
  settleFill()
  assert.equal(store.getState().tally.bets, 1)
  assert.ok(Number.isFinite(store.getState().bankroll))
  settleFill()
  assert.equal(store.getState().tally.bets, 1)
})

test('reset discards the pending trade from the old account', () => {
  assert.equal(actions.placeSimBet(config.MARKETS[0].id, 'yes', 10).ok, true)
  actions.resetGame()
  const before = store.getState()
  settleFill()
  assert.deepEqual(store.getState(), before)
  assert.equal(before.screen, 'boot')
  assert.equal(before.xp, 0)
})

test('changing identity invalidates old fills without blocking a new account', () => {
  const market = config.MARKETS[0].id
  assert.equal(actions.placeSimBet(market, 'yes', 10).ok, true)
  store.setState({ walletAddress: `0x${'a'.repeat(40)}`, cooldowns: {} })
  assert.equal(actions.placeSimBet(market, 'yes', 10).ok, true)
  settleFill()
  assert.equal(store.getState().tally.bets, 1)
})

test('onboarding bonuses cannot be collected twice', () => {
  const classId = Object.keys(config.TRADER_CLASS_BY_ID)[0]
  assert.equal(actions.completeOnboarding(classId).ok, true)
  const before = store.getState().stats
  assert.equal(actions.completeOnboarding(classId).ok, false)
  assert.deepEqual(store.getState().stats, before)
})

test('loading an empty inventory does not regenerate starter supplies', () => {
  const save = config.freshSave(Date.now())
  save.stash = {}
  save.tally.bets = 'broken'
  save.tally.losses = -4
  save.tally.scans = 2.5
  localStorage.setItem(`${config.SAVE_KEY_PREFIX}guest`, JSON.stringify(save))
  const loaded = persistence.loadSave(Date.now()).save
  assert.deepEqual(loaded.stash, {})
  assert.equal(loaded.tally.bets, 0)
  assert.equal(loaded.tally.losses, 0)
  assert.equal(loaded.tally.scans, 2)
})

test('historic losses do not trigger chasing-losses in a new session', () => {
  const state = config.freshSave(Date.now())
  state.tally.losses = 20
  state.tasks.session.baseline = tasks.snapshotBaseline(state)
  state.tally.bets += 2
  state.tally.scans += 1
  state.tally.researches += 1
  state.stats.heat = 50
  assert.equal(habits.badHabitWarning(state), null)
  state.tally.losses += 2
  assert.equal(habits.badHabitWarning(state).id, 'chasing-losses')
})

test('the advertised Break remedy clears overtrading', () => {
  const state = config.freshSave(Date.now())
  state.tally.bets = 7
  state.tally.scans = 1
  state.tally.researches = 1
  assert.equal(habits.badHabitWarning(state).id, 'overtrading')
  store.setState(state)
  assert.equal(actions.doAction('recover').ok, true)
  assert.equal(habits.badHabitWarning(store.getState()), null)
})

test('API bodies reject null, arrays, malformed JSON and oversized parsed objects', () => {
  for (const body of ['null', '[]', '42', '"text"', '{', null, []]) {
    const res = response()
    assert.equal(http.rejectUnsafeJson({ headers: {}, body }, res), true)
    assert.equal(res.code, 400)
  }
  const res = response()
  assert.equal(http.rejectUnsafeJson({ headers: {}, body: { value: 'é'.repeat(2500) } }, res), true)
  assert.equal(res.code, 413)
  assert.deepEqual(http.parseBody('null'), {})
  assert.equal(http.rejectUnsafeJson({ headers: {}, body: { productId: 'valid' } }, response()), false)
})

test('canceling the wallet signature safely returns no entitlements', async () => {
  window.ethereum = { request: async () => { throw new Error('User rejected') } }
  assert.deepEqual(await payments.fetchEntitlements({ loginMethod: 'base', walletAddress: `0x${'a'.repeat(40)}` }), [])
})

test('late entitlements are not applied after reset', async (t) => {
  store.setState({ loginMethod: 'telegram' })
  let resolveFetch
  t.mock.method(globalThis, 'fetch', () => new Promise((resolve) => { resolveFetch = resolve }))
  const pending = actions.syncEntitlements()
  actions.resetGame()
  resolveFetch({ ok: true, json: async () => ({ owned: ['cos_desk_carbon'] }) })
  await pending
  assert.deepEqual(store.getState().ownedCosmetics, [])
})

function configureStore(t) {
  for (const [key, value] of Object.entries({
    KV_REST_API_URL: 'https://store.invalid', KV_REST_API_TOKEN: 'test-token',
    TREASURY_ADDRESS: `0x${'b'.repeat(40)}`, BASE_RPC_URL: 'https://rpc.invalid',
  })) {
    const before = process.env[key]
    process.env[key] = value
    t.after(() => { if (before === undefined) delete process.env[key]; else process.env[key] = before })
  }
}

test('Base payment retries recover a failed grant and reject reusing a tx for a different item', async (t) => {
  configureStore(t)
  const payer = `0x${'a'.repeat(40)}`
  const txHash = `0x${'c'.repeat(64)}`
  const product = products.cos_desk_carbon
  let record = null
  let failGrant = true
  const owned = new Set()
  t.mock.method(globalThis, 'fetch', async (url, opts) => {
    const command = JSON.parse(opts.body)
    if (url === 'https://rpc.invalid') {
      return { ok: true, json: async () => ({ result: { status: '0x1', logs: [{
        address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913',
        topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
          `0x${'0'.repeat(24)}${payer.slice(2)}`, `0x${'0'.repeat(24)}${'b'.repeat(40)}`],
        data: `0x${product.usdcUnits.toString(16)}`,
      }] } }) }
    }
    let result
    switch (command[0]) {
      case 'EVAL': result = 1; break
      case 'SET': result = record === null ? 'OK' : null; record ??= command[2]; break
      case 'GET': result = record; break
      case 'SADD':
        if (failGrant) { failGrant = false; throw new Error('Temporary store outage') }
        owned.add(command[2]); result = 1; break
      case 'SMEMBERS': result = [...owned]; break
      default: throw new Error(`Unexpected command: ${command[0]}`)
    }
    return { ok: true, json: async () => ({ result }) }
  })
  const req = { method: 'POST', headers: {}, body: { productId: product.id, walletAddress: payer, txHash } }
  const first = response()
  await baseVerify(req, first)
  assert.equal(first.body.pending, true)
  assert.equal(owned.size, 0)
  const retry = response()
  await baseVerify(req, retry)
  assert.equal(retry.body.verified, true)
  assert.deepEqual([...owned], [product.id])
  const duplicate = response()
  await baseVerify(req, duplicate)
  assert.equal(duplicate.body.verified, true)
  const other = response()
  await baseVerify({ ...req, body: { ...req.body, productId: 'cos_tool_founder_mug' } }, other)
  assert.equal(other.code, 400)
  assert.deepEqual([...owned], [product.id])
})

test('each Base SKU has a distinct exact price while checkout uses plain USDC transfers', () => {
  const prices = Object.values(products).map((product) => product.usdcUnits.toString())
  assert.equal(new Set(prices).size, prices.length, 'Shared prices require product-bound checkout orders')
})

test('payment verification rejects underpayment, overpayment, wrong recipients, tokens and reverted txs', async (t) => {
  const from = `0x${'a'.repeat(40)}`
  const to = `0x${'b'.repeat(40)}`
  const query = { rpcUrl: 'https://rpc.invalid', txHash: `0x${'c'.repeat(64)}`, token: baseRpc.BASE_USDC, recipient: to, units: 3990000n }
  const log = {
    address: baseRpc.BASE_USDC,
    topics: ['0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef',
      `0x${'0'.repeat(24)}${from.slice(2)}`, `0x${'0'.repeat(24)}${to.slice(2)}`],
    data: `0x${query.units.toString(16)}`,
  }
  let receipt = { status: '0x1', logs: [log] }
  t.mock.method(globalThis, 'fetch', async () => ({ ok: true, json: async () => ({ result: receipt }) }))
  assert.deepEqual(await baseRpc.verifyErc20Transfer(query), { status: 'confirmed', from })
  for (const units of [query.units - 1n, query.units + 1n]) {
    receipt = { status: '0x1', logs: [{ ...log, data: `0x${units.toString(16)}` }] }
    assert.equal((await baseRpc.verifyErc20Transfer(query)).status, 'failed')
  }
  receipt = { status: '0x1', logs: [{ ...log, address: to }] }
  assert.equal((await baseRpc.verifyErc20Transfer(query)).status, 'failed')
  receipt = { status: '0x1', logs: [{ ...log, topics: [...log.topics.slice(0, 2), log.topics[1]] }] }
  assert.equal((await baseRpc.verifyErc20Transfer(query)).status, 'failed')
  receipt = { status: '0x0', logs: [log] }
  assert.equal((await baseRpc.verifyErc20Transfer(query)).status, 'failed')
  receipt = null
  assert.equal((await baseRpc.verifyErc20Transfer(query)).status, 'pending')
})

test('Telegram rejects forged payment webhooks before contacting external services', async (t) => {
  const secret = process.env.WEBHOOK_SECRET
  process.env.WEBHOOK_SECRET = 'test-webhook-secret'
  t.after(() => { if (secret === undefined) delete process.env.WEBHOOK_SECRET; else process.env.WEBHOOK_SECRET = secret })
  t.mock.method(globalThis, 'fetch', () => { throw new Error('Unauthenticated webhook must not make requests') })
  const res = response()
  await telegram({ method: 'POST', headers: {}, body: { message: { successful_payment: {} } } }, res)
  assert.equal(res.code, 401)
})

test('rate-limit increment and expiry use one atomic Redis command', async (t) => {
  configureStore(t)
  const commands = []
  t.mock.method(globalThis, 'fetch', async (_url, opts) => {
    commands.push(JSON.parse(opts.body))
    return { ok: true, json: async () => ({ result: 1 }) }
  })
  assert.equal(await paymentStore.incrementExpiring('rl:test', 60), 1)
  assert.equal(commands.length, 1)
  assert.equal(commands[0][0], 'EVAL')
  assert.match(commands[0][1], /INCR/)
  assert.match(commands[0][1], /EXPIRE/)
  assert.deepEqual(commands[0].slice(2), [1, 'rl:test', 60])
})

test('Base checkout does not request payment when entitlement storage is unconfigured', async (t) => {
  const keys = ['KV_REST_API_URL', 'UPSTASH_REDIS_REST_URL', 'KV_REST_API_TOKEN', 'UPSTASH_REDIS_REST_TOKEN']
  for (const key of keys) {
    const before = process.env[key]
    delete process.env[key]
    t.after(() => { if (before !== undefined) process.env[key] = before })
  }
  const res = response()
  await baseCheckout({ method: 'POST', headers: {}, body: { productId: 'cos_desk_carbon' } }, res)
  assert.equal(res.code, 503)
})
