<template>
  <div class="klarna-checkout" id="klarna-checkout">
    <div id="klarna-render-checkout" />
    <div v-if="checkout.loading">
      <loading-spinner />
    </div>
    <div v-if="checkout.error">
      Loading Klarna failed
    </div>
    <div v-if="checkout.snippet" v-html="checkout.snippet" /> <!-- eslint-disable-line vue/no-v-html -->
  </div>
</template>

<script>
import { mapGetters } from 'vuex'
import { callApi } from '../helpers'
import { currentStoreView } from '@vue-storefront/core/lib/multistore'
import LoadingSpinner from 'theme/components/theme/blocks/AsyncSidebar/LoadingSpinner.vue'
import { isServer } from '@vue-storefront/core/helpers'
import { KlarnaEvents } from '../types'
import { plugins } from '../plugins'

export default {
  name: 'KlarnaCheckout',
  components: {
    LoadingSpinner
  },
  async mounted () {
    if (!isServer) {
      this.upsertOrder()
    }
  },
  beforeMount () {
    this.$bus.$on('klarna-update-order', this.configureUpdateOrder)
  },
  beforeDestroy () {
    this.$bus.$off('klarna-update-order')
  },
  computed: {
    ...mapGetters({
      order: 'kco/order',
      checkout: 'kco/checkout',
      totals: 'kco/platformTotals',
      hasTotals: 'kco/hasTotals',
      coupon: 'kco/coupon'
    })
  },
  watch: {
    coupon (newValue, oldValue) {
      if (!oldValue || newValue.code !== oldValue.code) {
        this.$bus.$emit('klarna-update-order')
      }
    },
    totals (newValue, oldValue) {
      if (oldValue) {
        if (newValue.qty !== oldValue.qty || newValue.base_grand_total !== oldValue.base_grand_total) {
          const storeView = currentStoreView()
          const countryId = this.$store.state.checkout.shippingDetails.country ? this.$store.state.checkout.shippingDetails.country : storeView.tax.defaultCountry
          this.$store.dispatch('cart/syncShippingMethods', {
            country_id: countryId
          })
          this.$bus.$emit('klarna-update-order')
        }
      }
    }
  },
  methods: {
    setupKlarnaListeners () {
      const events = {}
      Object.values(KlarnaEvents).forEach(event => {
        events[event] = data => {
          plugins.filter(plugin => plugin.on && plugin.on[event]).forEach(plugin => {
            plugin.on[event](data)
          })
          this.$bus.$emit('klarna-event-' + event, data)
        }
      })
      callApi(api => api.on(events))

      // Todo: refactor
      this.$bus.$on('klarna-order-loaded', () => {
        setTimeout(async () => {
          const order = await this.$store.dispatch('kco/fetchOrder', this.checkout.orderId)
          this.onKcoAddressChange({
            totalSegments: this.totals.total_segments,
            shippingAddress: order.shipping_address
          })
        }, 2000)
      })
    },
    async upsertOrder () {
      await this.$store.dispatch('kco/createOrder')
      const { default: postscribe } = await import('postscribe')
      postscribe('#klarna-render-checkout', this.checkout.snippet)
      await Promise.resolve()
      this.setupKlarnaListeners()
    },
    async configureUpdateOrder () {
      if (!this.checkout.order || !this.checkout.order.order_id) {
        return
      }
      await this.suspendCheckout()
      await this.upsertOrder()
      await this.resumeCheckout()
    },
    suspendCheckout () {
      return callApi(api => api.suspend())
    },
    resumeCheckout () {
      return callApi(api => api.resume())
    },
    onKcoAddressChange (orderData) {
      if (orderData.shippingAddress.postal_code) {
        this.$bus.$emit('kcoAddressChange', orderData)
      }
      return callApi(api => api.on({
        billing_address_change: async () => {
          this.$bus.$emit('klarna-order-loaded')
        }
      }))
    }
  }
}
</script>

<style lang="scss">
div.wrapper.wrapper {
  height: 30vh;
  max-width: 100%;
  padding-left: 25px;
}
#klarna-unsupported-page {
  display: none;
}
</style>
