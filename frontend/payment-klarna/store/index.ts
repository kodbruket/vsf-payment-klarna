import { Module } from 'vuex'
import CheckoutState from '../types/CheckoutState'
import { actions } from './actions'
import { getters } from './getters'
import { mutations } from './mutations'

export const module: Module<CheckoutState, any> = {
  namespaced: true,
  actions,
  getters,
  mutations,
  state: {
    checkout: {
      orderId: '',
      loading: false,
      snippet: null,
      scriptsTags: null
    },
    confirmation: {
      loading: false,
      snippet: null,
      scriptsTags: null
    }
  }
}
