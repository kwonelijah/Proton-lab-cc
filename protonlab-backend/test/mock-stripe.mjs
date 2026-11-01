// test/mock-stripe.mjs — the slice of stripe-node the handlers use, driven by
// globalThis.__stripe = { pis:[], sessions:[], lineItems:{sid:[]}, refunds:[],
// disputes:[], payouts:[], balance:{}, searchFails:false, updates:[] }.
const S = () => (globalThis.__stripe ||= { pis: [], sessions: [], lineItems: {}, refunds: [], disputes: [], payouts: [], balance: { available: [], pending: [] }, searchFails: false, updates: [] });
const clone = (x) => structuredClone(x);
const paged = (list) => ({ autoPagingToArray: async () => clone(list), data: clone(list) });
const inRange = (ts, created) => !created || ((created.gte == null || ts >= created.gte) && (created.lte == null || ts <= created.lte));

export default class Stripe {
  constructor() {
    this.paymentIntents = {
      list: (params = {}) => paged(S().pis.filter((p) => inRange(p.created, params.created))),
      search: (params = {}) => {
        if (S().searchFails) throw new Error('search unavailable');
        const m = /created>=(\d+) AND created<=(\d+)/.exec(params.query || '');
        const gte = m ? Number(m[1]) : 0, lte = m ? Number(m[2]) : Infinity;
        return paged(S().pis.filter((p) => p.status === 'succeeded' && p.created >= gte && p.created <= lte));
      },
      retrieve: async (id) => { const p = S().pis.find((x) => x.id === id); if (!p) throw new Error('No such payment_intent'); return clone(p); },
      update: async (id, params) => {
        S().updates.push({ id, params: clone(params) });
        const p = S().pis.find((x) => x.id === id); if (!p) throw new Error('No such payment_intent');
        p.metadata = { ...(p.metadata || {}) };
        for (const [k, v] of Object.entries(params.metadata || {})) { if (v === '') delete p.metadata[k]; else p.metadata[k] = v; }
        return clone(p);
      },
    };
    this.checkout = {
      sessions: {
        list: (params = {}) => {
          let list = S().sessions.filter((s) => inRange(s.created, params.created));
          if (params.status) list = list.filter((s) => s.status === params.status);
          if (params.payment_intent) list = list.filter((s) => s.payment_intent === params.payment_intent);
          return paged(list);
        },
        listLineItems: (sid) => paged(S().lineItems[sid] || []),
        create: async (params) => { (S().created ||= []).push(clone(params)); return { id: 'cs_test', url: 'https://checkout.stripe.com/c/cs_test' }; },
      },
    };
    this.refunds = { list: (params = {}) => paged(S().refunds.filter((f) => inRange(f.created, params.created))) };
    this.disputes = { list: (params = {}) => paged(S().disputes.filter((d) => inRange(d.created, params.created))) };
    this.payouts = { list: (params = {}) => paged(S().payouts.filter((p) => inRange(p.arrival_date, params.arrival_date))) };
    this.balance = { retrieve: async () => clone(S().balance) };
  }
}
